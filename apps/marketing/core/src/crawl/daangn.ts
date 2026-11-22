/* 당근 동네 업체(비즈프로필) (테스트용).
   daangn.com/kr/local-profile/<이름-id>/ 페이지 HTML 에 화면 데이터(window.__remixContext)가 통째로 들어 있어
   브라우저 없이 읽는다 — 1~2초. 데이터 위치는 경로 이름으로 찾지 않고 `__typename: "LocalProfile"` 인 객체를
   훑어서 찾는다(라우트 이름이 바뀌어도 버티게). 그것도 없으면 JSON-LD·og 메타로 기본 정보만 채운다. */
import { arr, emptyResult, errText, fetchText, fillFromLd, findObj, isObj, jsonLd, linkType, metas, num, str, type CrawlResult, type Obj } from './common'

const DAYS: [string, string][] = [
  ['monday', '월'],
  ['tuesday', '화'],
  ['wednesday', '수'],
  ['thursday', '목'],
  ['friday', '금'],
  ['saturday', '토'],
  ['sunday', '일'],
]

function remixState(html: string): unknown {
  const m = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

export async function crawlDaangn(inputUrl: string): Promise<CrawlResult> {
  const started = Date.now()
  const r = emptyResult('daangn', inputUrl)
  if (!/daangn\.com\/[a-z]{2}\/local-profile\//.test(inputUrl) && !/daangn\.com\/(?:kr\/)?business/.test(inputUrl)) {
    r.notes.push('당근 동네 업체 주소(daangn.com/kr/local-profile/…)가 아니라서 기본 정보만 읽어 볼게요.')
  }

  const t0 = Date.now()
  let html: string
  try {
    const res = await fetchText(inputUrl)
    r.pageUrl = res.url
    r.steps.push({ tab: 'local-profile', ms: Date.now() - t0, ok: res.status === 200, note: res.status === 200 ? undefined : `HTTP ${res.status}` })
    if (res.status !== 200) throw new Error(`당근이 ${res.status} 로 응답했어요. 주소가 맞는지 확인해 주세요.`)
    html = res.text
  } catch (e) {
    throw new Error(errText(e))
  }

  // ① 화면 데이터에서 LocalProfile 찾기
  const state = remixState(html)
  const lp = findObj(state, (o) => o.__typename === 'LocalProfile' && !!str(o.name)) as Obj | null
  r.ops.push({ name: '__remixContext', count: state ? 1 : 0 }, { name: 'LocalProfile', count: lp ? 1 : 0 })

  // ② JSON-LD·og 메타(항상 시도 — ①이 실패해도 이름·주소는 나오게)
  const lds = jsonLd(html)
  const meta = metas(html)
  r.ops.push({ name: 'JSON-LD', count: lds.length })

  if (lp) {
    r.raw = lp
    r.id = str(lp.dbId) ?? str(lp.nodeId)
    r.name = str(lp.name) ?? r.name
    const cat = isObj(lp.category) ? lp.category : {}
    r.category = str(cat.name)
    r.businessType = arr(cat.levels).join(' > ') || null
    r.description = str(lp.description)
    const ad = isObj(lp.address) ? lp.address : {}
    r.roadAddress = [str(ad.road), str(ad.extra)].filter(Boolean).join(' ') || null
    r.address = str(ad.jibun)
    const co = isObj(lp.coordinates) ? lp.coordinates : {}
    if (num(co.lat) && num(co.lng)) r.coord = { lat: num(co.lat)!, lng: num(co.lng)! }
    r.phone = str(lp.phone) ?? str(lp.safeNumber)
    if (str(lp.url)) r.links.push({ url: str(lp.url)!, type: linkType(str(lp.url)!) ?? '홈페이지' })
    r.conveniences = arr(lp.additionalInformation).map(String)
    const cnt = isObj(lp.count) ? lp.count : {}
    r.reviewTotal = num(cnt.reviewCount)
    r.reviewScore = num(cnt.reviewStarRating)
    if (num(cnt.followerCount) != null) r.facts.push({ label: '단골', value: `${num(cnt.followerCount)}명` })
    const bv = isObj(lp.businessVerification) ? lp.businessVerification : null
    if (bv) r.facts.push({ label: '사업자 인증', value: bv.verified ? '인증됨' : '안 됨' })

    // 단골 혜택·공지 → 쿠폰/소식 자리
    if (str(lp.promotion)) r.coupons.push({ title: str(lp.promotion)!, description: '당근 단골 혜택', period: null, image: null })
    if (str(lp.notice)) r.news.push({ title: '공지', body: str(lp.notice), category: '공지', period: null, when: null, images: [], url: null, isVideo: false })
    for (const c of arr(lp.coupons)) {
      if (isObj(c)) r.coupons.push({ title: str(c.name) ?? str(c.title) ?? '쿠폰', description: str(c.description), period: str(c.expiresAt) ?? str(c.endDate), image: null })
    }

    // 영업시간
    const bd = isObj(lp.operationTime) && isObj(lp.operationTime.businessDays) ? lp.operationTime.businessDays : {}
    for (const [key, label] of DAYS) {
      const d = isObj(bd[key]) ? (bd[key] as Obj) : null
      if (!d) continue
      const h = isObj(d.hours) ? d.hours : {}
      const brk = isObj(d.breakHours) ? [`${d.breakHours.from}~${d.breakHours.to}`] : []
      r.hours.push({ day: label, open: d.closed ? null : d.open24Hours ? '00:00' : str(h.from), close: d.closed ? null : d.open24Hours ? '24:00' : str(h.to), breaks: brk, note: d.closed ? '휴무' : null })
    }

    // 가격표·상품
    const pricing = isObj(lp.pricing) ? lp.pricing : {}
    for (const p of [...arr(pricing.pricings), ...arr(lp.products)]) {
      if (!isObj(p) || !str(p.name)) continue
      const price = num(p.price)
      const max = num(p.maxPrice)
      r.menus.push({
        name: str(p.name)!,
        price: p.priceKind === 'UNFIXED' && !price ? '가격 문의' : price != null ? `${price.toLocaleString()}원${max ? ` ~ ${max.toLocaleString()}원` : ''}` : null,
        description: str(p.description),
        images: arr(p.images).map((i) => (isObj(i) ? (str(i.url) ?? str(i.thumbnailUrl)) : typeof i === 'string' ? i : null)).filter((x): x is string => !!x),
        recommend: !!p.isRepresentative,
        group: null,
      })
    }

    // 사진: 대표 + 배경 사진(업체가 올린 것)
    const pics = [str(lp.thumbImageUrl), ...arr(lp.backgroundPictures).map((x) => (typeof x === 'string' ? x : isObj(x) ? str(x.url) : null))].filter((x): x is string => !!x)
    for (const u of [...new Set(pics)]) r.photos.push({ url: u, thumb: u, width: null, height: null, source: 'business', title: null, date: null, author: null, videoUrl: null, link: null })

    // 소식(비즈 게시글)
    for (const bp of arr(lp.bizPosts)) {
      if (!isObj(bp)) continue
      const body = arr(bp.content)
        .map((c) => (isObj(c) && c.type === 'TEXT' ? String(c.value ?? '') : ''))
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const imgs = arr(bp.images).map((i) => (isObj(i) ? str(i.thumbnailUrl) : null)).filter((x): x is string => !!x)
      r.news.push({
        title: str(bp.title) ?? body.split('\n')[0] ?? '소식',
        body: body || null,
        category: '소식',
        period: null,
        when: str(bp.createdAt)?.slice(0, 10) ?? null,
        images: imgs,
        url: str(bp.id) ? `https://www.daangn.com${bp.id}` : null,
        isVideo: false,
      })
      for (const u of imgs) r.photos.push({ url: u, thumb: u, width: null, height: null, source: 'post', title: str(bp.title), date: str(bp.createdAt)?.slice(0, 10) ?? null, author: null, videoUrl: null, link: null })
    }

    // 후기
    for (const rv of arr(lp.reviews)) {
      if (!isObj(rv)) continue
      const user = isObj(rv.user) ? rv.user : {}
      r.reviews.push({
        body: str(rv.content) ?? '',
        author: str(user.nickname) ?? str(user.name),
        date: str(rv.createdAt)?.slice(0, 10) ?? null,
        images: arr(rv.images).map((i) => (isObj(i) ? str(i.thumbnailUrl) : null)).filter((x): x is string => !!x),
        keywords: arr(rv.tags).map((t) => (isObj(t) ? String(t.name ?? t.label ?? '') : String(t))).filter(Boolean),
        rating: num(rv.starRating),
      })
    }
    if (num(r.reviewTotal) && r.reviews.length < r.reviewTotal!) r.notes.push(`후기는 첫 화면에 보이는 ${r.reviews.length}개만 가져와요(전체 ${r.reviewTotal}개).`)
  } else {
    r.notes.push('당근 화면 데이터를 찾지 못해 웹 표준 정보(JSON-LD·og)로 기본 정보만 채웠어요. 당근 화면 구조가 바뀌었을 수 있어요.')
  }

  fillFromLd(r, lds)
  if (r.name === '(이름 없음)' && meta['og:title']) r.name = meta['og:title'].split('|')[0].trim()
  r.description ??= meta['og:description'] ?? null
  if (!r.photos.length && meta['og:image']) r.photos.push({ url: meta['og:image'], thumb: meta['og:image'], width: null, height: null, source: 'business', title: null, date: null, author: null, videoUrl: null, link: null })

  r.elapsedMs = Date.now() - started
  return r
}
