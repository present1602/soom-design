/* 인스타그램 프로필 (테스트용).
   로그인 없이 보이는 것만: 이름·소개 글·팔로워/게시물 수·프로필 사진. 게시물 사진은 로그인 벽 뒤라 못 가져온다
   — 게시물은 고객이 채널 연결(인스타그램 공식 API)을 허용하면 그 토큰으로 읽는 게 맞다. */
import { emptyResult, errText, launch, metas, newContext, num, type CrawlResult } from './common'

export async function crawlInstagram(inputUrl: string): Promise<CrawlResult> {
  const started = Date.now()
  const r = emptyResult('instagram', inputUrl)
  const handle = inputUrl.match(/instagram\.com\/([A-Za-z0-9._]+)/)?.[1]
  if (!handle || ['p', 'reel', 'reels', 'explore', 'stories'].includes(handle)) throw new Error('인스타그램 프로필 주소(instagram.com/아이디)를 넣어 주세요. 게시물 하나짜리 주소는 안 돼요.')
  r.id = handle
  r.pageUrl = `https://www.instagram.com/${handle}/`

  const browser = await launch()
  try {
    const ctx = await newContext(browser, { mobile: true, blockMedia: true })
    const page = await ctx.newPage()
    const t0 = Date.now()
    try {
      await page.goto(r.pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
      r.steps.push({ tab: `/${handle}/`, ms: Date.now() - t0, ok: true })
    } catch (e) {
      r.steps.push({ tab: `/${handle}/`, ms: Date.now() - t0, ok: false, note: errText(e) })
      throw new Error(`인스타그램을 열지 못했어요: ${errText(e)}`)
    }
    const html = await page.content()
    const meta = metas(html)
    r.ops.push({ name: 'og 메타', count: Object.keys(meta).filter((k) => k.startsWith('og:')).length })

    // og:title = "이름(@아이디) • Instagram 사진 및 동영상"
    const title = meta['og:title'] ?? ''
    r.name = title.split('(@')[0].trim() || handle
    r.facts.push({ label: '아이디', value: `@${handle}` })
    // description = "팔로워 3,599명, 팔로잉 496명, 게시물 2,778개 - …"
    const desc = meta['description'] ?? meta['og:description'] ?? ''
    for (const [label, re] of [
      ['팔로워', /팔로워\s*([\d,.만천]+)/],
      ['게시물', /게시물\s*([\d,.만천]+)/],
    ] as const) {
      const m = desc.match(re)
      if (m) r.facts.push({ label, value: m[1] })
    }
    // 소개 글: 화면 데이터의 "biography" (JSON 문자열이라 \u 이스케이프를 푼다)
    const bio = html.match(/"biography":"((?:[^"\\]|\\.)*)"/)?.[1]
    if (bio) {
      try {
        r.description = JSON.parse(`"${bio}"`)
      } catch {
        r.description = bio
      }
    } else {
      r.description = desc.split(/계정:\s*/)[1]?.replace(/^'|'$/g, '') ?? null
    }
    const link = html.match(/"external_url":"((?:[^"\\]|\\.)*)"/)?.[1]
    if (link) r.links.push({ url: JSON.parse(`"${link}"`), type: '프로필 링크' })
    if (meta['og:image']) r.photos.push({ url: meta['og:image'], thumb: meta['og:image'], width: null, height: null, source: 'profile', title: '프로필 사진', date: null, author: null, videoUrl: null, link: null })
    const posts = r.facts.find((f) => f.label === '게시물')
    r.photoTotal = posts ? num(posts.value.replace(/,/g, '')) : null
    r.notes.push('인스타그램은 로그인 없이 게시물 사진을 볼 수 없어요. 게시물은 고객이 인스타그램 채널 연결을 허용하면 공식 API 로 가져오는 게 맞아요(채널 관리 OAuth 와 같이 만들 일).')
    r.raw = { meta }
    r.elapsedMs = Date.now() - started
    return r
  } finally {
    await browser.close().catch(() => {})
  }
}
