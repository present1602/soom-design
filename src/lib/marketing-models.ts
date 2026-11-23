import { cacheLife } from 'next/cache'
import { marketingConsoleBase, photoAllowed } from './marketing-console'

/* 마케팅 콘솔(~/balance/repo apps/console)의 공개 모델 — 이름·한줄 소개·대표 사진.
   서비스끼리 코드·DB 를 공유하지 않아서 콘솔의 공개 API(GET /api/public/models)를 HTTP 로 읽는다.
   사진은 콘솔의 /api/public/models/<id>/photo?v=… 이고, 대표 사진을 바꾸면 v 가 바뀐다.
   MARKETING_CONSOLE_URL 이 없거나 부르기 실패하면 빈 값 — 페이지는 코드에 적어 둔 이름·문구·사진으로 보인다.
   1분 남짓 캐시한다(콘솔에서 고치면 잠시 뒤 반영). */

export const TAGLINE_MAX = 100

export type ConsoleModel = { name?: string; tagline?: string; photo?: string }

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export async function marketingModels(): Promise<Record<string, ConsoleModel>> {
  'use cache'
  cacheLife('minutes')
  const base = marketingConsoleBase()
  if (!base) return {}
  // 이미지 허용 목록(next.config)에 든 콘솔일 때만 사진을 쓴다 — 목록 밖 주소를 next/image 에 넘기면 페이지가 500 이 된다
  const photoOk = photoAllowed(base)
  try {
    const res = await fetch(`${base}/api/public/models`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { models?: { id?: unknown; name?: unknown; tagline?: unknown; photo?: unknown }[] }
    const out: Record<string, ConsoleModel> = {}
    for (const m of json.models ?? []) {
      if (typeof m.id !== 'string') continue
      const photo = str(m.photo)
      out[m.id] = {
        name: str(m.name)?.slice(0, 30),
        tagline: str(m.tagline)?.slice(0, TAGLINE_MAX),
        // 콘솔은 자기 기준 상대 주소를 준다 — 콘솔 주소를 붙여 둔다. 그 밖의 경로는 받지 않는다
        photo: photoOk && photo?.startsWith('/api/public/models/') ? `${base}${photo}` : undefined,
      }
    }
    return out
  } catch (e) {
    console.error('[marketing-models] 콘솔 공개 API 를 읽지 못했어요:', e instanceof Error ? e.message : e)
    return {}
  }
}
