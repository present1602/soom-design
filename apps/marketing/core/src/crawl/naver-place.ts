/* 네이버 지도 플레이스 크롤러 (테스트용).

   방식: 헤드리스 크롬으로 모바일 플레이스(m.place.naver.com) 탭을 차례로 열고,
   - 첫 화면 HTML 에 들어 있는 window.__APOLLO_STATE__ (기본 정보·메뉴·영업시간·대표 사진)와
   - 페이지가 스스로 부르는 api.place.naver.com/graphql 응답(사진 전체·리뷰·소식·쿠폰·스타일)을 가로채 모은다.
   GraphQL 을 서버에서 직접 부르면 봇 방지 토큰(x-wtm-ncaptcha-token)이 없어 429 가 난다 — 그래서 브라우저를 쓴다.

   네이버 화면 구조가 바뀌면 조용히 빈 칸이 된다. 화면에 "가로챈 요청" 목록과 원본 JSON 을 같이 보여 주는 이유. */
import type { Page } from 'playwright-core'
import {
  MOBILE_UA,
  arr,
  emptyResult,
  errText,
  isObj,
  launch,
  newContext,
  num,
  str,
  walk,
  type CrawlBriefing as PlaceBriefing,
  type CrawlCoupon as PlaceCoupon,
  type CrawlHours as PlaceHours,
  type CrawlMenu as PlaceMenu,
  type CrawlNews as PlaceNews,
  type CrawlPhoto as PlacePhoto,
  type CrawlResult,
  type CrawlReview as PlaceReview,
  type CrawlStyle as PlaceStyle,
  type Obj,
} from './common'

/** 지도 주소·모바일 주소·공유 주소(naver.me)·숫자 ID 에서 플레이스 ID 를 찾는다 */
export async function resolvePlaceId(input: string): Promise<string | null> {
  const s = input.trim()
  if (/^\d{5,}$/.test(s)) return s
  const fromUrl = (u: string) => u.match(/place\/(\d{5,})/)?.[1] ?? u.match(/[?&](?:id|placeId)=(\d{5,})/)?.[1] ?? u.match(/\/(?:restaurant|hairshop|nailshop|hospital|accommodation|place)\/(\d{5,})/)?.[1] ?? null
  const direct = fromUrl(s)
  if (direct) return direct
  // naver.me 단축 주소 → 따라가 본다
  if (/^https?:\/\/(naver\.me|m\.site\.naver\.com)\//.test(s)) {
    let url = s
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': MOBILE_UA } })
      const loc = res.headers.get('location')
      if (!loc) break
      url = new URL(loc, url).toString()
      const id = fromUrl(url)
      if (id) return id
    }
  }
  return null
}

/** Apollo 캐시의 {__ref} 를 풀어 준다 */
function deref(apollo: Obj, v: unknown, depth = 0): unknown {
  if (depth > 6) return v
  if (Array.isArray(v)) return v.map((x) => deref(apollo, x, depth + 1))
  if (isObj(v)) {
    if (typeof v.__ref === 'string') return deref(apollo, apollo[v.__ref], depth + 1)
    const o: Obj = {}
    for (const [k, x] of Object.entries(v)) o[k] = deref(apollo, x, depth + 1)
    return o
  }
  return v
}

/** ROOT_QUERY 의 키는 'placeDetail({"input":...})' 처럼 인자가 붙는다 — 앞 이름으로 찾는다 */
function rootField(root: Obj, name: string) {
  const k = Object.keys(root).find((x) => x === name || x.startsWith(name + '('))
  return k ? root[k] : undefined
}
function field(o: Obj, name: string) {
  return rootField(o, name)
}

