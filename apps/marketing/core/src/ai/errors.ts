/* AI 업체(OpenAI 이미지 · Runway 영상 · ElevenLabs 목소리) 에러를 종류별로 나눠 사람이 할 일을 알려 주는 문구로 바꾼다.

   - 문구는 "[종류] 설명" 형태로 jobs.error · contents.error 에 저장된다. 콘솔은 앞의 [종류] 를 읽어
     결제 링크 같은 안내를 붙인다(aiErrorInfo). 저장소가 나뉘어도 문자열만 맞으면 된다.
   - retryable=false(크레딧·키·정책·잘못된 요청)는 워커가 다시 시도하지 않는다 — 다시 해도 같은 이유로 실패하고
     요청마다 시간만 쓴다. 요청 한도·업체 장애·네트워크는 30초 뒤 한 번 더 시도한다. */

export type AiProvider = 'openai' | 'runway' | 'elevenlabs' | 'qwen'
export type AiErrorKind = 'billing' | 'rate_limit' | 'auth' | 'policy' | 'model' | 'bad_request' | 'server' | 'network'

const TAG: Record<AiErrorKind, string> = {
  billing: '크레딧 부족',
  rate_limit: '요청 한도',
  auth: 'API 키',
  policy: '콘텐츠 정책',
  model: '모델',
  bad_request: '요청 오류',
  server: '업체 장애',
  network: '연결 실패',
}

const NAME: Record<AiProvider, string> = { openai: 'OpenAI', runway: 'Runway', elevenlabs: 'ElevenLabs', qwen: 'Qwen3-TTS 음성 서버' }

export const BILLING_URL: Partial<Record<AiProvider, string>> = {
  openai: 'https://platform.openai.com/settings/organization/billing/overview',
  runway: 'https://dev.runwayml.com/',
  elevenlabs: 'https://elevenlabs.io/app/subscription',
}

export class AiError extends Error {
  constructor(
    readonly provider: AiProvider,
    readonly kind: AiErrorKind,
    detail: string,
    readonly status?: number,
  ) {
    super(`[${TAG[kind]}] ${detail}`)
    this.name = 'AiError'
  }
  get retryable() {
    return this.kind === 'rate_limit' || this.kind === 'server' || this.kind === 'network'
  }
}

/** 다시 시도해도 소용없는 에러인지 (워커용). AiError 가 아니면 다시 시도한다. */
export function isFatalAiError(e: unknown) {
  return e instanceof Error && e.name === 'AiError' && (e as AiError).retryable === false
}

function bodyText(raw: string) {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; code?: string; type?: string } | string; message?: string; detail?: { status?: string; message?: string } | string }
    if (typeof j.error === 'string') return { message: j.error, code: '' }
    // ElevenLabs: { detail: { status, message } } 또는 { detail: "..." }
    if (j.detail) return typeof j.detail === 'string' ? { message: j.detail, code: '' } : { message: j.detail.message ?? raw.slice(0, 300), code: j.detail.status ?? '' }
    return { message: j.error?.message ?? j.message ?? raw.slice(0, 300), code: `${j.error?.code ?? ''} ${j.error?.type ?? ''}` }
  } catch {
    return { message: raw.slice(0, 300), code: '' }
  }
}

/** OpenAI 이미지 API 실패 응답 → AiError */
export function openAiError(status: number, raw: string, what: string): AiError {
  const { message, code } = bodyText(raw)
  const s = `${code} ${message}`.toLowerCase()
  const p: AiProvider = 'openai'
  if (/insufficient_quota|billing_hard_limit|exceeded your current quota|billing|credit/.test(s))
    return new AiError(p, 'billing', `OpenAI 크레딧(사용 한도)이 부족해서 이미지를 만들지 못했어요 (${what}). OpenAI Billing 에서 충전하거나 사용 한도를 올려 주세요.`, status)
  if (status === 429) return new AiError(p, 'rate_limit', `OpenAI 요청이 한꺼번에 몰려 잠시 막혔어요. 잠시 뒤 자동으로 다시 시도해요.`, status)
  if (status === 401) return new AiError(p, 'auth', 'OpenAI API 키가 올바르지 않아요. worker/.env.local 의 OPENAI_API_KEY 를 확인해 주세요.', status)
  if (/must be verified|verify your organization|organization verification/.test(s))
    return new AiError(p, 'auth', 'OpenAI 조직 인증(Verify Organization)이 필요한 모델이에요. OpenAI 설정 → General 에서 인증해 주세요.', status)
  if (status === 403) return new AiError(p, 'auth', `OpenAI 가 이 키의 접근을 막았어요: ${message}`, status)
  if (/moderation|safety|content_policy|content policy/.test(s))
    return new AiError(p, 'policy', `OpenAI 안전 기준에 걸려 이미지를 만들지 못했어요 (${what}). 프롬프트나 참고 이미지(노출·실존 유명인·로고 등)를 바꿔 다시 시도해 주세요.`, status)
  if (status === 404 || /model_not_found|does not exist/.test(s))
    return new AiError(p, 'model', `OpenAI 이미지 모델을 쓸 수 없어요 (${message}). worker/.env.local 의 OPENAI_IMAGE_MODEL 을 확인해 주세요.`, status)
  if (status >= 500) return new AiError(p, 'server', `OpenAI 서버에 문제가 있어요 (${status}). 잠시 뒤 다시 시도해요.`, status)
  return new AiError(p, 'bad_request', `${what}에 실패했어요: ${message}`, status)
}

