/* 목소리 업체 고르기.
   - VOICE_PROVIDER: 녹음 목소리를 새로 등록할 업체 (기본 elevenlabs)
   - VOICE_PRESET_PROVIDER: 기본 목소리("맑은 여성" 등)를 읽을 업체 (기본 VOICE_PROVIDER 와 같음)
   이미 등록된 목소리는 저장된 id 앞의 업체 이름대로 읽는다 — 기본 업체를 바꿔도 예전 모델은 그대로 동작한다. */

import { AiError } from '../errors'
import { elevenlabs } from './elevenlabs'
import { qwen } from './qwen'
import type { VoiceProvider } from './provider'

export type { VoiceProvider, VoiceRef, VoiceSample } from './provider'

const PROVIDERS: Record<string, VoiceProvider> = {
  [elevenlabs.name]: elevenlabs,
  [qwen.name]: qwen,
  // 새 업체는 여기에 한 줄
}

/** 접두어 없는 예전 id 는 ElevenLabs 로 본다 */
const LEGACY = 'elevenlabs'
export const MOCK = 'mock'

export function providerOf(name: string): VoiceProvider {
  const p = PROVIDERS[name]
  if (!p) throw new AiError('elevenlabs', 'model', `목소리 업체 "${name}" 를 쓸 수 없어요(설정에서 빠졌어요). 모델 화면에서 목소리를 다시 등록해 주세요.`)
  return p
}

/** engine: 모델에서 고른 엔진(voice_engine). 없으면 VOICE_PROVIDER */
export const cloneProvider = (engine?: string | null) => providerOf(engine || process.env.VOICE_PROVIDER || LEGACY)
// 기본 목소리('맑은 여성' 등)는 이름 있는 목소리 목록이 있는 업체가 읽는다 — Qwen3-TTS Base 모델에는 없어서 ElevenLabs 가 기본
export const presetProvider = () => providerOf(process.env.VOICE_PRESET_PROVIDER || LEGACY)

/** 저장 형식 "업체:id" */
export const packVoiceId = (provider: string, id: string) => `${provider}:${id}`
export function unpackVoiceId(stored: string) {
  if (stored.startsWith('mock-')) return { provider: MOCK, id: stored } // 예전 모의 id
  const i = stored.indexOf(':')
  return i > 0 ? { provider: stored.slice(0, i), id: stored.slice(i + 1) } : { provider: LEGACY, id: stored }
}
