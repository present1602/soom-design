/* 주소를 보고 어느 소스인지 고른다. 화면(클라이언트)과 서버 액션이 같이 쓴다 — 서버 전용 코드를 넣지 않는다. */
import type { SourceKind } from './common'

export const SOURCES: { kind: SourceKind; label: string; hint: string; supported: boolean }[] = [
  { kind: 'naver_place', label: '네이버 플레이스', hint: 'map.naver.com · naver.me · m.place.naver.com', supported: true },
  { kind: 'kakao_place', label: '카카오맵', hint: 'place.map.kakao.com · kko.to', supported: true },
  { kind: 'daangn', label: '당근 동네 업체', hint: 'daangn.com/kr/local-profile/…', supported: true },
  { kind: 'homepage', label: '홈페이지', hint: '그 밖의 모든 주소', supported: true },
  { kind: 'instagram', label: '인스타그램', hint: 'instagram.com/아이디 — 프로필만', supported: true },
  { kind: 'smartstore', label: '스마트스토어', hint: '자동 수집 막힘', supported: false },
]

export function detectSource(input: string): SourceKind {
  const s = input.trim().toLowerCase()
  if (/^\d{5,}$/.test(s)) return 'naver_place' // 숫자만 = 네이버 플레이스 번호
  if (/(^|\/\/|\.)(map\.naver\.com|naver\.me|m\.place\.naver\.com|pcmap\.place\.naver\.com)/.test(s)) return 'naver_place'
  if (/(place\.map\.kakao\.com|map\.kakao\.com|kko\.to)/.test(s)) return 'kakao_place'
  if (/daangn\.com/.test(s)) return 'daangn'
  if (/instagram\.com/.test(s)) return 'instagram'
  if (/smartstore\.naver\.com|brand\.naver\.com/.test(s)) return 'smartstore'
  return 'homepage'
}

export const sourceLabel = (k: SourceKind) => SOURCES.find((x) => x.kind === k)?.label ?? k