/* ---------- 크롤 ---------- */
export async function crawlNaverPlace(inputUrl: string, opts: { maxPhotos?: number; maxReviews?: number } = {}): Promise<CrawlResult> {
  const started = Date.now()
  const id = await resolvePlaceId(inputUrl)
  if (!id) throw new Error('주소에서 플레이스 번호를 찾지 못했어요. map.naver.com/p/entry/place/숫자 형태의 주소를 넣어 주세요.')
  const maxPhotos = opts.maxPhotos ?? 120
  const maxReviews = opts.maxReviews ?? 30

  const graphql: Record<string, unknown[]> = {}
  const steps: CrawlResult['steps'] = []
  const browser = await launch()
  try {
    const ctx = await newContext(browser, { mobile: true, blockMedia: true })
    const page = await ctx.newPage()
    page.on('response', async (res) => {
      if (!res.url().includes('api.place.naver.com/graphql')) return
      try {
        const body = await res.json()
        const req = JSON.parse(res.request().postData() || '[]')
        const reqs = Array.isArray(req) ? req : [req]
        const bodies = Array.isArray(body) ? body : [body]
        reqs.forEach((q: Obj, i: number) => {
          const name = String(q.operationName ?? 'unknown')
          ;(graphql[name] ??= []).push(bodies[i])
        })
      } catch {
        /* 본문이 없는 응답(204 등) */
      }
    })

    // 탭마다 첫 화면 HTML 에 그 탭 몫의 Apollo 상태가 들어 있다(소식 본문은 소식 탭에만) → 모두 합친다
    const apollo: Obj = {}
    const grabApollo = async (p: Page) => {
      const st = (await p.evaluate(() => (window as unknown as { __APOLLO_STATE__?: unknown }).__APOLLO_STATE__).catch(() => null)) as Obj | null
      if (!isObj(st)) return
      for (const [k, v] of Object.entries(st)) {
        apollo[k] = isObj(apollo[k]) && isObj(v) ? { ...(apollo[k] as Obj), ...v } : v
      }
    }
    const visit = async (tab: string, after?: (p: Page) => Promise<void>) => {
      const t0 = Date.now()
      try {
        await page.goto(`https://m.place.naver.com/place/${id}/${tab}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await grabApollo(page)
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
        if (after) await after(page)
        steps.push({ tab, ms: Date.now() - t0, ok: true })
      } catch (e) {
        steps.push({ tab, ms: Date.now() - t0, ok: false, note: errText(e) })
      }
    }
    const scroll = async (p: Page, times: number, stop?: () => boolean) => {
      for (let i = 0; i < times; i++) {
        if (stop?.()) break
        await p.mouse.wheel(0, 3000)
        await p.waitForTimeout(700)
      }
    }

    // 1) 홈: 기본 정보
    await visit('home')
    const pageUrl = page.url()
    if (!Object.keys(apollo).length) {
      const html = await page.content()
      if (/captcha|비정상적인|일시적으로 제한/i.test(html)) throw new Error('네이버가 자동 접속으로 판단해 막았어요(캡차). 잠시 뒤 다시 시도해 주세요.')
      throw new Error('플레이스 정보를 읽지 못했어요. 없는 플레이스이거나 네이버 화면 구조가 바뀌었을 수 있어요.')
    }

    // 2) 사진 탭: 스크롤해서 더 불러온다
    const photoCount = () => collectPhotos(graphql).length
    await visit('photo', (p) => scroll(p, 12, () => photoCount() >= maxPhotos))
    // 3) 리뷰
    await visit('review/visitor', (p) => scroll(p, 3))
    // 4) 소식 (이벤트·공지)
    await visit('feed', (p) => scroll(p, 3))
    // 5) 메뉴/가격 — 업종마다 탭 이름이 다르다. 탭 목록에 있는 것만
    const pd = (rootField((apollo.ROOT_QUERY as Obj) ?? {}, 'placeDetail') as Obj) ?? {}
    const tabs = arr(pd.tabs).map((t) => (isObj(t) ? String(t.tabId) : ''))
    if (tabs.includes('menu')) await visit('menu/list')
    if (tabs.includes('price')) await visit('price')
    if (tabs.includes('styleInfo')) await visit('styleInfo', (p) => scroll(p, 2))

    const result = normalize({ id, inputUrl, pageUrl, apollo, graphql, maxPhotos, maxReviews })
    return { ...result, steps, elapsedMs: Date.now() - started }
  } finally {
    await browser.close().catch(() => {})
  }
}

/* ---------- 정리 ---------- */
function opData(graphql: Record<string, unknown[]>, name: string): Obj[] {
  return (graphql[name] ?? []).map((b) => (isObj(b) && isObj(b.data) ? b.data : {})).filter((d) => Object.keys(d).length)
}

function photoFrom(p: Obj): PlacePhoto | null {
  const url = str(p.originalUrl) ?? str(p.origin) ?? str(p.url)
  if (!url) return null
  const video = isObj(p.video) ? p.video : null
  const author = isObj(p.author) ? str(p.author.nickname) : null
  return {
    url,
    thumb: str(p.thumbnailUrl) ?? url,
    width: num(p.width),
    height: num(p.height),
    source: str(p.mediaSource) ?? str(p.originType) ?? (String(p.id ?? p.viewId ?? '').match(/_(business|style|clip|visitor|blog)_/)?.[1] ?? 'etc'),
    title: str(p.title),
    date: str(p.date),
    author,
    videoUrl: video ? (str(video.trailerUrl) ?? null) : null,
    link: str(p.linkUrl),
  }
}

function collectPhotos(graphql: Record<string, unknown[]>): PlacePhoto[] {
  const out: PlacePhoto[] = []
  const seen = new Set<string>()
  for (const d of opData(graphql, 'getPhotoViewerItems')) {
    const pv = isObj(d.photoViewer) ? d.photoViewer : {}
    for (const p of arr(pv.photos)) {
      if (!isObj(p)) continue
      const ph = photoFrom(p)
      if (ph && !seen.has(ph.url)) {
        seen.add(ph.url)
        out.push(ph)
      }
    }
  }
  return out
}

function normalize(a: { id: string; inputUrl: string; pageUrl: string; apollo: Obj; graphql: Record<string, unknown[]>; maxPhotos: number; maxReviews: number }): Omit<CrawlResult, 'steps' | 'elapsedMs'> {
  const { apollo, graphql } = a
  const root = (apollo.ROOT_QUERY as Obj) ?? {}
  const pd = (deref(apollo, rootField(root, 'placeDetail')) as Obj) ?? {}
  const base = (isObj(pd.base) ? pd.base : (deref(apollo, apollo[`PlaceDetailBase:${a.id}`]) as Obj)) ?? {}

  // 영업시간
  const nbh = arr(pd.newBusinessHours).find(isObj) as Obj | undefined
  const hours: PlaceHours[] = arr(nbh?.businessHours)
    .filter(isObj)
    .map((h) => {
      const bh = isObj(h.businessHours) ? h.businessHours : {}
      return {
        day: String(h.day ?? ''),
        open: str(bh.start),
        close: str(bh.end),
        breaks: arr(h.breakHours)
          .filter(isObj)
          .map((b) => `${b.start}~${b.end}`),
        note: str(h.description),
      }
    })
  const statusObj = nbh && isObj(nbh.businessStatusDescription) ? nbh.businessStatusDescription : null

  // 메뉴: 업종별로 칸이 다르다(menus · beautyMenus · Menu:* 엔터티). 모두 모아 이름으로 중복 제거
  const menus: PlaceMenu[] = []
  const seenMenu = new Set<string>()
  const pushMenu = (m: Obj, group: string | null) => {
    const name = str(m.name)
    const price = isObj(m.price) ? str(m.price.displayText) : (str(m.price) ?? (num(m.price) != null ? `${num(m.price)!.toLocaleString()}원` : null))
    if (!name || seenMenu.has(name + '|' + price)) return
    seenMenu.add(name + '|' + price)
    menus.push({
      name,
      price,
      description: str(m.description) ?? str(m.desc),
      images: arr(m.images)
        .map((x) => (typeof x === 'string' ? x : isObj(x) ? (str(x.url) ?? str(x.origin)) : null))
        .filter((x): x is string => !!x),
      recommend: !!m.recommend || arr(m.badges).length > 0 || arr(m.labels).some((l) => /대표|추천|인기/.test(JSON.stringify(l))),
      group,
    })
  }
  for (const g of arr(pd.beautyMenus)) if (isObj(g)) for (const m of arr(g.items)) if (isObj(m)) pushMenu(m, str(g.name))
  for (const m of arr(field(pd, 'menus'))) if (isObj(m)) pushMenu(m, null)
  const pm = field(pd, 'placeMenus')
  for (const m of arr(isObj(pm) ? pm.items : null)) if (isObj(m)) pushMenu(m, null)
  const menuBoards = arr(field(pd, 'menuImages'))
    .map((x) => (isObj(x) ? (str(x.imageUrl) ?? str(x.url)) : null))
    .filter((x): x is string => !!x)
  for (const [k, v] of Object.entries(apollo)) if (k.startsWith('Menu:') && isObj(v)) pushMenu(deref(apollo, v) as Obj, null)
  // 메뉴 탭에서 GraphQL 로 온 메뉴(음식점 등)
  for (const [name, list] of Object.entries(graphql)) {
    if (!/menu/i.test(name)) continue
    for (const b of list) walk(b, (o) => {
      if (str(o.name) && (o.price !== undefined) && (o.__typename === 'Menu' || 'priceType' in o || 'images' in o)) pushMenu(o, null)
    })
  }

  // 사진: 사진 탭에서 모은 것 + 홈 대표 사진(못 불렀을 때 대비)
  let photos = collectPhotos(graphql)
  const top = isObj(pd.topPhotos) ? pd.topPhotos : {}
  if (!photos.length) photos = arr(top.items).filter(isObj).map(photoFrom).filter((x): x is PlacePhoto => !!x)
  const imgs = isObj(pd.images) ? pd.images : {}
  photos = photos.slice(0, a.maxPhotos)

  // 스타일(뷰티 업종)
  const styles: PlaceStyle[] = []
  for (const d of opData(graphql, 'getBeautyStyles')) {
    walk(d, (o) => {
      if ('styleNum' in o && str(o.title) && !styles.some((s) => s.image === str(o.reprImage) && s.title === str(o.title))) {
        styles.push({
          title: str(o.title)!,
          image: str(o.reprImage),
          tags: (str(o.categoryString) ?? '').split(',').filter(Boolean),
        })
      }
    })
  }

  // 리뷰
  const statsObj = (isObj(pd.visitorReviewStats) ? pd.visitorReviewStats : {}) as Obj
  const voted = isObj(statsObj.analysis) && isObj(statsObj.analysis.votedKeyword) ? statsObj.analysis.votedKeyword : {}
  const reviewKeywords = arr(voted.details)
    .filter(isObj)
    .map((k) => ({ name: String(k.displayName ?? ''), count: num(k.count) ?? 0, icon: str(k.iconUrl) }))
  const reviews: PlaceReview[] = []
  const seenRv = new Set<string>()
  for (const d of opData(graphql, 'getVisitorReviews')) {
    const vr = isObj(d.visitorReviews) ? d.visitorReviews : {}
    for (const r of arr(vr.items)) {
      if (!isObj(r) || seenRv.has(String(r.id))) continue
      seenRv.add(String(r.id))
      reviews.push({
        body: str(r.body) ?? '',
        author: isObj(r.author) ? str(r.author.nickname) : null,
        date: str(r.visited) ?? str(r.created),
        images: arr(r.media)
          .filter(isObj)
          .map((m) => str(m.thumbnail) ?? str(m.url))
          .filter((x): x is string => !!x),
        keywords: arr(r.votedKeywords)
          .filter(isObj)
          .map((k) => String(k.name ?? '')),
      })
    }
  }

  // 소식(이벤트·공지) — 홈의 announcements + 소식 탭 피드
  const news: PlaceNews[] = []
  const seenNews = new Set<string>()
  const pushNews = (o: Obj) => {
    if (o.__typename !== 'Feed' && !('feedId' in o)) return
    if (o.isDeleted) return
    const title = str(o.title) ?? str(o.desc)?.split('\n')[0] ?? null
    const key = String(o.feedId ?? title)
    if (!title) return
    const th = isObj(o.thumbnail) ? o.thumbnail : null
    const media = arr(o.media).filter(isObj)
    const item: PlaceNews = {
      title,
      body: str(o.desc),
      category: str(o.categoryI18n) ?? str(o.category),
      period: str(o.period),
      when: str(o.relativeCreated) ?? str(o.createdString),
      images: media.length ? media.map((m) => str(m.thumbnail)).filter((x): x is string => !!x) : th && str(th.url) ? [str(th.url)!] : [],
      url: str(o.url),
      isVideo: media.some((m) => m.mediaType === 'VIDEO') || !!(th && th.isVideo),
    }
    // 같은 소식이 홈(요약)과 소식 탭(본문)에 둘 다 온다 — 본문이 있는 쪽을 남긴다
    const at = news.findIndex((n) => (n as PlaceNews & { _k?: string })._k === key)
    if (at >= 0) {
      if (!news[at].body && item.body) news[at] = Object.assign(item, { _k: key })
      return
    }
    seenNews.add(key)
    news.push(Object.assign(item, { _k: key }))
  }
  for (const [k, v] of Object.entries(apollo)) if (k.startsWith('Feed:') && isObj(v)) pushNews(deref(apollo, v) as Obj)
  for (const [name, list] of Object.entries(graphql)) {
    if (!/announce|feed|news/i.test(name)) continue
    for (const b of list) walk(b, pushNews)
  }
  news.forEach((n) => delete (n as PlaceNews & { _k?: string })._k)

  // AI 요약
  const briefing: PlaceBriefing[] = []
  for (const d of opData(graphql, 'getAiBriefing')) {
    if (briefing.length) break
    const ab = isObj(d.aiBriefing) ? d.aiBriefing : {}
    for (const t of arr(ab.textSummaries)) {
      if (!isObj(t) || !str(t.sentence)) continue
      briefing.push({
        sentence: str(t.sentence)!,
        sources: arr(t.relatedReviews)
          .filter(isObj)
          .map((r) => ({ snippet: str(r.snippet) ?? '', author: str(r.userName), url: str(r.blogUrl), date: str(r.createdDate) })),
      })
    }
  }

  // 쿠폰 (여러 탭에서 같은 응답이 반복된다 → 중복 제거)
  const coupons: PlaceCoupon[] = []
  const seenCoupon = new Set<string>()
  for (const d of opData(graphql, 'getUnifiedCoupons')) {
    const uc = isObj(d.unifiedCoupons) ? d.unifiedCoupons : {}
    for (const c of arr(uc.coupons)) {
      if (!isObj(c)) continue
      const key = String(c.couponSeq ?? c.promotionSeq ?? c.title)
      if (seenCoupon.has(key)) continue
      seenCoupon.add(key)
      coupons.push({
        title: str(c.title) ?? str(c.promotionTitle) ?? '쿠폰',
        description: str(c.description),
        period: str(c.expiredPeriodInfo) ?? str(c.expiredDateDescription),
        image: isObj(c.image) ? str(c.image.url) : null,
      })
    }
  }

  // 교통
  const transit: string[] = []
  for (const s of arr(pd.subwayStations)) {
    if (!isObj(s) || !isObj(s.station)) continue
    const st = s.station
    transit.push(`🚇 ${st.displayName ?? st.name} ${s.no ?? ''}${st.nearestExit ? ` ${st.nearestExit}번 출구` : ''}${st.walkingDistance ? ` · ${st.walkingDistance}m` : ''}`.trim())
  }
  for (const b of arr(pd.busStations).slice(0, 3)) {
    if (isObj(b)) transit.push(`🚌 ${b.name}${b.walkingDistance ? ` · ${b.walkingDistance}m` : ''}`)
  }

  const info = isObj(pd.informationTab) ? pd.informationTab : {}
  const hp = isObj(pd.homepages) ? pd.homepages : {}
  const homepages = [hp.repr, ...arr(hp.etc)]
    .filter(isObj)
    .map((h) => ({ url: String(h.url ?? h.landingUrl ?? ''), type: str(h.typeI18n) ?? str(h.type) }))
    .filter((h) => h.url)
  const coord = isObj(base.coordinate) ? { lat: num(base.coordinate.y)!, lng: num(base.coordinate.x)! } : null
  const topTotal = num(top.total)

  // 쿠폰·소식이 없거나 업종에 메뉴 탭이 없는 매장도 많다 — 왜 비었는지 알려 준다
  const notes: string[] = []
  const hasFeed = isObj(pd.hasFeed) ? pd.hasFeed : null
  if (!news.length && hasFeed && !hasFeed.feedExist) notes.push('이 매장은 네이버 소식 탭에 올린 글이 없어요.')
  if (!photos.length) notes.push('사진 탭 응답을 받지 못했어요(차단됐거나 구조가 바뀌었을 수 있어요). 홈 대표 사진만 보여요.')

  return {
    ...emptyResult('naver_place', a.inputUrl),
    id: a.id,
    inputUrl: a.inputUrl,
    pageUrl: a.pageUrl,
    businessType: a.pageUrl.match(/m\.place\.naver\.com\/([a-z]+)\//)?.[1] ?? null,
    name: str(base.name) ?? '(이름 없음)',
    category: str(base.category),
    description: str(pd.description),
    address: str(base.address),
    roadAddress: str(base.roadAddress),
    directions: str(base.road),
    phone: str(base.virtualPhone) ?? str(base.phone),
    coord: coord && coord.lat && coord.lng ? coord : null,
    links: homepages.map((h) => ({ url: h.url, type: h.type })),
    keywords: arr(info.keywordList).map(String),
    conveniences: arr(base.conveniences).map(String),
    payments: arr(base.paymentInfo).map(String),
    parking: isObj(info.parkingInfo) ? str(info.parkingInfo.description) : null,
    hoursStatus: statusObj ? [str(statusObj.status), str(statusObj.description)].filter(Boolean).join(' · ') : null,
    hours,
    menus,
    menuBoards,
    briefing,
    photos,
    photoTotal: topTotal ?? num(imgs.totalImages),
    styles: styles.slice(0, 120),
    reviewTotal: num(base.visitorReviewsTotal),
    reviewKeywords,
    reviews: reviews.slice(0, a.maxReviews),
    news,
    coupons,
    transit,
    ops: Object.entries(graphql).map(([name, l]) => ({ name, count: l.length })),
    notes,
    raw: { placeDetail: deref(apollo, rootField(root, 'placeDetail')) },
  }
}
