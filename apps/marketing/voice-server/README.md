# 음성 서버 (Qwen3-TTS)

마케팅 워커가 녹음 목소리로 숏폼 내레이션을 만들 때 부르는 작은 서버. 모델은 [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) (Apache-2.0, 상업용 가능).
목소리를 업체에 등록하지 않고, 읽을 때마다 녹음 원본(+녹음에서 읽은 문장)을 받아 따라 읽는다. 같은 녹음은 메모리에 캐시한다.

## 실행 (GPU 서버)

```bash
docker build -t marketing-voice .
docker run --gpus all -p 8000:8000 -v hf-cache:/cache \
  -e VOICE_SERVER_TOKEN=아무_긴_문자열 \
  -e QWEN_TTS_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-Base \
  marketing-voice
curl -H "Authorization: Bearer 아무_긴_문자열" http://localhost:8000/health
```

Docker 없이: `pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8000` (ffmpeg 필요).

## 맥에서 실행 (Apple Silicon)

```bash
cd apps/marketing/voice-server
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 처음 한 번
PYTORCH_ENABLE_MPS_FALLBACK=1 .venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
```

- 장치는 자동으로 `mps`(bfloat16). 처음 실행 때 모델을 내려받는다(Base 1.7B 약 4GB, `/design` 을 처음 부를 때 VoiceDesign 약 4GB).
- 메모리가 빠듯하면 `QWEN_TTS_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-Base` 로 읽기 모델을 줄인다.
- 워커 `.env.local` 에 `QWEN_TTS_URL=http://127.0.0.1:8000` (토큰은 비워도 된다).

## 워커 연결 (`worker/.env.local`)

```
QWEN_TTS_URL=http://<서버 주소>:8000
QWEN_TTS_TOKEN=아무_긴_문자열
```

## 메모

- 모델: `Qwen/Qwen3-TTS-12Hz-1.7B-Base` 또는 `…-0.6B-Base`. 공식 한국어 수치는 0.6B 가 조금 더 좋다 — 둘 다 들어 보고 고른다.
- 녹음에서 읽은 문장(ref_text)을 넣어야 목소리가 제대로 닮는다. 없으면 화자 특징만 쓰는 모드로 읽고, 녹음은 앞 20초만 쓴다.
- 녹음은 깨끗한 10–20초가 알맞다. 긴 녹음을 넣을 때는 문장도 녹음 전체와 정확히 같아야 한다.
- `ATTN=flash_attention_2` 는 flash-attn 을 설치했을 때만(메모리 절약). 기본은 `sdpa`.
- `/design`: 영어 설명(instruct)대로 새 목소리를 지어 읽는다. 한국어 설명은 거의 무시되니 영어로 넘긴다(워커가 처리).
- 한 번에 하나씩 만든다. 동시에 많이 만들려면 서버를 늘린다.
- 공식 HTTP 서버가 없어서 직접 감쌌다. API 는 `qwen_tts.Qwen3TTSModel.create_voice_clone_prompt` / `generate_voice_clone`.
