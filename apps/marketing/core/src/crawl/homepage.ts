/* 일반 홈페이지 (테스트용).
   사이트마다 구조가 제각각이라 특정 구조를 가정하지 않는다. 헤드리스 크롬으로 그려(자바스크립트로 그리는 사이트도 보이게)
   ① JSON-LD·og 메타(웹 표준) ② 본문 글 ③ 큰 이미지 ④ SNS·플랫폼 링크 ⑤ 전화·이메일·사업자번호 같은 패턴을 뽑고,
   메뉴에서 "회사소개·메뉴·서비스·이벤트" 같은 하위 페이지를 몇 개 더 열어 같은 방식으로 모은다. */
import type { Page } from 'playwright-core'
import { emptyResult, errText, fillFromLd, jsonLd, launch, linkType, metas, newContext, uniqBy, type CrawlResult } from './common'

const SUBPAGE_HINT = /소개|about|회사|브랜드|brand|story|메뉴|menu|서비스|service|가격|price|이벤트|event|공지|notice|오시는|location|contact|시공|portfolio|사례|상품|product/i
const MAX_SUBPAGES = 3
const MAX_PHOTOS = 80

type PageGrab = {
  title: string
  text: string
  images: { src: string; alt: string; w: number; h: number }[]
  links: { href: string; text: string }[]
}

/** 페이지 안에서 실행: 글·이미지·링크 */
async function grab(page: Page): Promise<PageGrab> {
  return page.evaluate(() => {
    // 슬라이더가 같은 글을 여러 번 그리므로 줄 단위로 중복을 지운다
    const root = document.querySelector('main') ?? document.body
    const lines = (root as HTMLElement).innerText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 1)
    const seen = new Set<string>()
    const text = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true))).join('\n')
    const images = [...document.images]
      .filter((i) => i.naturalWidth >= 300 && i.naturalHeight >= 200 && !/\.svg(\?|$)/i.test(i.currentSrc || i.src))
      .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight }))
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: (a as HTMLAnchorElement).href, text: ((a as HTMLElement).innerText || a.getAttribute('aria-label') || '').trim().slice(0, 40) }))
    return { title: document.title, text, images, links }
  })
}

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
  // 아래로 내려야 그려지는 이미지(지연 로딩)
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500)
}

const PHONE = /(?:0\d{1,2}|1\d{3})[-.\s)]\s?\d{3,4}[-.\s]\d{4}|1\d{3}-\d{4}/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const BIZNO = /\d{3}-\d{2}-\d{5}/

