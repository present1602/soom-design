/* ElevenLabs 목소리 (VoiceProvider)
   - clone: 녹음 파일로 목소리 등록(Instant Voice Clone, 유료 요금제) → voice_id
   - preset: "맑은 여성" 같은 기본 목소리 이름 → 업체 기본 목소리 id
   - speak: 대본 → mp3 (한국어는 다국어 모델로 읽는다)
   env: ELEVENLABS_API_KEY, ELEVENLABS_MODEL, ELEVENLABS_PRESET_VOICES */

import { VOICE_PRESETS } from '../../voice'
import { AiError, elevenLabsError, networkError } from '../errors'
import type { VoiceProvider, VoiceSample } from './provider'

const BASE = 'https://api.elevenlabs.io/v1'

function key() {
  const k = process.env.ELEVENLABS_API_KEY
  if (!k) throw new AiError('elevenlabs', 'auth', 'ELEVENLABS_API_KEY 가 없어 목소리를 만들 수 없어요. worker/.env.local 에 넣거나 AI_MODE=mock 으로 두세요.')
  return k
}

async function call(path: string, init: RequestInit, what: string, timeoutMs = 120_000) {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { 'xi-api-key': key(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    if (e instanceof AiError) throw e
    throw networkError('elevenlabs', e)
  }
  if (!res.ok) throw elevenLabsError(res.status, await res.text(), what)
  return res
}

async function clone(name: string, sample: VoiceSample) {
  const form = new FormData()
  form.append('name', name)
  form.append('description', '마케팅 콘솔 가상 모델 목소리')
  form.append('remove_background_noise', 'true')
  form.append('files', new Blob([new Uint8Array(sample.data)], { type: sample.mime }), sample.filename)
  const res = await call('/voices/add', { method: 'POST', body: form }, '목소리 등록', 300_000)
  const j = (await res.json()) as { voice_id?: string }
  if (!j.voice_id) throw new AiError('elevenlabs', 'server', 'ElevenLabs 가 목소리 id 를 돌려주지 않았어요.')
  return j.voice_id
}

/** 지난 목소리 지우기 (등록 개수 한도가 있어서). 실패해도 진행한다 */
async function remove(voiceId: string) {
  try {
    await call(`/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' }, '목소리 삭제', 30_000)
  } catch (e) {
    console.warn('[elevenlabs] 지난 목소리를 지우지 못했어요:', e instanceof Error ? e.message : e)
  }
}

type Voice = { voice_id: string; name: string; category?: string; labels?: Record<string, string>; description?: string }
let premade: Voice[] | null = null

/** 기본 목소리 이름 → voice_id.
    ELEVENLABS_PRESET_VOICES='{"맑은 여성":"<voice_id>", …}' 로 직접 지정할 수 있고, 없으면 업체 기본 목소리 중
    성별이 맞는 것을 설명(hint)과 가장 많이 겹치는 순서로 고른다. */
async function preset(label: string) {
  const preset = VOICE_PRESETS.find((p) => p.label === label)
  if (!preset) throw new AiError('elevenlabs', 'bad_request', `모르는 기본 목소리예요: ${label || '(없음)'}. 모델 화면에서 목소리를 골라 주세요.`)
  try {
    const map = JSON.parse(process.env.ELEVENLABS_PRESET_VOICES || '{}') as Record<string, string>
    if (map[label]) return map[label]
  } catch {
    /* 형식이 틀리면 자동 선택 */
  }
  if (!premade) {
    const res = await call('/voices', { method: 'GET' }, '기본 목소리 목록', 30_000)
    const j = (await res.json()) as { voices?: Voice[] }
    premade = (j.voices ?? []).filter((v) => !v.category || v.category === 'premade')
  }
  const sameGender = premade.filter((v) => (v.labels?.gender ?? '').toLowerCase() === preset.gender)
  if (!sameGender.length) throw new AiError('elevenlabs', 'model', '쓸 수 있는 ElevenLabs 기본 목소리를 찾지 못했어요. ELEVENLABS_PRESET_VOICES 로 직접 지정해 주세요.')
  // 같은 성별 프리셋을 순서대로 하나씩, 아직 안 쓴 목소리 중 설명이 가장 많이 겹치는 것에 짝짓는다
  // (프리셋끼리 같은 목소리가 되지 않게. 목소리 수가 모자라면 돌려 쓴다)
  const desc = (v: Voice) => JSON.stringify([v.labels, v.description]).toLowerCase()
  const pool = [...sameGender].sort((a, b) => a.name.localeCompare(b.name))
  const used = new Set<string>()
  for (const p of VOICE_PRESETS.filter((x) => x.gender === preset.gender)) {
    const words = p.hint.split(' ')
    const free = pool.filter((v) => !used.has(v.voice_id))
    const candidates = free.length ? free : pool
    const best = candidates.reduce((a, b) => (words.filter((w) => desc(b).includes(w)).length > words.filter((w) => desc(a).includes(w)).length ? b : a))
    if (p === preset) return best.voice_id
    used.add(best.voice_id)
  }
  return pool[0].voice_id
}

async function speak(voiceId: string, text: string) {
  const res = await call(
    `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
    },
    '내레이션 합성',
  )
  return new Uint8Array(await res.arrayBuffer())
}

export const elevenlabs: VoiceProvider = { name: 'elevenlabs', label: 'ElevenLabs', clone, remove, preset, speak }
