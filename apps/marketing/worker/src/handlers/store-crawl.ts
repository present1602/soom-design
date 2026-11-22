import { forStorage, isStoreSourceKind, runCrawl, type CrawlResult } from '@marketing/core/crawl/index'
import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import type { StoreSource } from '@marketing/core/types'
import { db, must } from '../db'

/* 매장 자료 소스 하나 가져오기 (store_crawl).
   성공하면 지금 data 를 prev_data 로 밀고 새 결과를 data 에 둔다. 실패하면 error 만 적는다(index.ts) — 지난 data 는 그대로.
   헤드리스 크롬은 크롤러가 띄우고 닫는다. 워커는 작업을 하나씩 처리해서 브라우저가 쌓이지 않는다. */

export function crawlCounts(d: CrawlResult): Record<string, number> {
  return {
    photos: d.photos.length,
    menus: d.menus.length,
    news: d.news.length,
    reviews: d.reviews.length,
    coupons: d.coupons.length,
    texts: d.texts.length,
    links: d.links.length,
  }
}

export async function storeCrawlJob(p: JobPayloads['store_crawl']): Promise<JobResults['store_crawl']> {
  const src = (await must(db.from('store_sources').select('*').eq('id', p.sourceId).maybeSingle(), '자료 소스 조회')) as StoreSource | null
  if (!src) throw new Error('자료 소스를 찾지 못했어요. 지워졌을 수 있어요.')
  if (!isStoreSourceKind(src.kind)) throw new Error(`가져올 수 없는 종류예요: ${src.kind}`)
  const started = Date.now()
  const data = forStorage(await runCrawl(src.url, src.kind))
  const now = new Date().toISOString()
  await must(
    db
      .from('store_sources')
      .update({ data, fetched_at: now, prev_data: src.data, prev_fetched_at: src.fetched_at, error: null, updated_at: now })
      .eq('id', src.id),
    '자료 저장',
  )
  return { name: data.name, counts: crawlCounts(data), ms: Date.now() - started }
}
