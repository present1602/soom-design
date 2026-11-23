/* 마케팅 문의 폼과 접수 API가 쓰는 값. 길이 한도는 DB 제약과 같다. */

export const MARKETING_MESSAGE_MAX = 2000

/* 업종 목록은 의뢰 폼과 같이 쓴다 — lib/industries.ts, 어드민 설정 > 업종 목록 */

export const LEAD_URL_FIELDS = [
  { name: 'homepageUrl', column: 'homepage_url', label: '회사 홈페이지' },
  { name: 'naverPlaceUrl', column: 'naver_place_url', label: '네이버 플레이스' },
  { name: 'instagramUrl', column: 'instagram_url', label: '인스타그램' },
  { name: 'youtubeUrl', column: 'youtube_url', label: '유튜브' },
] as const

export const LEAD_URL_MAX = 500

/* 주소 정리 — 빈칸은 null, https:// 를 빼고 적었으면 붙인다. 주소가 아니면 false.
   사장님들이 'naver.me/abc' 처럼 앞을 빼고 붙여 넣는 일이 많아 붙여서 받는다 */
export function normalizeUrl(raw: string): string | null | false {
  const s = raw.trim()
  if (!s) return null
  if (s.length > LEAD_URL_MAX || /\s/.test(s)) return false
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return false
    return u.toString()
  } catch {
    return false
  }
}
