import { cacheLife } from 'next/cache'

/* 마케팅 콘솔(apps/marketing)의 공개 모델 한줄 소개.
   서비스끼리 코드·DB 를 공유하지 않아서 콘솔의 공개 API(GET /api/public/models)를 HTTP 로 읽는다.
   MARKETING_CONSOLE_URL 이 없거나 부르기 실패하면 빈 값 — 페이지는 코드에 적어 둔 문구로 보인다.
   1분 남짓 캐시한다(콘솔에서 고치면 잠시 뒤 반영). */

export const TAGLINE_MAX = 100

export async function marketingTaglines(): Promise<Record<string, string>> {
  'use cache'
  cacheLife('minutes')
  const base = process.env.MARKETING_CONSOLE_URL?.trim().replace(/\/$/, '')
  if (!base) return {}
  try {
    const res = await fetch(`${base}/api/public/models`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { models?: { id?: unknown; tagline?: unknown }[] }
    const out: Record<string, string> = {}
    for (const m of json.models ?? []) {
      if (typeof m.id === 'string' && typeof m.tagline === 'string' && m.tagline.trim()) out[m.id] = m.tagline.trim().slice(0, TAGLINE_MAX)
    }
    return out
  } catch (e) {
    console.error('[marketing-models] 콘솔 공개 API 를 읽지 못했어요:', e instanceof Error ? e.message : e)
    return {}
  }
}
