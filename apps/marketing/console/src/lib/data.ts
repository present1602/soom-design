import 'server-only'
import type { Admin, Client, Content, ContentAsset, ContentPost, ModelStatus, MoodOption, Store, StoreChannel, VirtualModel } from '@marketing/core/types'
import { modelStatus } from '@marketing/core/types'
import type { StoreEvent } from '@marketing/core/events'
import { signMany } from './files'
import type { Staff } from './staff'
import { db } from './supabase'

/* 화면이 읽는 조회를 한곳에 둔다. 권한(어느 매장을 볼 수 있나)은 Staff.storeIds 로 거른다. */

function check<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}을(를) 불러오지 못했어요: ${r.error.message}`)
  return r.data as T
}

/** 화면으로 내려보내는 매장 행. 자료 API 토큰은 있는지만 알리고(값은 서버에만), 지난 자료(최대 1MB)는 뺀다. */
function safeStore(s: Store): Store {
  return { ...s, site_feed_url: s.site_feed_url ?? '', site_feed_token: s.site_feed_token ? 'set' : null, site_feed_cache: null, homepage_url: s.homepage_url ?? '', homepage_cache: null }
}

export type ManagerTag = { id: string; nickname: string }
export type StoreRow = Store & { channels: StoreChannel[]; managers: ManagerTag[]; lastUpload: string | null }
export type ClientGroup = { client: Client; stores: StoreRow[] }

/** 고객사 + 매장(보이는 것만). 매장이 하나도 안 보이는 고객사는 뺀다(슈퍼어드민은 매장 없는 고객사도 본다). */
export async function listClientGroups(staff: Staff, q: string): Promise<ClientGroup[]> {
  const [clients, stores, channels, managers, last] = await Promise.all([
    db().from('clients').select('*').order('created_at', { ascending: false }),
    db().from('stores').select('*').order('sort').order('created_at'),
    db().from('store_channels').select('*'),
    db().from('store_managers').select('store_id, admins(id, nickname)'),
    db().from('store_last_upload').select('*'),
  ])
  const chBy = groupBy((check(channels, '채널') as StoreChannel[]).map(hideTokens), (c) => c.store_id)
  const mgBy = groupBy(check(managers, '담당자') as unknown as { store_id: string; admins: ManagerTag | null }[], (m) => m.store_id)
  const lastBy = new Map((check(last, '최근 업로드') as { store_id: string; last_published_at: string }[]).map((r) => [r.store_id, r.last_published_at]))
  const storeRows: StoreRow[] = (check(stores, '매장') as Store[])
    .filter((s) => staff.storeIds === null || staff.storeIds.includes(s.id))
    .map((s) => ({
      ...safeStore(s),
      channels: chBy.get(s.id) ?? [],
      managers: (mgBy.get(s.id) ?? []).flatMap((m) => (m.admins ? [m.admins] : [])),
      lastUpload: lastBy.get(s.id) ?? null,
    }))
  const sBy = groupBy(storeRows, (s) => s.client_id)
  const needle = q.toLowerCase()
  return (check(clients, '고객사') as Client[])
    .map((client) => ({ client, stores: sBy.get(client.id) ?? [] }))
    .filter((g) => (staff.storeIds === null ? true : g.stores.length > 0))
    .filter(
      (g) =>
        !needle ||
        [g.client.name, g.client.code, g.client.rep_name, g.client.phone, ...g.stores.map((s) => s.name)].some((v) => v.toLowerCase().includes(needle)),
    )
}

/** 채널 토큰은 화면(클라이언트 컴포넌트)으로 넘어가지 않게 여기서 지운다. 토큰은 워커와 OAuth 콜백만 읽는다 */
function hideTokens(c: StoreChannel): StoreChannel {
  return { ...c, access_token: null, refresh_token: null }
}

export async function getStore(id: string) {
  const s = await db().from('stores').select('*').eq('id', id).maybeSingle()
  const raw = check(s, '매장') as Store | null
  if (!raw) return null
  const store = safeStore(raw)
  const [client, siblings, channels, managers] = await Promise.all([
    db().from('clients').select('*').eq('id', store.client_id).single(),
    db().from('stores').select('id, name, kind').eq('client_id', store.client_id).order('sort').order('created_at'),
    db().from('store_channels').select('*').eq('store_id', id),
    db().from('store_managers').select('admins(id, nickname, email)').eq('store_id', id),
  ])
  return {
    store,
    client: check(client, '고객사') as Client,
    siblings: check(siblings, '매장') as Pick<Store, 'id' | 'name' | 'kind'>[],
    channels: (check(channels, '채널') as StoreChannel[]).map(hideTokens),
    managers: (check(managers, '담당자') as unknown as { admins: { id: string; nickname: string; email: string } | null }[]).flatMap((m) => (m.admins ? [m.admins] : [])),
  }
}

/* ───────── 콘텐츠 목록 ───────── */

export type ContentRow = Content & {
  storeName: string
  clientName: string
  clientId: string
  modelName: string | null
  byName: string | null
  thumbUrl: string | null
  posts: ContentPost[]
}

export type ContentFilter = {
  storeIds: string[] | null
  q?: string
  clientId?: string
  type?: string
  platform?: string
  /** published = 올라간 것만(기본), all = 만들기만 한 것도 */
  scope?: 'published' | 'all'
}

export async function listContents(f: ContentFilter, page: number, per = 10) {
  let storeIds = f.storeIds
  if (f.clientId) {
    const { data } = await db().from('stores').select('id').eq('client_id', f.clientId)
    const ids = (data ?? []).map((r: { id: string }) => r.id)
    storeIds = storeIds === null ? ids : storeIds.filter((x) => ids.includes(x))
  }
  if (f.platform) {
    const { data } = await db().from('content_posts').select('content_id').eq('platform', f.platform).eq('status', 'done').limit(5000)
    const ids = [...new Set((data ?? []).map((r: { content_id: string }) => r.content_id))]
    if (!ids.length) return { rows: [], total: 0 }
    return query(storeIds, f, page, per, ids)
  }
  return query(storeIds, f, page, per, null)
}

async function query(storeIds: string[] | null, f: ContentFilter, page: number, per: number, contentIds: string[] | null) {
  if (storeIds !== null && !storeIds.length) return { rows: [] as ContentRow[], total: 0 }
  let q = db().from('contents').select('*', { count: 'exact' })
  if (storeIds !== null) q = q.in('store_id', storeIds)
  if (contentIds) q = q.in('id', contentIds)
  if (f.type === 'short' || f.type === 'banner') q = q.eq('type', f.type)
  if (f.q) q = q.ilike('title', `%${f.q.replace(/[%_]/g, '')}%`)
  if (f.scope !== 'all') q = q.not('published_at', 'is', null).order('published_at', { ascending: false })
  q = q.order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
  const r = await q
  const contents = check(r, '콘텐츠') as Content[]
  return { rows: await decorate(contents), total: r.count ?? 0 }
}

/** 목록 한 줄에 필요한 이름·썸네일·업로드 기록을 붙인다 */
export async function decorate(contents: Content[]): Promise<ContentRow[]> {
  if (!contents.length) return []
  const ids = contents.map((c) => c.id)
  const [stores, models, admins, assets, posts] = await Promise.all([
    db().from('stores').select('id, name, client_id, clients(name)').in('id', [...new Set(contents.map((c) => c.store_id))]),
    db().from('virtual_models').select('id, name').in('id', [...new Set(contents.map((c) => c.model_id).filter(Boolean))] as string[]),
    db().from('admins').select('id, nickname').in('id', [...new Set(contents.map((c) => c.created_by).filter(Boolean))] as string[]),
    db().from('content_assets').select('content_id, kind, path, selected').in('content_id', ids).in('kind', ['thumbnail', 'thumb_candidate', 'variant']).eq('selected', true),
    db().from('content_posts').select('*').in('content_id', ids).order('created_at'),
  ])
  const sMap = new Map((check(stores, '매장') as unknown as { id: string; name: string; client_id: string; clients: { name: string } | null }[]).map((s) => [s.id, s]))
  const mMap = new Map((check(models, '모델') as { id: string; name: string }[]).map((m) => [m.id, m.name]))
  const aMap = new Map((check(admins, '관리자') as { id: string; nickname: string }[]).map((a) => [a.id, a.nickname]))
  const thumbs = new Map<string, string>()
  // 직접 올린 썸네일 > 고른 추천 썸네일 > 고른 배너 시안
  const rank = { thumbnail: 0, thumb_candidate: 1, variant: 2 } as Record<string, number>
  for (const a of (check(assets, '파일') as Pick<ContentAsset, 'content_id' | 'kind' | 'path'>[]).sort((x, y) => rank[x.kind] - rank[y.kind])) {
    if (!thumbs.has(a.content_id)) thumbs.set(a.content_id, a.path)
  }
  const signed = await signMany([...thumbs.values()])
  const pBy = groupBy(check(posts, '업로드') as ContentPost[], (p) => p.content_id)
  return contents.map((c) => {
    const s = sMap.get(c.store_id)
    return {
      ...c,
      storeName: s?.name ?? '',
      clientName: s?.clients?.name ?? '',
      clientId: s?.client_id ?? '',
      modelName: c.model_id ? (mMap.get(c.model_id) ?? null) : null,
      byName: c.created_by ? (aMap.get(c.created_by) ?? null) : null,
      thumbUrl: signed.get(thumbs.get(c.id) ?? '') ?? null,
      posts: pBy.get(c.id) ?? [],
    }
  })
}

/* ───────── 모델 · 옵션 · 관리자 ───────── */

export type ModelCard = VirtualModel & { coverUrl: string | null; state: ModelStatus }
/** usable: 콘텐츠 생성에서 고를 수 있는 모델(공개)만. 아니면 대기·공개·숨김 전부.
    상태는 modelStatus() 로 읽는다 — 0008 전 DB(status 칸 없음)에서도 archived 로 판단해 동작한다 */
export async function listModels(opts: { usable?: boolean } = {}): Promise<ModelCard[]> {
  const r = await db().from('virtual_models').select('*').order('created_at')
  const models = (check(r, '가상 모델') as VirtualModel[]).filter((m) => !opts.usable || modelStatus(m) === 'published')
  const signed = await signMany(models.map((m) => m.cover_path))
  return models.map((m) => ({ ...m, state: modelStatus(m), coverUrl: m.cover_path ? (signed.get(m.cover_path) ?? null) : null }))
}

export async function listMoods(activeOnly: boolean) {
  let q = db().from('mood_options').select('*').order('sort').order('created_at')
  if (activeOnly) q = q.eq('active', true)
  return check(await q, '분위기 옵션') as MoodOption[]
}

export async function listAdmins() {
  return check(await db().from('admins').select('*').order('role', { ascending: false }).order('created_at'), '관리자') as Admin[]
}

export function groupBy<T>(list: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of list) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}

/** 매장 정보 화면의 "홈페이지 자료" 미리보기. 0002_site_feed.sql 전이면 null. 0005 전이면 홈페이지 칸은 비어 있다 */
export async function getSiteFeedPreview(storeId: string) {
  const { data, error } = await db().from('stores').select('site_feed_cache, site_feed_fetched_at, site_feed_error').eq('id', storeId).maybeSingle()
  if (error) return null
  const r = data as Pick<Store, 'site_feed_cache' | 'site_feed_fetched_at' | 'site_feed_error'> | null
  const hp = await db().from('stores').select('homepage_cache, homepage_fetched_at, homepage_error').eq('id', storeId).maybeSingle()
  const h = (hp.error ? null : hp.data) as Pick<Store, 'homepage_cache' | 'homepage_fetched_at' | 'homepage_error'> | null
  return {
    fetchedAt: r?.site_feed_fetched_at ?? null,
    error: r?.site_feed_error ?? null,
    items: r?.site_feed_cache?.items.length ?? 0,
    notices: r?.site_feed_cache?.notices?.length ?? 0,
    sample: (r?.site_feed_cache?.items ?? []).slice(0, 5).map((i) => [i.name, i.price].filter(Boolean).join(' · ')),
    /** 0005 를 돌렸는지 */
    homepageReady: !hp.error,
    homepage: {
      fetchedAt: h?.homepage_fetched_at ?? null,
      error: h?.homepage_error ?? null,
      title: h?.homepage_cache?.title ?? null,
      description: h?.homepage_cache?.description ?? null,
      chars: h?.homepage_cache?.text.length ?? 0,
    },
  }
}
export type SiteFeedPreview = NonNullable<Awaited<ReturnType<typeof getSiteFeedPreview>>>

/** 매장 이벤트. 0005 전이면 null */
export async function listStoreEvents(storeId: string, withArchived = false) {
  let q = db().from('store_events').select('*').eq('store_id', storeId)
  if (!withArchived) q = q.eq('archived', false)
  const { data, error } = await q.order('archived').order('created_at', { ascending: false }).limit(200)
  if (error) return null
  return data as StoreEvent[]
}
