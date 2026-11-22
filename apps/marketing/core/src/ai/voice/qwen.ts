/* Qwen3-TTS (VoiceProvider) — 자체 GPU 서버(apps/marketing/voice-server)를 부른다. Apache-2.0, 비용은 서버 시간뿐.
   업체에 목소리를 "등록"하지 않는다: 읽을 때마다 녹음 원본 + 녹음에서 읽은 문장을 함께 보내고,
   서버가 녹음 내용으로 목소리 프롬프트를 만들어 캐시해 둔다(같은 녹음이면 다시 만들지 않는다).
   env: QWEN_TTS_URL (예: http://gpu-box:8000), QWEN_TTS_TOKEN (서버의 VOICE_SERVER_TOKEN 과 같게) */

import { AiError, networkError, qwenError } from '../errors'
import type { VoiceProvider, VoiceRef, VoiceSample } from './provider'

function cfg() {
  const url = process.env.QWEN_TTS_URL
  if (!url) throw new AiError('qwen', 'auth', 'QWEN_TTS_URL 이 없어 Qwen3-TTS 음성 서버를 부를 수 없어요. worker/.env.local 에 서버 주소를 넣어 주세요 (apps/marketing/voice-server 참고).')
  return { url: url.replace(/\/$/, ''), token: process.env.QWEN_TTS_TOKEN || '' }
}

async function call(path: string, init: RequestInit, what: string, timeoutMs: number) {
  const c = cfg()
  let res: Response
  try {
    res = await fetch(`${c.url}${path}`, { ...init, headers: { ...(c.token ? { authorization: `Bearer ${c.token}` } : {}), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    throw networkError('qwen', e)
  }
  if (!res.ok) throw qwenError(res.status, await res.text(), what)
  return res
}

/** 등록할 것은 없다 — 서버가 살아 있는지만 확인하고 고정 id 를 돌려준다(녹음은 읽을 때마다 보낸다) */
async function clone(_name: string, _sample: VoiceSample) {
  await call('/health', { method: 'GET' }, '음성 서버 확인', 15_000)
  return 'ref'
}

async function preset(label: string): Promise<string> {
  throw new AiError('qwen', 'model', `Qwen3-TTS 에는 "${label}" 같은 기본 목소리가 없어요. 기본 목소리는 ElevenLabs 로 읽어요 (VOICE_PRESET_PROVIDER).`)
}

async function speak(_id: string, text: string, ref?: VoiceRef) {
  if (!ref) throw new AiError('qwen', 'bad_request', 'Qwen3-TTS 는 녹음 원본이 있어야 읽을 수 있어요. 모델 화면에서 녹음 파일을 다시 올려 주세요.')
  const form = new FormData()
  form.append('text', text)
  form.append('language', 'Korean')
  if (ref.transcript?.trim()) form.append('ref_text', ref.transcript.trim())
  form.append('ref_audio', new Blob([new Uint8Array(ref.sample.data)], { type: ref.sample.mime }), ref.sample.filename)
  // 첫 호출은 목소리 프롬프트를 만들고(+모델이 막 깨어났으면 더) 오래 걸릴 수 있다
  const res = await call('/speak', { method: 'POST', body: form }, '내레이션 합성', 180_000)
  return new Uint8Array(await res.arrayBuffer())
}

/** 설명(영어)대로 새 목소리로 text 를 읽은 mp3 (VoiceDesign 모델). 부를 때마다 조금씩 다른 목소리가 나온다 */
export async function designVoice(text: string, instruct: string) {
  const form = new FormData()
  form.append('text', text)
  form.append('instruct', instruct)
  form.append('language', 'Korean')
  // 처음 부르면 서버가 VoiceDesign 모델(약 4GB)을 올리느라 오래 걸린다
  const res = await call('/design', { method: 'POST', body: form }, '목소리 후보 만들기', 300_000)
  return new Uint8Array(await res.arrayBuffer())
}

export const qwen: VoiceProvider = { name: 'qwen', label: 'Qwen3-TTS', needsReference: true, clone, preset, speak }
