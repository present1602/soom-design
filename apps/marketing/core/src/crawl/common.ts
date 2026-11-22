/* 크롤링 테스트 공용: 결과 형식 · 헬퍼 · 헤드리스 크롬.

   소스(네이버 플레이스·카카오맵·당근·홈페이지·인스타)마다 가져오는 방법은 달라도 결과는 이 형식 하나로 맞춘다.
   화면은 비어 있는 구역을 숨기기만 하면 된다.

   같은 소스라도 업종·매장마다 칸이 다르다(음식점은 메뉴, 미용실은 가격·스타일, 어떤 매장은 소식이 없다).
   그래서 정해진 경로 하나만 믿지 않고 ① 알려진 경로 ② 데이터 전체를 훑어 모양으로 찾기 ③ og·JSON-LD 같은
   웹 표준 정보 순서로 시도하고, 못 찾은 칸은 오류 대신 빈 칸으로 둔다. 무엇을 못 찾았는지는 notes 에 남긴다. */
import type { Browser, BrowserContext } from 'playwright-core'

export type SourceKind = 'naver_place' | 'kakao_place' | 'daangn' | 'instagram' | 'smartstore' | 'homepage'

export type CrawlPhoto = {
  url: string
  thumb: string
  width: number | null
  height: number | null
  source: string // business(업체) · placeReview(방문자) · clip · blog · page 등
  title: string | null
  date: string | null
  author: string | null
  videoUrl: string | null
  link: string | null
}
export type CrawlMenu = { name: string; price: string | null; description: string | null; images: string[]; recommend: boolean; group: string | null }
export type CrawlReview = { body: string; author: string | null; date: string | null; images: string[]; keywords: string[]; rating?: number | null; url?: string | null }
export type CrawlNews = { title: string; body: string | null; category: string | null; period: string | null; when: string | null; images: string[]; url: string | null; isVideo: boolean }
export type CrawlBriefing = { sentence: string; sources: { snippet: string; author: string | null; url: string | null; date: string | null }[] }
export type CrawlCoupon = { title: string; description: string | null; period: string | null; image: string | null }
export type CrawlStyle = { title: string; image: string | null; tags: string[] }
export type CrawlHours = { day: string; open: string | null; close: string | null; breaks: string[]; note: string | null }
export type CrawlLink = { url: string; type: string | null }
export type CrawlText = { title: string | null; body: string; url: string | null }

export type CrawlResult = {
  kind: SourceKind
  id: string | null
  inputUrl: string
  pageUrl: string
  /** 업종 등 소스가 붙인 분류(네이버는 restaurant·hairshop 같은 경로 이름) */
  businessType: string | null
  name: string
  category: string | null
  description: string | null
  address: string | null
  roadAddress: string | null
  directions: string | null
  phone: string | null
  coord: { lat: number; lng: number } | null
  /** 홈페이지·SNS·블로그 등 이 소스가 알려 준 다른 주소 — "이 링크도 가져오기" 후보 */
  links: CrawlLink[]
  keywords: string[]
  conveniences: string[]
  payments: string[]
  parking: string | null
  hoursStatus: string | null
  hours: CrawlHours[]
  menus: CrawlMenu[]
  /** 메뉴판 사진 */
  menuBoards: string[]
  /** 플랫폼이 리뷰로 만든 AI 요약 */
  briefing: CrawlBriefing[]
  photos: CrawlPhoto[]
  photoTotal: number | null
  styles: CrawlStyle[]
  reviewTotal: number | null
  reviewScore: number | null
  reviewKeywords: { name: string; count: number; icon: string | null }[]
  reviews: CrawlReview[]
  news: CrawlNews[]
  coupons: CrawlCoupon[]
  transit: string[]
  /** 그 밖의 한 줄 정보(팔로워 수·사업자번호·이메일 등) */
  facts: { label: string; value: string }[]
  /** 홈페이지 본문 글(페이지별) */
  texts: CrawlText[]
  /** 못 가져온 것·알아 둘 것 */
  notes: string[]
  /** 어떤 요청을 몇 번 가로챘는지 / 어떤 방법으로 찾았는지 */
  ops: { name: string; count: number }[]
  raw: unknown
  steps: { tab: string; ms: number; ok: boolean; note?: string }[]
  elapsedMs: number
}