export async function crawlHomepage(inputUrl: string): Promise<CrawlResult> {
  const started = Date.now()
  const r = emptyResult('homepage', inputUrl)
  let url: URL
  try {
    url = new URL(/^https?:\/\//.test(inputUrl) ? inputUrl : `https://${inputUrl}`)
  } catch {
    throw new Error('주소 형식이 아니에요. https:// 로 시작하는 홈페이지 주소를 넣어 주세요.')
  }
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw new Error('내부망 주소는 열 수 없어요.')
  // 광고 추적 꼬리표(utm·_gl 등)는 떼고 연다
  for (const k of [...url.searchParams.keys()]) if (/^(utm_|_gl$|gclid$|fbclid$|NaPm$)/i.test(k)) url.searchParams.delete(k)

  const browser = await launch()
  try {
    const ctx = await newContext(browser, { mobile: false })
    const page = await ctx.newPage()
    const pages: (PageGrab & { url: string })[] = []

    const t0 = Date.now()
    try {
      await open(page, url.toString())
      r.steps.push({ tab: url.pathname || '/', ms: Date.now() - t0, ok: true })
    } catch (e) {
      r.steps.push({ tab: url.pathname || '/', ms: Date.now() - t0, ok: false, note: errText(e) })
      throw new Error(`홈페이지를 열지 못했어요: ${errText(e)}`)
    }
    r.pageUrl = page.url()
    const html = await page.content()
    const main = await grab(page)
    pages.push({ ...main, url: r.pageUrl })

    // ① 웹 표준 정보
    const meta = metas(html)
    const lds = jsonLd(html)
    r.ops.push({ name: 'JSON-LD', count: lds.length }, { name: 'og 메타', count: Object.keys(meta).filter((k) => k.startsWith('og:')).length })
    r.name = meta['og:site_name'] ?? meta['og:title']?.split(/[|·\-–]/)[0].trim() ?? (main.title.split(/[|·\-–]/)[0].trim() || r.name)
    r.description = meta['description'] ?? meta['og:description'] ?? null
    fillFromLd(r, lds)
    if (meta['og:image']) r.photos.push({ url: new URL(meta['og:image'], r.pageUrl).toString(), thumb: new URL(meta['og:image'], r.pageUrl).toString(), width: null, height: null, source: 'og', title: '대표 이미지(og)', date: null, author: null, videoUrl: null, link: null })
    if (meta['keywords']) r.keywords = meta['keywords'].split(',').map((k) => k.trim()).filter(Boolean).slice(0, 20)

    // ② 하위 페이지: 같은 사이트 링크 중 이름이 그럴듯한 것
    const host = new URL(r.pageUrl).hostname.replace(/^www\./, '')
    const candidates = uniqBy(
      main.links.filter((l) => {
        try {
          const u = new URL(l.href)
          return u.hostname.replace(/^www\./, '') === host && u.pathname !== new URL(r.pageUrl).pathname && SUBPAGE_HINT.test(l.text + ' ' + u.pathname) && !/\.(pdf|jpg|png|zip)$/i.test(u.pathname)
        } catch {
          return false
        }
      }),
      (l) => new URL(l.href).pathname,
    ).slice(0, MAX_SUBPAGES)
    // 하위 페이지는 탭을 따로 열어 동시에 읽는다(차례로 열면 페이지당 10초씩 늘어난다)
    const subs = await Promise.all(
      candidates.map(async (c) => {
        const t1 = Date.now()
        const p = await ctx.newPage()
        try {
          await open(p, c.href)
          const g = { ...(await grab(p)), url: p.url(), title: c.text || (await p.title()) }
          r.steps.push({ tab: new URL(c.href).pathname, ms: Date.now() - t1, ok: true })
          return g
        } catch (e) {
          r.steps.push({ tab: new URL(c.href).pathname, ms: Date.now() - t1, ok: false, note: errText(e) })
          return null
        } finally {
          await p.close().catch(() => {})
        }
      }),
    )
    for (const g of subs) if (g) pages.push(g)

    // ③ 글
    for (const p of pages) if (p.text) r.texts.push({ title: p === pages[0] ? '첫 화면' : p.title, body: p.text.slice(0, 4000), url: p.url })

    // ④ 이미지
    for (const p of pages) {
      for (const i of p.images) r.photos.push({ url: i.src, thumb: i.src, width: i.w, height: i.h, source: p === pages[0] ? 'page' : 'subpage', title: i.alt || null, date: null, author: null, videoUrl: null, link: p.url })
    }
    r.photos = uniqBy(r.photos, (p) => p.url.split('?')[0]).slice(0, MAX_PHOTOS)
    r.photoTotal = r.photos.length

    // ⑤ 외부 채널 링크
    const all = pages.flatMap((p) => p.links)
    r.links = uniqBy(
      [...r.links, ...all.filter((l) => linkType(l.href)).map((l) => ({ url: l.href.split('?')[0], type: linkType(l.href) }))],
      (l) => l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
    ).filter((l) => !/instagram\.com\/p\/|youtube\.com\/watch|\/shorts\//.test(l.url)) // 게시물 하나짜리 링크는 뺀다

    // ⑥ 연락처 패턴 (주로 바닥글)
    const text = pages.map((p) => p.text).join('\n')
    const phones = [...new Set(text.match(PHONE) ?? [])].slice(0, 3)
    if (!r.phone && phones[0]) r.phone = phones[0]
    if (phones.length > 1) r.facts.push({ label: '다른 전화', value: phones.slice(1).join(', ') })
    const emails = [...new Set(text.match(EMAIL) ?? [])].filter((e) => !/\.(png|jpg|gif)$/i.test(e)).slice(0, 2)
    if (emails.length && !r.facts.some((f) => f.label === '이메일')) r.facts.push({ label: '이메일', value: emails.join(', ') })
    const biz = text.match(BIZNO)
    if (biz) r.facts.push({ label: '사업자등록번호', value: biz[0] })
    const addrLine = text.split('\n').find((l) => /(주소|address)\s*[:：]/i.test(l) || /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s/.test(l))
    if (!r.roadAddress && addrLine) r.roadAddress = addrLine.replace(/^.*?(주소|address)\s*[:：]\s*/i, '').slice(0, 120)

    r.notes.push(`첫 화면과 하위 페이지 ${candidates.length}개를 읽었어요. 메뉴·가격·이벤트는 사이트마다 모양이 달라 "페이지 글"에 원문 그대로 모았어요 — 실제 등록 땐 AI 로 칸을 나눠 채우면 돼요.`)
    if (main.text.length < 200) r.notes.push('첫 화면 글이 거의 없어요. 이미지로만 된 사이트일 수 있어요.')
    r.raw = { meta, jsonLd: lds, pages: pages.map((p) => ({ url: p.url, title: p.title, textLength: p.text.length, images: p.images.length })) }
    r.elapsedMs = Date.now() - started
    return r
  } finally {
    await browser.close().catch(() => {})
  }
}
