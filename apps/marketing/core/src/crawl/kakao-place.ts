/* 카카오맵 장소 (테스트용).
   카카오는 장소 화면이 부르는 JSON(place-api.map.kakao.com/places/panel3/<id>)을 브라우저 없이 바로 준다 — 2~3초.
   업종마다 들어오는 칸이 다르다(음식점은 menu, 미용실은 없음) → 있는 것만 채운다. */
import { MOBILE_UA, arr, emptyResult, errText, fetchText, isObj, linkType, num, str, uniqBy, type CrawlPhoto, type CrawlResult, type Obj } from './common'

/** place.map.kakao.com/<id> · map.kakao.com/?itemId=<id> · kko.to 단축 주소 */
export async function resolveKakaoId(input: string): Promise<string | null> {
  const s = input.trim()
  const fromUrl = (u: string) => u.match(/place\.map\.kakao\.com\/(?:m\/)?(\d{4,})/)?.[1] ?? u.match(/[?&](?:itemId|confirmid|id)=(\d{4,})/)?.[1] ?? null
  const direct = fromUrl(s)
  if (direct) return direct
  if (/^https?:\/\/(kko\.to|kakaomap\.page\.link|map\.kakao\.com)/.test(s)) {
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

const PHOTO_SOURCE: Record<string, string> = { MYSTORE: 'business', VENDOR: 'business', BLOG: 'blog', KAKAOMAP_REVIEW: 'placeReview', REVIEW: 'placeReview' }

export async function crawlKakaoPlace(inputUrl: string): Promise<CrawlResult> {
  const started = Date.now()
  const r = emptyResult('kakao_place', inputUrl)
  const id = await resolveKakaoId(inputUrl)
  if (!id) throw new Error('주소에서 카카오맵 장소 번호를 찾지 못했어요. place.map.kakao.com/숫자 형태의 주소를 넣어 주세요.')
  r.id = id
  r.pageUrl = `https://place.map.kakao.com/${id}`

  const t0 = Date.now()
  let j: Obj
  try {
    const res = await fetchText(`https://place-api.map.kakao.com/places/panel3/${id}`, { referer: 'https://place.map.kakao.com/', pf: 'web' })
    r.steps.push({ tab: 'places/panel3', ms: Date.now() - t0, ok: res.status === 200, note: res.status === 200 ? undefined : `HTTP ${res.status}` })
    if (res.status !== 200) throw new Error(`카카오가 ${res.status} 로 응답했어요. 잠시 뒤 다시 시도해 주세요.`)
    j = JSON.parse(res.text)
  } catch (e) {
    throw new Error(e instanceof SyntaxError ? '카카오 응답을 읽지 못했어요(구조가 바뀌었을 수 있어요).' : errText(e))
  }
  r.raw = j
  r.ops = Object.keys(j).map((name) => ({ name, count: 1 }))

  // 기본 정보
  const s = isObj(j.summary) ? j.summary : {}
  r.name = str(s.name) ?? r.name
  const cat = isObj(s.category) ? s.category : {}
  r.category = str(cat.name)
  r.businessType = [cat.name2, cat.name3].map(str).filter(Boolean).join(' > ') || null
  const addr = isObj(s.address) ? s.address : {}
  r.roadAddress = str(addr.road) ?? str(addr.disp)
  r.address = str(addr.jibun)
  const pt = isObj(s.point) ? s.point : {}
  if (num(pt.lat) && num(pt.lon)) r.coord = { lat: num(pt.lat)!, lng: num(pt.lon)! }
  r.phone = arr(s.phone_numbers).map((p) => (isObj(p) ? str(p.tel) : null)).find(Boolean) ?? null
  for (const u of [...arr(s.homepages), ...arr(s.related_links).map((x) => (isObj(x) ? (x.url ?? x.link) : x))]) {
    if (typeof u === 'string' && u) r.links.push({ url: u, type: linkType(u) ?? '홈페이지' })
  }
  r.payments = arr(s.payments).map((p) => (typeof p === 'string' ? p : isObj(p) ? (str(p.name) ?? '') : '')).filter(Boolean)

  // AI 요약(카카오 AI 메이트) — 소개 글 대신
  const ai = isObj(j.ai_mate) ? j.ai_mate : {}
  const sheet = isObj(ai.bottom_sheet) ? ai.bottom_sheet : {}
  r.description = str(sheet.summary) ?? (isObj(ai.summary) ? str(ai.summary.title) : null)
  if (str(sheet.title)) r.briefing.push({ sentence: `${str(sheet.title)}${str(sheet.summary) ? ' — ' + str(sheet.summary) : ''}`, sources: [] })
  for (const b of arr(ai.blog_summaries)) {
    if (isObj(b) && str(b.title)) r.briefing.push({ sentence: `${str(b.title)}: ${arr(b.keywords).join(', ')}`, sources: [] })
  }

  // 영업시간
  const oh = isObj(j.open_hours) ? j.open_hours : {}
  const head = isObj(oh.headline) ? oh.headline : {}
  r.hoursStatus = [str(head.display_text), str(head.display_text_info)].filter(Boolean).join(' · ') || null
  const week = isObj(oh.week_from_today) ? oh.week_from_today : {}
  for (const per of arr(week.week_periods)) {
    for (const d of arr(isObj(per) ? per.days : null)) {
      if (!isObj(d)) continue
      const on = isObj(d.on_days) ? d.on_days : null
      const [open, close] = (str(on?.start_end_time_desc) ?? '').split('~').map((x) => x.trim())
      r.hours.push({
        day: String(d.day_of_the_week_desc ?? '').replace(/\(.*\)/, ''),
        open: open || null,
        close: close || null,
        breaks: arr(on?.break_times ?? on?.break_time).map(String),
        note: on ? null : (str(d.off_days_desc) ?? '휴무'),
      })
    }
  }

  // 편의시설·태그
  const add = isObj(j.place_add_info) ? j.place_add_info : {}
  r.keywords = arr(add.tags).map(String)
  const icons = [...arr(add.store_facility_icons), ...arr(isObj(add.ai_mate) ? add.ai_mate.store_facility_icons : null)]
  r.conveniences = uniqBy(icons.map((x) => (isObj(x) ? (str(x.text) ?? '') : '')), (x) => x)
  const sp = isObj(add.simple_parking_infos) ? add.simple_parking_infos : null
  r.parking = sp ? (str(sp.summary) ?? arr(sp.texts).join(', ')) || null : null

  // 메뉴(음식점 등)
  const menuRoot = isObj(j.menu) && isObj(j.menu.menus) ? j.menu.menus : null
  for (const m of arr(menuRoot?.items)) {
    if (!isObj(m) || !str(m.name)) continue
    r.menus.push({
      name: str(m.name)!,
      price: num(m.price) != null ? `${num(m.price)!.toLocaleString()}원` : str(m.price),
      description: str(m.desc) ?? str(m.description),
      images: [str(m.photo_url) ?? str(m.image_url)].filter((x): x is string => !!x),
      recommend: !!m.is_recommend,
      group: null,
    })
  }
  r.menuBoards = arr(menuRoot?.photos)
    .map((p) => (isObj(p) ? str(p.url) : null))
    .filter((x): x is string => !!x)
    .slice(0, 12)

  // 사진: 업체 등록(MYSTORE)과 블로그 후기 사진이 섞여 온다
  const ph = isObj(j.photos) ? j.photos : {}
  r.photoTotal = isObj(ph.counts) ? num(ph.counts.total) : null
  r.photos = uniqBy(
    arr(ph.photos)
      .filter(isObj)
      .map(
        (p): CrawlPhoto => ({
          url: String(p.url ?? '').replace(/\?type=w\d+$/, ''),
          thumb: String(p.url ?? ''),
          width: null,
          height: null,
          source: PHOTO_SOURCE[String(p.type)] ?? String(p.type ?? 'etc').toLowerCase(),
          title: str(p.title),
          date: str(p.registered_at)?.slice(0, 10) ?? null,
          author: null,
          videoUrl: p.media_type === 'VIDEO' ? str(p.video_url) : null,
          link: str(p.blog_link_url),
        }),
      )
      .filter((p) => p.url),
    (p) => p.url,
  )
  if (str(s.main_photo_url) && !r.photos.some((p) => p.url === s.main_photo_url)) {
    r.photos.unshift({ url: str(s.main_photo_url)!, thumb: str(s.main_photo_url)!, width: null, height: null, source: 'business', title: '대표 사진', date: null, author: null, videoUrl: null, link: null })
  }

  // 리뷰
  const kr = isObj(j.kakaomap_review) ? j.kakaomap_review : {}
  const score = isObj(kr.score_set) ? kr.score_set : {}
  r.reviewTotal = num(score.review_count)
  r.reviewScore = num(score.average_score)
  const names = new Map(arr(kr.strength_description).filter(isObj).map((d) => [d.id, d]))
  r.reviewKeywords = arr(score.strength_counts)
    .filter(isObj)
    .map((c) => {
      const d = names.get(c.id) as Obj | undefined
      return { name: str(d?.name) ?? `#${c.id}`, count: num(c.count) ?? 0, icon: str(d?.icon_url) }
    })
  for (const rv of arr(kr.reviews)) {
    if (!isObj(rv)) continue
    const owner = isObj(rv.meta) && isObj(rv.meta.owner) ? rv.meta.owner : {}
    r.reviews.push({
      body: str(rv.contents) ?? '',
      author: str(owner.nickname),
      date: str(rv.registered_at)?.slice(0, 10) ?? null,
      images: arr(rv.photos).map((p) => (isObj(p) ? str(p.url) : null)).filter((x): x is string => !!x),
      keywords: [],
      rating: num(rv.star_rating),
    })
  }
  // 블로그 후기는 리뷰 목록 뒤에 붙인다(원문 링크 포함)
  const blog = isObj(j.blog_review) ? j.blog_review : {}
  if (num(blog.review_count)) r.facts.push({ label: '블로그 후기', value: `${num(blog.review_count)!.toLocaleString()}개` })
  for (const b of arr(blog.reviews).slice(0, 10)) {
    if (!isObj(b)) continue
    r.reviews.push({
      body: `[블로그] ${str(b.title) ?? ''}\n${str(b.contents) ?? ''}`.trim(),
      author: str(b.author),
      date: str(b.registered_at)?.slice(0, 10) ?? null,
      images: arr(b.photos).slice(0, 6).map((p) => (isObj(p) ? str(p.url) : null)).filter((x): x is string => !!x),
      keywords: [],
      url: str(b.origin_url),
    })
  }

  // 사장님 소식
  const notice = isObj(j.my_store_notice) ? j.my_store_notice : {}
  for (const n of arr(notice.notices)) {
    if (!isObj(n)) continue
    r.news.push({
      title: str(n.title) ?? str(n.contents)?.split('\n')[0] ?? '소식',
      body: str(n.contents) ?? str(n.content),
      category: str(n.type),
      period: null,
      when: str(n.registered_at)?.slice(0, 10) ?? null,
      images: arr(n.photos).map((p) => (isObj(p) ? str(p.url) : typeof p === 'string' ? p : null)).filter((x): x is string => !!x),
      url: null,
      isVideo: false,
    })
  }
  if (!r.news.length) r.notes.push(notice.status === 'READY_TO_REGISTER' ? '사장님이 카카오맵 매장 관리에 등록하지 않아 소식이 없어요.' : '카카오맵 소식이 없어요.')

  // 교통
  const fw = isObj(j.find_way) && isObj(j.find_way.subway) ? j.find_way.subway : null
  if (fw) r.transit.push(`🚇 ${fw.station_simple_name}${fw.exit_num ? ` ${fw.exit_num}번 출구` : ''}${fw.to_exit_distance ? ` · ${fw.to_exit_distance}m` : ''}`)

  r.notes.push('카카오맵 사진은 대부분 블로그 후기 사진이에요(남의 저작물). 업체가 직접 올린 사진만 쓰는 게 안전해요.')
  r.elapsedMs = Date.now() - started
  return r
}