export function emptyResult(kind: SourceKind, inputUrl: string): CrawlResult {
  return {
    kind,
    id: null,
    inputUrl,
    pageUrl: inputUrl,
    businessType: null,
    name: '(이름 없음)',
    category: null,
    description: null,
    address: null,
    roadAddress: null,
    directions: null,
    phone: null,
    coord: null,
    links: [],
    keywords: [],
    conveniences: [],
    payments: [],
    parking: null,
    hoursStatus: null,
    hours: [],
    menus: [],
    menuBoards: [],
    briefing: [],
    photos: [],
    photoTotal: null,
    styles: [],
    reviewTotal: null,
    reviewScore: null,
    reviewKeywords: [],
    reviews: [],
    news: [],
    coupons: [],
    transit: [],
    facts: [],
    texts: [],
    notes: [],
    ops: [],
    raw: null,
    steps: [],
    elapsedMs: 0,
  }
}

/* ---------- 헬퍼 ---------- */
export type Obj = Record<string, unknown>
export const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
export const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
export const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v && !isNaN(+v) ? +v : null)
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** 객체 트리를 돌며 모든 객체에 fn 을 부른다 */
export function walk(v: unknown, fn: (o: Obj) => void, depth = 0) {
  if (depth > 14) return
  if (Array.isArray(v)) v.forEach((x) => walk(x, fn, depth + 1))
  else if (isObj(v)) {
    fn(v)
    for (const x of Object.values(v)) walk(x, fn, depth + 1)
  }
}

/** 트리에서 조건에 맞는 첫 객체 */
export function findObj(v: unknown, test: (o: Obj) => boolean): Obj | null {
  let hit: Obj | null = null
  walk(v, (o) => {
    if (!hit && test(o)) hit = o
  })
  return hit
}

export const errText = (e: unknown) => (e instanceof Error ? e.message.split('\n')[0] : String(e))