/** Runway API 실패 응답 → AiError */
export function runwayError(status: number, raw: string, what: string): AiError {
  const { message } = bodyText(raw)
  const s = message.toLowerCase()
  const p: AiProvider = 'runway'
  if (/credit|insufficient|billing|balance|payment/.test(s))
    return new AiError(p, 'billing', `Runway 크레딧이 부족해서 영상을 만들지 못했어요 (${what}). Runway 개발자 콘솔에서 크레딧을 충전해 주세요.`, status)
  if (status === 429) return new AiError(p, 'rate_limit', 'Runway 동시 작업 한도에 걸렸어요. 잠시 뒤 자동으로 다시 시도해요.', status)
  if (status === 401 || status === 403) return new AiError(p, 'auth', 'Runway API 키가 올바르지 않아요. worker/.env.local 의 RUNWAY_API_KEY 를 확인해 주세요.', status)
  if (/safety|moderation|content/.test(s)) return new AiError(p, 'policy', `Runway 안전 기준에 걸렸어요. 첫 장면 이미지나 프롬프트를 바꿔 주세요. (${message})`, status)
  if (/model/.test(s) && status === 400) return new AiError(p, 'model', `Runway 모델 설정이 맞지 않아요 (${message}). RUNWAY_MODEL 을 확인해 주세요.`, status)
  if (status >= 500) return new AiError(p, 'server', `Runway 서버에 문제가 있어요 (${status}). 잠시 뒤 다시 시도해요.`, status)
  return new AiError(p, 'bad_request', `${what}에 실패했어요: ${message}`, status)
}

/** Runway 작업이 FAILED 로 끝났을 때 (failureCode 예: SAFETY.INPUT.IMAGE, INTERNAL.BAD_OUTPUT) */
export function runwayTaskError(failure: string | undefined, code: string | undefined): AiError {
  const c = (code ?? '').toUpperCase()
  const detail = failure || code || '이유를 알려 주지 않았어요'
  if (c.startsWith('SAFETY') || /safety|moderation/i.test(detail))
    return new AiError('runway', 'policy', `Runway 안전 기준에 걸려 영상을 만들지 못했어요. 첫 장면 이미지나 프롬프트를 바꿔 주세요. (${detail})`)
  if (/credit|insufficient/i.test(detail)) return new AiError('runway', 'billing', `Runway 크레딧이 부족해요. 충전한 뒤 다시 생성해 주세요. (${detail})`)
  if (c.startsWith('INTERNAL') || c.includes('THROTTLED')) return new AiError('runway', 'server', `Runway 쪽 문제로 영상을 만들지 못했어요. 다시 시도해요. (${detail})`)
  return new AiError('runway', 'bad_request', `영상 생성에 실패했어요: ${detail}`)
}

