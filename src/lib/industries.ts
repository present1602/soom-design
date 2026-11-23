/* 의뢰·문의 폼(inquiry-modal)과 마케팅 문의 폼(marketing-lead)이 같이 쓰는 업종 목록.
   어드민 설정 > 기본 설정 "업종 목록"에서 고치고 site_settings.industries 에 저장한다
   (0038_inquiry_industry_optional_message.sql). 칸이 없거나 비어 있으면 아래 기본값을 쓴다.
   이미 들어온 접수는 고른 글자를 그대로 저장해 두므로, 목록을 바꿔도 예전 업종은 그대로 보인다. */

export const DEFAULT_INDUSTRIES = [
  '음식점 · 카페 · 베이커리',
  '뷰티 · 헬스 · 필라테스',
  '학원 · 교육',
  '병원 · 의료',
  '쇼핑몰 · 판매',
  'IT · 스타트업 · 플랫폼',
  '전문 서비스 · B2B',
  '기타',
] as const

export const INDUSTRY_MAX = 40
export const INDUSTRY_NAME_MAX = 30

/** 한 줄에 하나씩 받은 글을 목록으로. 빈 줄·중복은 빼고 길이를 자른다. 너무 많으면 null */
export function cleanIndustries(raw: string | readonly string[]): string[] | null {
  const lines = (typeof raw === 'string' ? raw.split('\n') : raw).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
  const uniq = [...new Set(lines)]
  if (uniq.length > INDUSTRY_MAX || uniq.some((s) => s.length > INDUSTRY_NAME_MAX)) return null
  return uniq
}
