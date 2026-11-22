'use server'

import { runCrawl, SMARTSTORE_MESSAGE, type CrawlResult, type SourceKind } from '@marketing/core/crawl/index'
import { detectSource } from '@marketing/core/crawl/detect'
import { actionStaff, fail, type Result } from '@/lib/staff'

/* 실험 메뉴: 크롤링 테스트. 저장하지 않고 화면에만 보여 준다(매장에 저장하는 건 매장 상세 "자료 수집" → 워커 store_crawl).
   헤드리스 크롬을 띄우는 소스가 있어 한 번에 하나만 돌린다(여러 번 눌러도 브라우저가 쌓이지 않게). */
let running = false

/** kind 를 주지 않으면 주소로 고른다 */
export async function crawlAction(url: string, kind?: SourceKind): Promise<Result<{ data: CrawlResult }>> {
  await actionStaff()
  if (typeof url !== 'string' || !url.trim()) return fail('주소를 넣어 주세요.')
  const k = kind ?? detectSource(url)
  if (k === 'smartstore') return fail(SMARTSTORE_MESSAGE)
  if (running) return fail('다른 크롤링이 진행 중이에요. 끝난 뒤 다시 눌러 주세요.')
  running = true
  try {
    return { ok: true, data: await runCrawl(url, k) }
  } catch (e) {
    console.error('[crawl]', k, e)
    return fail(e instanceof Error ? e.message : '가져오지 못했어요.')
  } finally {
    running = false
  }
}
