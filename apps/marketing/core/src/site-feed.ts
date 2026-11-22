/* 고객사 홈페이지 자료 피드.
   우리가 만들어 준 고객사 사이트마다 읽기 전용 API 하나(GET, JSON)를 두고, 숏폼·배너를 만들기 직전에
   워커가 불러 프롬프트 참고 자료로 쓴다. 크롤링이 아니라 사이트가 정리해서 내보내는 데이터라
   화면 구조가 바뀌어도 깨지지 않는다. 형식은 SITE_FEED_EXAMPLE 하나로 통일한다(사이트가 늘어도 이쪽 코드는 그대로).

   불러오지 못하면 마지막으로 받은 자료(stores.site_feed_cache)로 대신하고, 그것도 없으면 자료 없이 만든다.
   자료가 없다고 생성이 실패하지는 않는다. */

export type SiteFeedItem = {
  name: string
  description?: string
  price?: string
  imageUrl?: string
  url?: string
  tags?: string[]
}

export type SiteFeed = {
  version: 1
  site?: { name?: string; description?: string; url?: string }
  /** 상품·메뉴·서비스 */
  items: SiteFeedItem[]
  /** 이벤트·공지·프로모션 */
  notices?: { title: string; body?: string }[]
}

/** 고객사 사이트가 돌려줄 응답 예시 (문서·화면 안내용) */
export const SITE_FEED_EXAMPLE: SiteFeed = {
  version: 1,
  site: { name: '숨카페 홍대점', description: '직접 로스팅한 원두와 수제 디저트', url: 'https://example.com' },
  items: [
    { name: '시그니처 라떼', description: '흑당 크림을 올린 라떼', price: '6,500원', imageUrl: 'https://example.com/latte.jpg', tags: ['인기'] },
  ],
  notices: [{ title: '11월 한정 딸기 케이크', body: '주말 한정 수량' }],
}

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 8000

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

/** 들어온 JSON 을 SiteFeed 모양으로 정리한다. 모르는 칸은 버리고, 개수·길이를 자른다. */
export function parseSiteFeed(raw: unknown): SiteFeed {
  if (!raw || typeof raw !== 'object') throw new Error('응답이 JSON 객체가 아니에요.')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.items)) throw new Error('응답에 items 배열이 없어요. 형식 예시를 확인해 주세요.')
  const items: SiteFeedItem[] = []
  for (const it of r.items.slice(0, 100)) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const name = str(o.name, 120)
    if (!name) continue
    items.push({
      name,
      description: str(o.description, 400) || undefined,
      price: str(o.price, 40) ?? (typeof o.price === 'number' ? String(o.price) : undefined),
      imageUrl: str(o.imageUrl, 1000) || undefined,
      url: str(o.url, 1000) || undefined,
      tags: Array.isArray(o.tags) ? o.tags.map((t) => str(t, 30)).filter((t): t is string => !!t).slice(0, 10) : undefined,
    })
  }
  const s = r.site && typeof r.site === 'object' ? (r.site as Record<string, unknown>) : undefined
  const notices: { title: string; body?: string }[] = []
  for (const n of Array.isArray(r.notices) ? r.notices.slice(0, 20) : []) {
    if (!n || typeof n !== 'object') continue
    const o = n as Record<string, unknown>
    const title = str(o.title, 120)
    if (title) notices.push({ title, body: str(o.body, 400) || undefined })
  }
  return {
    version: 1,
    site: s ? { name: str(s.name, 120) || undefined, description: str(s.description, 600) || undefined, url: str(s.url, 1000) || undefined } : undefined,
    items,
    notices: notices.length ? notices : undefined,
  }
}

export function checkFeedUrl(url: string) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return '자료 주소는 https:// 로 시작해야 해요.'
    return null
  } catch {
    return '자료 주소 형식이 올바르지 않아요.'
  }
}

/** 사이트 API 를 부른다. 실패하면 사람이 읽을 수 있는 이유를 담아 throw 한다. */
export async function fetchSiteFeed(url: string, token?: string | null): Promise<SiteFeed> {
  const bad = checkFeedUrl(url)
  if (bad) throw new Error(bad)
  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError'
    throw new Error(timeout ? `홈페이지 자료 API 가 ${TIMEOUT_MS / 1000}초 안에 응답하지 않았어요.` : `홈페이지 자료 API 에 연결하지 못했어요 (${e instanceof Error ? e.message : String(e)}).`)
  }
  if (res.status === 401 || res.status === 403) throw new Error(`홈페이지 자료 API 가 접근을 거부했어요 (${res.status}). 토큰을 확인해 주세요.`)
  if (!res.ok) throw new Error(`홈페이지 자료 API 가 오류를 돌려줬어요 (${res.status}).`)
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error('홈페이지 자료가 너무 커요 (1MB 초과). 상품 수를 줄여 내보내 주세요.')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('홈페이지 자료 API 응답이 JSON 이 아니에요.')
  }
  return parseSiteFeed(json)
}

/** 프롬프트에 넣을 요약 글. max 글자 안으로 앞에서부터 채운다(공지 → 상품 순). */
export function siteFeedBrief(feed: SiteFeed, max = 1200) {
  const lines: string[] = []
  if (feed.site?.description) lines.push(`홈페이지 소개: ${feed.site.description}`)
  for (const n of feed.notices ?? []) lines.push(`진행 중: ${n.title}${n.body ? ` — ${n.body}` : ''}`)
  for (const it of feed.items) {
    const bits = [it.name, it.price, it.description, it.tags?.length ? `#${it.tags.join(' #')}` : ''].filter(Boolean)
    lines.push(`상품: ${bits.join(' · ')}`)
  }
  let out = ''
  for (const l of lines) {
    if (out.length + l.length + 1 > max) break
    out += (out ? '\n' : '') + l
  }
  return out
}

/** 콘텐츠 settings 에 남기는 "어떤 자료로 만들었는지" 기록 */
export type SiteFeedUse = {
  /** live = 방금 불러옴, cache = 불러오지 못해 지난 자료 사용, none = 자료 없음 */
  source: 'live' | 'cache' | 'none'
  /** api = 자료 API, homepage = 홈페이지 페이지 글 (없으면 api) */
  via?: 'api' | 'homepage'
  fetchedAt?: string
  items?: number
  error?: string
}
