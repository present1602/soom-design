/* 경력 글 속 링크 — 어드민이 글자를 골라 '링크 걸기' 하면 [글자](주소) 로 감싸 저장한다.

   글은 일반 텍스트 그대로 둔다(HTML 을 저장하지 않는다). 그리는 쪽이 이 꼴만 링크로 바꾸고
   나머지는 글자로 그리므로, 경력에 무엇을 적어도 스크립트가 끼어들 자리가 없다.
   주소는 http·https 만 받는다(javascript: 같은 주소는 글자로 남는다). */

export type CareerPart = { text: string; href?: string }

/* 줄바꿈이나 대괄호가 든 글자는 [글자](<주소>)로 저장한다.
   그 형식에서만 이스케이프를 풀어, 기존 링크의 역슬래시는 그대로 표시한다. */
const LINK = /\[((?:\\[\\[\]]|[^[\]\\]){1,200})\]\(<(https?:\/\/[^\s()<>]{1,500})>\)|\[([^\]\n]{1,200})\]\((https?:\/\/[^\s()]{1,500})\)/g

export function careerLink(text: string, href: string): string {
  if (!/[[\]\n]/.test(text)) return `[${text}](${href})`
  return `[${text.replace(/[\\[\]]/g, '\\$&')}](<${href}>)`
}

export function overlapsCareerLink(text: string, start: number, end: number): boolean {
  return Array.from(text.matchAll(LINK)).some((m) => start < m.index + m[0].length && end > m.index)
}

export function splitCareer(text: string): CareerPart[] {
  const parts: CareerPart[] = []
  let at = 0
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) })
    const [, escaped, extendedHref, plain, plainHref] = m
    parts.push({ text: escaped === undefined ? plain : escaped.replace(/\\([\\[\]])/g, '$1'), href: extendedHref ?? plainHref })
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push({ text: text.slice(at) })
  return parts
}

/* 적은 주소를 고친다 — 'www.a.com' 처럼 앞을 빼먹으면 https:// 를 붙인다. 못 쓰는 주소면 null */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s || /\s/.test(s)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    /* 괄호는 [글자](주소) 꼴을 깨뜨린다 — 주소 안에서는 인코딩한다 */
    return u.toString().replace(/\(/g, '%28').replace(/\)/g, '%29')
  } catch {
    return null
  }
}