/** ElevenLabs 실패 응답 → AiError (크레딧 소진도 401 로 온다) */
export function elevenLabsError(status: number, raw: string, what: string): AiError {
  const { message, code } = bodyText(raw)
  const s = `${code} ${message}`.toLowerCase()
  const p: AiProvider = 'elevenlabs'
  if (/quota_exceeded|insufficient|credits|payment_required|subscription/.test(s) || status === 402)
    return new AiError(p, 'billing', `ElevenLabs 크레딧(글자 수)이 부족해서 목소리를 만들지 못했어요 (${what}). ElevenLabs 구독·크레딧을 확인해 주세요.`, status)
  if (/can_not_use_instant_voice_cloning|voice_cloning|not available on your plan|upgrade/.test(s))
    return new AiError(p, 'billing', `지금 ElevenLabs 요금제로는 녹음 목소리 등록(보이스 클로닝)을 쓸 수 없어요. Starter 이상 요금제가 필요해요.`, status)
  if (/voice_limit_reached|maximum amount of custom voices/.test(s))
    return new AiError(p, 'billing', 'ElevenLabs 에 등록할 수 있는 목소리 개수를 다 썼어요. 쓰지 않는 목소리를 지우거나 요금제를 올려 주세요.', status)
  if (status === 401 || /invalid_api_key/.test(s)) return new AiError(p, 'auth', 'ElevenLabs API 키가 올바르지 않아요. worker/.env.local 의 ELEVENLABS_API_KEY 를 확인해 주세요.', status)
  if (status === 429 || /too_many_concurrent|system_busy|rate/.test(s)) return new AiError(p, 'rate_limit', 'ElevenLabs 요청이 몰려 잠시 막혔어요. 잠시 뒤 자동으로 다시 시도해요.', status)
  if (/unusual_activity|safety|moderation|violat/.test(s)) return new AiError(p, 'policy', `ElevenLabs 가 이 요청을 막았어요 (${message}). 녹음 파일이나 대본을 바꿔 주세요.`, status)
  if (status === 404 && /voice/.test(s)) return new AiError(p, 'model', 'ElevenLabs 에서 이 목소리를 찾지 못했어요. 모델 화면에서 목소리를 다시 등록해 주세요.', status)
  if (status >= 500) return new AiError(p, 'server', `ElevenLabs 서버에 문제가 있어요 (${status}). 잠시 뒤 다시 시도해요.`, status)
  return new AiError(p, 'bad_request', `${what}에 실패했어요: ${message}`, status)
}

/** 자체 Qwen3-TTS 음성 서버(voice-server/) 실패 응답 → AiError. 크레딧 개념은 없고 서버·GPU 문제가 대부분이다 */
export function qwenError(status: number, raw: string, what: string): AiError {
  const { message } = bodyText(raw)
  const p: AiProvider = 'qwen'
  if (status === 401 || status === 403) return new AiError(p, 'auth', '음성 서버 토큰이 맞지 않아요. worker/.env.local 의 QWEN_TTS_TOKEN 과 서버의 VOICE_SERVER_TOKEN 을 맞춰 주세요.', status)
  if (status === 400 || status === 422) return new AiError(p, 'bad_request', `${what}에 실패했어요: ${message}`, status)
  if (/out of memory|cuda/i.test(message)) return new AiError(p, 'server', `음성 서버 GPU 메모리가 부족해요 (${message}). 잠시 뒤 다시 시도해요.`, status)
  return new AiError(p, 'server', `음성 서버에 문제가 있어요 (${status}: ${message}). 서버가 켜져 있는지 확인해 주세요. 잠시 뒤 다시 시도해요.`, status)
}

/** fetch 자체가 실패했을 때 (DNS·연결 끊김·시간 초과) */
export function networkError(provider: AiProvider, e: unknown): AiError {
  const msg = e instanceof Error ? e.message : String(e)
  const hint = provider === 'qwen' ? '음성 서버가 켜져 있는지, worker/.env.local 의 QWEN_TTS_URL 이 맞는지 확인해 주세요.' : '인터넷 연결을 확인해 주세요.'
  return new AiError(provider, 'network', `${NAME[provider]}에 연결하지 못했어요 (${msg}). ${hint} 잠시 뒤 다시 시도해요.`)
}

/* ───────── 콘솔 표시용 ───────── */

export type AiErrorInfo = { kind: AiErrorKind; title: string; action?: { label: string; href: string } }

const TITLE: Record<AiErrorKind, string> = {
  billing: 'AI 크레딧이 부족해요',
  rate_limit: 'AI 요청 한도에 걸렸어요',
  auth: 'AI API 키 문제예요',
  policy: 'AI 안전 기준에 걸렸어요',
  model: 'AI 모델 설정 문제예요',
  bad_request: 'AI 요청이 거절됐어요',
  server: 'AI 업체 서버 문제예요',
  network: 'AI 업체에 연결하지 못했어요',
}

/** 저장된 에러 문구에서 종류를 읽는다. AI 에러가 아니면 null */
export function aiErrorInfo(message: string | null | undefined): AiErrorInfo | null {
  if (!message) return null
  const m = /\[([^\]]+)\]/.exec(message)
  if (!m) return null
  const kind = (Object.keys(TAG) as AiErrorKind[]).find((k) => TAG[k] === m[1])
  if (!kind) return null
  const provider: AiProvider | null = /runway/i.test(message) ? 'runway' : /elevenlabs/i.test(message) ? 'elevenlabs' : /openai/i.test(message) ? 'openai' : null
  const href = provider ? BILLING_URL[provider] : undefined
  const action = kind === 'billing' && provider && href ? { label: `${NAME[provider]} 충전하러 가기`, href } : undefined
  return { kind, title: TITLE[kind], action }
}