/** 같은 주소는 한 번만 */
export function uniqBy<T>(list: T[], key: (x: T) => string) {
  const seen = new Set<string>()
  return list.filter((x) => {
    const k = key(x)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 알려진 SNS·플랫폼 주소의 이름 */
export function linkType(url: string): string | null {
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return '인스타그램'
  if (u.includes('blog.naver.com')) return '네이버 블로그'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return '유튜브'
  if (u.includes('pf.kakao.com')) return '카카오톡 채널'
  if (u.includes('place.map.kakao.com') || u.includes('map.kakao.com')) return '카카오맵'
  if (u.includes('map.naver.com') || u.includes('naver.me') || u.includes('place.naver.com')) return '네이버 플레이스'
  if (u.includes('daangn.com')) return '당근'
  if (u.includes('smartstore.naver.com')) return '스마트스토어'
  if (u.includes('facebook.com')) return '페이스북'
  if (u.includes('tiktok.com')) return '틱톡'
  if (u.includes('threads.net') || u.includes('threads.com')) return '스레드'
  return null
}

/* ---------- 헤드리스 크롬 ---------- */
export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

export async function launch(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  // 자동화 표시(navigator.webdriver)가 켜져 있으면 네이버 GraphQL 이 405 로 막는다
  const args = ['--disable-blink-features=AutomationControlled']
  try {
    return await chromium.launch({ headless: true, args })
  } catch (e) {
    // 짝이 맞는 헤드리스 크롬이 없으면 설치된 크롬으로
    try {
      return await chromium.launch({ headless: true, channel: 'chrome', args })
    } catch {
      throw new Error(
        '헤드리스 크롬을 찾지 못했어요. apps/marketing/console 에서 `pnpm exec playwright-core install chromium-headless-shell` 을 한 번 돌려 주세요. (' + errText(e) + ')',
      )
    }
  }
}

/** 사람 브라우저처럼 보이는 창. mobile 이면 아이폰, 아니면 데스크톱(헤드리스 표시를 뺀 실제 크롬 UA) */
export async function newContext(browser: Browser, opts: { mobile: boolean; blockMedia?: boolean }): Promise<BrowserContext> {
  let ua = MOBILE_UA
  if (!opts.mobile) {
    const p = await browser.newPage()
    ua = (await p.evaluate(() => navigator.userAgent)).replace('HeadlessChrome', 'Chrome')
    await p.close()
  }
  const ctx = await browser.newContext(
    opts.mobile
      ? { userAgent: ua, locale: 'ko-KR', viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { userAgent: ua, locale: 'ko-KR', viewport: { width: 1280, height: 900 } },
  )
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  if (opts.blockMedia) {
    // 이미지·폰트·영상은 받지 않는다(주소만 있으면 된다) — 훨씬 빨라진다
    await ctx.route('**/*', (route) => {
      const t = route.request().resourceType()
      return t === 'image' || t === 'media' || t === 'font' ? route.abort() : route.continue()
    })
  }
  return ctx
}

/** 브라우저 없이 HTML·JSON 을 받는다(당근·카카오처럼 데이터가 바로 오는 곳) */
export async function fetchText(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': MOBILE_UA.replace('iPhone; CPU iPhone OS 18_0 like Mac OS X', 'Macintosh; Intel Mac OS X 10_15_7'), 'accept-language': 'ko-KR,ko;q=0.9', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  })
  return { status: res.status, url: res.url, text: await res.text() }
}

/** HTML 의 JSON-LD 블록들 */
export function jsonLd(html: string): Obj[] {
  const out: Obj[] = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim())
      for (const x of Array.isArray(v) ? v : [v]) {
        if (isObj(x) && Array.isArray(x['@graph'])) out.push(...(x['@graph'] as unknown[]).filter(isObj))
        else if (isObj(x)) out.push(x)
      }
    } catch {
      /* 깨진 JSON-LD 는 건너뛴다 */
    }
  }
  return out
}

/** og:·description 메타 */
export function metas(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0]
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]
    const val = tag.match(/content=["']([^"']*)["']/i)?.[1]
    if (key && val && !(key in out)) out[key.toLowerCase()] = decodeEntities(val)
  }
  return out
}

export function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
}

/** JSON-LD 의 LocalBusiness·Organization 에서 공통 칸을 채운다(이미 있는 칸은 두고 빈 칸만) */
export function fillFromLd(r: CrawlResult, lds: Obj[]) {
  const biz = lds.find((x) => /LocalBusiness|Organization|Store|Restaurant|Corporation|Place/i.test(String(x['@type'])))
  if (!biz) return
  if (r.name === '(이름 없음)' && str(biz.name)) r.name = str(biz.name)!
  r.description ??= str(biz.description)
  r.phone ??= str(biz.telephone)
  const addr = isObj(biz.address) ? biz.address : null
  if (addr && !r.roadAddress) r.roadAddress = [addr.addressRegion, addr.addressLocality, addr.streetAddress].map(str).filter(Boolean).join(' ') || null
  else if (typeof biz.address === 'string' && !r.roadAddress) r.roadAddress = biz.address
  const geo = isObj(biz.geo) ? biz.geo : null
  if (geo && !r.coord && num(geo.latitude) && num(geo.longitude)) r.coord = { lat: num(geo.latitude)!, lng: num(geo.longitude)! }
  if (str(biz.email)) r.facts.push({ label: '이메일', value: str(biz.email)! })
  if (str(biz.legalName)) r.facts.push({ label: '법인명', value: str(biz.legalName)! })
  for (const s of arr(biz.sameAs)) if (typeof s === 'string') r.links.push({ url: s, type: linkType(s) })
  if (isObj(biz.aggregateRating)) {
    r.reviewScore ??= num(biz.aggregateRating.ratingValue)
    r.reviewTotal ??= num(biz.aggregateRating.reviewCount)
  }
}
