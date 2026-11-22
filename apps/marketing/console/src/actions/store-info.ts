'use server'

import type { CrawlResult } from '@marketing/core/crawl/common'
import { sourceLabel } from '@marketing/core/crawl/detect'
import { PLATFORM_INFO } from '@marketing/core/channels'
import type { StoreSource } from '@marketing/core/types'
import { getSiteFeedPreview, getStore, listStoreEvents } from '@/lib/data'
import { actionStore, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { sourcesMissing } from '@/lib/sources'

/* 콘텐츠 생성 > 매장 고르기의 "정보" 창. 한 매장의 입력된 정보 + 자료 수집(크롤링) 결과 요약을 한 번에 준다.
   크롤링 결과 전체(사진 수백 장 주소)는 보내지 않고 글 위주로 줄인다. 전체는 매장 상세 "자료 수집" 탭에서 본다. */

export type SourceSummary = {
  kind: string
  label: string
  url: string
  name: string | null
  fetchedAt: string | null
  error: string | null
  category: string | null
  description: string | null
  address: string | null
  phone: string | null
  hours: string[]
  keywords: string[]
  menus: { name: string; price: string | null }[]
  menuTotal: number
  news: { title: string; when: string | null }[]
  briefing: string[]
  reviewKeywords: string[]
  reviewScore: number | null
  reviewTotal: number | null
  conveniences: string[]
  links: string[]
  photos: number
}

export type StoreInfo = {
  clientName: string
  clientCode: string
  repName: string
  storeName: string
  kind: 'store' | 'brand'
  address: string
  phone: string
  hours: string
  intro: string
  homepageUrl: string
  channels: { platform: string; handle: string; status: string }[]
  managers: string[]
  events: { title: string; period: string; offer: string; details: string }[]
  siteFeed: { items: number; sample: string[]; homepageTitle: string | null; homepageDescription: string | null } | null
  sources: SourceSummary[] | null
}

function summarize(s: StoreSource): SourceSummary {
  const d = s.data as CrawlResult | null
  return {
    kind: s.kind,
    label: sourceLabel(s.kind),
    url: s.url,
    name: d?.name ?? null,
    fetchedAt: s.fetched_at,
    error: s.error,
    category: d?.category ?? null,
    description: d?.description ?? null,
    address: d?.roadAddress || d?.address || null,
    phone: d?.phone ?? null,
    hours: (d?.hours ?? []).slice(0, 8).map((h) => `${h.day} ${h.open && h.close ? `${h.open}–${h.close}` : (h.note ?? '휴무')}`),
    keywords: (d?.keywords ?? []).slice(0, 12),
    menus: (d?.menus ?? []).slice(0, 20).map((m) => ({ name: m.name, price: m.price })),
    menuTotal: d?.menus.length ?? 0,
    news: (d?.news ?? []).slice(0, 5).map((n) => ({ title: n.title, when: n.when ?? n.period })),
    briefing: (d?.briefing ?? []).slice(0, 4).map((b) => b.sentence),
    reviewKeywords: (d?.reviewKeywords ?? []).slice(0, 10).map((k) => `${k.name} ${k.count}`),
    reviewScore: d?.reviewScore ?? null,
    reviewTotal: d?.reviewTotal ?? null,
    conveniences: (d?.conveniences ?? []).slice(0, 12),
    links: (d?.links ?? []).slice(0, 8).map((l) => l.url),
    photos: d?.photos.length ?? 0,
  }
}

const period = (a: string | null, b: string | null) => (a || b ? `${a ?? ''} ~ ${b ?? ''}`.trim() : '상시')

export async function getStoreInfoAction(storeId: string): Promise<Result<{ info: StoreInfo }>> {
  await actionStore(storeId)
  const d = await getStore(storeId)
  if (!d) return fail('매장을 찾지 못했어요. 새로고침해 주세요.')
  const [events, feed, src] = await Promise.all([
    listStoreEvents(storeId),
    getSiteFeedPreview(storeId),
    db().from('store_sources').select('*').eq('store_id', storeId).order('created_at'),
  ])
  const s = d.store
  return {
    ok: true,
    info: {
      clientName: d.client.name,
      clientCode: d.client.code,
      repName: d.client.rep_name,
      storeName: s.name,
      kind: s.kind,
      address: s.address,
      phone: s.phone,
      hours: s.hours,
      intro: s.intro,
      homepageUrl: s.homepage_url ?? '',
      channels: d.channels.map((c) => ({ platform: PLATFORM_INFO[c.platform]?.name ?? c.platform, handle: c.handle, status: c.status })),
      managers: d.managers.map((m) => m.nickname),
      events: (events ?? []).map((e) => ({ title: e.title, period: period(e.starts_on, e.ends_on), offer: e.offer, details: e.details })),
      siteFeed: feed && (feed.items || feed.homepage.title) ? { items: feed.items, sample: feed.sample, homepageTitle: feed.homepage.title, homepageDescription: feed.homepage.description } : null,
      // 0007 전이면 null (화면이 안내한다)
      sources: src.error ? (sourcesMissing(src.error) ? null : []) : ((src.data ?? []) as StoreSource[]).map(summarize),
    },
  }
}
