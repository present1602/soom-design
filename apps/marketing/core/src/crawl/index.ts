/* 크롤러 모음 — 콘솔 실험 메뉴(/lab/crawl, 저장 안 함)와 워커(store_crawl, store_sources 에 저장)가 같이 쓴다.
   소스마다 파일 하나, 결과는 common.ts 의 CrawlResult 하나로 맞춘다.
   네이버 플레이스·홈페이지는 헤드리스 크롬(playwright-core)을 띄운다 — 서버리스에서는 돌지 않는다. */

import type { CrawlResult, SourceKind } from './common'
import { crawlDaangn } from './daangn'
import { detectSource } from './detect'
import { crawlHomepage } from './homepage'
import { crawlInstagram } from './instagram'
import { crawlKakaoPlace } from './kakao-place'
import { crawlNaverPlace } from './naver-place'

export type { CrawlResult, SourceKind } from './common'
export { detectSource, SOURCES, sourceLabel } from './detect'

/** 매장 자료로 모을 수 있는 소스 (스마트스토어는 못 가져온다) */
export type StoreSourceKind = Exclude<SourceKind, 'smartstore'>
export const STORE_SOURCE_KINDS: StoreSourceKind[] = ['naver_place', 'kakao_place', 'daangn', 'instagram', 'homepage']
export const isStoreSourceKind = (k: unknown): k is StoreSourceKind => STORE_SOURCE_KINDS.includes(k as StoreSourceKind)

const RUN: Record<StoreSourceKind, (url: string) => Promise<CrawlResult>> = {
  naver_place: (u) => crawlNaverPlace(u),
  kakao_place: crawlKakaoPlace,
  daangn: crawlDaangn,
  homepage: crawlHomepage,
  instagram: crawlInstagram,
}

export const SMARTSTORE_MESSAGE =
  '스마트스토어는 네이버가 자동 접속을 로그인 화면으로 돌려보내서 가져올 수 없어요(화면 있는 브라우저로 열어도 429·로그인). ' +
  '상품 정보가 필요하면 ① 사장님께 상품 목록 엑셀(스마트스토어 판매자센터에서 내려받기)을 받거나 ② 네이버 쇼핑 검색 공식 API 로 스토어 이름을 검색하는 방법이 있어요.'

/** kind 를 주지 않으면 주소로 고른다 */
export async function runCrawl(url: string, kind?: SourceKind): Promise<CrawlResult> {
  const k = kind ?? detectSource(url)
  if (k === 'smartstore') throw new Error(SMARTSTORE_MESSAGE)
  const run = RUN[k]
  if (!run) throw new Error('알 수 없는 종류예요.')
  return run(url.trim().slice(0, 2000))
}

/** 저장용 — 디버그용 원본 데이터(raw, 네이버는 수 MB)는 뺀다. 화면·AI 정리에 쓰는 칸은 그대로 */
export function forStorage(r: CrawlResult): CrawlResult {
  return { ...r, raw: null }
}
