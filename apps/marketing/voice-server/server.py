"""Qwen3-TTS 음성 서버 — 마케팅 워커가 숏폼 내레이션을 만들 때 부른다 (core/src/ai/voice/qwen.ts).

등록 없이 따라 읽는 방식(zero-shot):
  POST /speak  (multipart) text, language=Korean, ref_audio=<녹음 파일>, ref_text=<녹음에서 읽은 문장, 선택>
               → audio/mpeg
  POST /design (multipart) text, instruct=<영어 목소리 설명>, language=Korean → audio/mpeg
               설명대로 새 목소리를 지어 읽는다(VoiceDesign 모델). 부를 때마다 조금씩 다른 목소리 → 후보 여러 개
  GET  /health → 모델·장치·지원 언어

- 같은 녹음(+문장)으로 만든 목소리 프롬프트는 메모리에 캐시해 두고 다시 만들지 않는다.
- ref_text 가 없으면 화자 특징만 쓰는 모드(x_vector_only)로 읽는다 — 품질이 조금 떨어진다. 이때 녹음은 앞 MAX_REF_SECONDS 초만 쓴다.
- GPU 하나에서 한 번에 하나씩 만든다(lock).

환경변수
  QWEN_TTS_MODEL     Qwen/Qwen3-TTS-12Hz-1.7B-Base (기본) 또는 Qwen/Qwen3-TTS-12Hz-0.6B-Base
  QWEN_TTS_DESIGN_MODEL  Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign (기본). /design 을 처음 부를 때 올린다
  VOICE_SERVER_TOKEN 비우면 토큰 없이 열린다(내부망에서만). 워커의 QWEN_TTS_TOKEN 과 같게
  DEVICE             cuda:0 (GPU 있으면 기본) · mps (Apple Silicon 이면 기본) · cpu
  ATTN               sdpa (기본) · flash_attention_2 (flash-attn 설치했을 때, 메모리 절약)
  MAX_REF_SECONDS    20
"""

import hashlib
import io
import os
import subprocess
import threading
from collections import OrderedDict

import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from qwen_tts import Qwen3TTSModel

MODEL_ID = os.getenv("QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
TOKEN = os.getenv("VOICE_SERVER_TOKEN", "")
DESIGN_MODEL_ID = os.getenv("QWEN_TTS_DESIGN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
DEVICE = os.getenv("DEVICE") or ("cuda:0" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
ATTN = os.getenv("ATTN", "sdpa")
MAX_REF_SECONDS = float(os.getenv("MAX_REF_SECONDS", "20"))
CACHE_MAX = int(os.getenv("CACHE_MAX", "32"))

# Apple Silicon(mps)도 bfloat16 으로 돈다(M5 에서 확인, float32 의 절반 메모리)
load_kwargs = {"device_map": DEVICE, "dtype": torch.bfloat16 if DEVICE.startswith(("cuda", "mps")) else torch.float32}
if ATTN:
    load_kwargs["attn_implementation"] = ATTN
model = Qwen3TTSModel.from_pretrained(MODEL_ID, **load_kwargs)

design_model = None  # /design 을 처음 부를 때 올린다(안 쓰면 메모리를 차지하지 않게)

lock = threading.Lock()
prompts: "OrderedDict[str, object]" = OrderedDict()
app = FastAPI(title="marketing voice server")


def check_token(authorization: str | None) -> None:
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="토큰이 맞지 않아요")


def ffmpeg(args: list[str], data: bytes) -> bytes:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", *args, "pipe:1"], input=data, capture_output=True)
    if p.returncode != 0:
        raise HTTPException(status_code=400, detail=f"오디오를 변환하지 못했어요: {p.stderr.decode(errors='ignore')[-300:]}")
    return p.stdout


def decode_ref(data: bytes):
    """mp3·m4a·wav 어떤 녹음이든 24kHz 모노 wav 로 읽는다"""
    wav, sr = sf.read(io.BytesIO(ffmpeg(["-ac", "1", "-ar", "24000", "-f", "wav"], data)), dtype="float32")
    return wav, sr


def voice_prompt(data: bytes, ref_text: str):
    key = hashlib.sha256(data + b"\0" + ref_text.encode()).hexdigest()
    if key in prompts:
        prompts.move_to_end(key)
        return prompts[key]
    wav, sr = decode_ref(data)
    x_vector_only = not ref_text
    if x_vector_only and len(wav) > MAX_REF_SECONDS * sr:
        wav = wav[: int(MAX_REF_SECONDS * sr)]
    item = model.create_voice_clone_prompt(ref_audio=(wav, sr), ref_text=ref_text or None, x_vector_only_mode=x_vector_only)
    prompts[key] = item
    while len(prompts) > CACHE_MAX:
        prompts.popitem(last=False)
    return item


@app.get("/health")
def health(authorization: str | None = Header(default=None)):
    check_token(authorization)
    return {"ok": True, "model": MODEL_ID, "design_model": DESIGN_MODEL_ID if design_model else None, "device": DEVICE, "languages": model.get_supported_languages(), "cached_voices": len(prompts)}


def to_mp3(wav, sr) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, wav, sr, format="WAV")
    return ffmpeg(["-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3"], buf.getvalue())


@app.post("/design")
def design(
    text: str = Form(...),
    instruct: str = Form(...),
    language: str = Form("Korean"),
    authorization: str | None = Header(default=None),
):
    global design_model
    check_token(authorization)
    text, instruct = text.strip(), instruct.strip()
    if not text or not instruct:
        raise HTTPException(status_code=400, detail="읽을 문장과 목소리 설명이 둘 다 있어야 해요")
    if len(text) > 300 or len(instruct) > 800:
        raise HTTPException(status_code=400, detail="문장(300자)이나 설명(800자)이 너무 길어요")
    try:
        with lock:
            if design_model is None:
                design_model = Qwen3TTSModel.from_pretrained(DESIGN_MODEL_ID, **load_kwargs)
            wavs, sr = design_model.generate_voice_design(text=text, instruct=instruct, language=language, do_sample=True)
    except torch.cuda.OutOfMemoryError as e:  # type: ignore[attr-defined]
        torch.cuda.empty_cache()
        raise HTTPException(status_code=503, detail=f"CUDA out of memory: {e}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}") from e
    return Response(content=to_mp3(wavs[0], sr), media_type="audio/mpeg")


@app.post("/speak")
def speak(
    text: str = Form(...),
    language: str = Form("Korean"),
    ref_text: str = Form(""),
    ref_audio: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    check_token(authorization)
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="읽을 문장이 비어 있어요")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="문장이 너무 길어요 (500자까지)")
    data = ref_audio.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="녹음 파일이 비어 있어요")
    try:
        with lock:
            item = voice_prompt(data, ref_text.strip())
            wavs, sr = model.generate_voice_clone(text=text, language=language, voice_clone_prompt=item)
    except HTTPException:
        raise
    except torch.cuda.OutOfMemoryError as e:  # type: ignore[attr-defined]
        torch.cuda.empty_cache()
        raise HTTPException(status_code=503, detail=f"CUDA out of memory: {e}") from e
    except Exception as e:  # 모델 에러는 그대로 알려 준다
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}") from e
    return Response(content=to_mp3(wavs[0], sr), media_type="audio/mpeg")
