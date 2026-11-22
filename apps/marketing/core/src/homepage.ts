/* 고객사 홈페이지(아무 사이트) 읽기.
   우리가 만들지 않은 사이트는 자료 API 가 없으니, 페이지 HTML 에서 제목·설명·본문 글만 뽑아 참고 자료로 쓴다.
   자바스크립트로 그리는 사이트(네이버 플레이스·인스타 등)는 글이 거의 안 나올 수 있다 — 그때는 매장 소개 칸을 채워 쓰면 된다.
   생성 직전에 매번 새로 읽고, 실패하면 지난 결과(stores.homepage_cache)로 대신한다. */

export type HomepageSnapshot = {
  url: string
  title?: string
  description?: string
  /** 본문에서 뽑은 글 (최대 TEXT_MAX 자) */
  text: string
}

const TIMEOUT_MS = 8000
const MAX_BYTES = 3_000_000
const TEXT_MAX = 3000

/** http(s) 공개 주소만. 내부망·로컬 주소는 막는다(워커가 대신 접속하므로). */
export function checkHomepageUrl(url: string) {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return '홈페이지 주소 형식이 올바르지 않아요. https:// 로 시작하게 넣어 주세요.'
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '홈페이지 주소는 http:// 또는 https:// 로 시작해야 해요.'
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.startsWith('[')) {
    return '내부망 주소는 쓸 수 없어요. 공개된 홈페이지 주소를 넣어 주세요.'
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' }
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}
const tidy = (s: string) => decode(s).replace(/\s+/g, ' ').trim()

function meta(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  return tag ? tidy(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '') || undefined : undefined
}

/** HTML → 제목·설명·본문 글 */
export function parseHomepage(url: string, html: string): HomepageSnapshot {
  const title = meta(html, 'og:title') ?? (tidy(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || undefined)
  const description = meta(html, 'og:description') ?? meta(html, 'description')
  const body = (html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html)
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  // 줄마다 정리하고, 메뉴처럼 짧게 반복되는 줄은 한 번만 남긴다
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of decode(body).split('\n')) {
    const l = raw.replace(/\s+/g, ' ').trim()
    if (l.length < 2 || seen.has(l)) continue
    seen.add(l)
    lines.push(l)
  }
  return { url, title: title?.slice(0, 200), description: description?.slice(0, 600), text: lines.join('\n').slice(0, TEXT_MAX) }
}

/** 페이지를 읽는다. 실패하면 사람이 읽을 수 있는 이유를 담아 throw 한다. */
export async function fetchHomepage(url: string): Promise<HomepageSnapshot> {
  const bad = checkHomepageUrl(url)
  if (bad) throw new Error(bad)
  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'text/html,application/xhtml+xml', 'accept-language': 'ko-KR,ko;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; MarketingConsole/1.0)' },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError'
    throw new Error(timeout ? `홈페이지가 ${TIMEOUT_MS / 1000}초 안에 응답하지 않았어요.` : `홈페이지에 접속하지 못했어요 (${e instanceof Error ? e.message : String(e)}).`)
  }
  if (!res.ok) throw new Error(`홈페이지가 오류를 돌려줬어요 (${res.status}).${res.status === 403 ? ' 자동 접속을 막아 둔 사이트일 수 있어요.' : ''}`)
  const type = res.headers.get('content-type') ?? ''
  if (type && !type.includes('html')) throw new Error('홈페이지 주소가 웹페이지(HTML)가 아니에요.')
  const html = await res.text()
  if (html.length > MAX_BYTES) throw new Error('홈페이지가 너무 커서 읽지 못했어요.')
  const snap = parseHomepage(res.url || url, html)
  if (!snap.description && snap.text.length < 40) {
    throw new Error('페이지에서 글을 거의 읽지 못했어요. 자바스크립트로 그리는 사이트일 수 있어요 — 매장 소개 칸에 내용을 적어 주세요.')
  }
  return snap
}

/** 프롬프트에 넣을 요약 글 */
export function homepageBrief(s: HomepageSnapshot, max = 1200) {
  const head = [s.title && `홈페이지 제목: ${s.title}`, s.description && s.description !== s.title && `홈페이지 소개: ${s.description}`].filter(Boolean).join('\n')
  const room = max - head.length - 1
  const body = s.text.trim() && room > 80 ? `홈페이지 본문 일부:\n${s.text.slice(0, room - 12)}` : ''
  return [head, body].filter(Boolean).join('\n').slice(0, max)
}
