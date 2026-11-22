import 'server-only'
import type { CrawlResult } from '@marketing/core/crawl/index'
import type { StoreSource } from '@marketing/core/types'
import { db } from './supabase'

export const SOURCES_MIGRATION = 'DB에 자료 수집 표가 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0007_store_sources.sql 을 먼저 돌려 주세요.'
export const sourcesMissing = (e: { code?: string; message: string }) => e.code === '42P01' || e.code === 'PGRST205' || /store_sources/.test(e.message)

/** 목록 화면용 요약 — 결과 전체(사진 수백 장 주소)는 보내지 않는다 */
export type SourceRow = {
  id: string
  kind: StoreSource['kind']
  url: string
  name: string | null
  fetchedAt: string | null
  prevFetchedAt: string | null
  error: string | null
  running: boolean
  counts: { label: string; n: number; prev: number | null }[]
  cover: string | null
}

const COUNT_FIELDS: [keyof CrawlResult, string][] = [
  ['menus', '메뉴'],
  ['photos', '사진'],
  ['news', '소식'],
  ['reviews', '리뷰'],
  ['coupons', '쿠폰'],
  ['texts', '페이지 글'],
]

const len = (d: CrawlResult | null, k: keyof CrawlResult) => (d && Array.isArray(d[k]) ? (d[k] as unknown[]).length : null)

export async function listStoreSources(storeId: string): Promise<{ rows: SourceRow[]; missing: boolean }> {
  const { data, error } = await db().from('store_sources').select('*').eq('store_id', storeId).order('created_at')
  if (error) {
    if (sourcesMissing(error)) return { rows: [], missing: true }
    throw new Error(`자료 소스를 읽지 못했어요: ${error.message}`)
  }
  const srcs = (data ?? []) as StoreSource[]
  const { data: jobs } = srcs.length
    ? await db().from('jobs').select('payload').eq('kind', 'store_crawl').in('status', ['queued', 'running']).in('payload->>sourceId', srcs.map((s) => s.id))
    : { data: [] }
  const busy = new Set(((jobs ?? []) as { payload: { sourceId: string } }[]).map((j) => j.payload.sourceId))
  return {
    missing: false,
    rows: srcs.map((s) => {
      const d = s.data as CrawlResult | null
      const p = s.prev_data as CrawlResult | null
      const cover = d?.photos.find((x) => x.source === 'business' || x.source === 'og' || x.source === 'profile') ?? d?.photos[0]
      return {
        id: s.id,
        kind: s.kind,
        url: s.url,
        name: d?.name ?? null,
        fetchedAt: s.fetched_at,
        prevFetchedAt: s.prev_fetched_at,
        error: s.error,
        running: busy.has(s.id),
        counts: COUNT_FIELDS.map(([k, label]) => ({ label, n: len(d, k) ?? 0, prev: len(p, k) })).filter((c) => c.n > 0 || (c.prev ?? 0) > 0),
        cover: cover?.thumb || cover?.url || null,
      }
    }),
  }
}
