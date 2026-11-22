'use server'

import { revalidatePath } from 'next/cache'
import { isPlatform, PLATFORM_INFO, type Platform } from '@marketing/core/channels'
import { checkHomepageUrl, fetchHomepage } from '@marketing/core/homepage'
import { canConnect } from '@marketing/core/oauth'
import { checkFeedUrl, fetchSiteFeed } from '@marketing/core/site-feed'
import { baseUrl, missingKeys, signState } from '@/lib/oauth'
import { actionStaff, actionStore, actionSuper, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'

const PHONE = /^[0-9+\-\s()]{7,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: unknown, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export type ClientInput = { name: string; rep: string; phone: string; email: string }

function checkClient(c: ClientInput) {
  if (!clean(c.name)) return '고객사명을 넣어 주세요.'
  if (!clean(c.rep)) return '대표자 이름을 넣어 주세요.'
  if (!PHONE.test(clean(c.phone))) return '연락처를 010-0000-0000 처럼 넣어 주세요.'
  if (clean(c.email) && !EMAIL.test(clean(c.email))) return '이메일 형식이 맞지 않아요. 없으면 비워 두세요.'
  return null
}

/** 고객사 등록 = 고객사 + 첫 매장 + 담당자 한 명 */
export async function createClientAction(input: ClientInput & { storeName: string; kind: 'store' | 'brand'; managerId: string }): Promise<Result<{ storeId: string }>> {
  await actionSuper()
  const bad = checkClient(input)
  if (bad) return fail(bad)
  if (!clean(input.storeName)) return fail('첫 매장(또는 브랜드) 이름을 넣어 주세요.')

  const c = await db()
    .from('clients')
    .insert({ name: clean(input.name), rep_name: clean(input.rep), phone: clean(input.phone), email: clean(input.email) || null })
    .select('id')
    .single()
  if (c.error) return fail(`고객사를 저장하지 못했어요: ${c.error.message}`)
  const s = await db()
    .from('stores')
    .insert({ client_id: c.data.id, name: clean(input.storeName), kind: input.kind === 'brand' ? 'brand' : 'store' })
    .select('id')
    .single()
  if (s.error) return fail(`매장을 저장하지 못했어요: ${s.error.message}`)
  if (input.managerId) {
    const m = await db().from('store_managers').insert({ store_id: s.data.id, admin_id: input.managerId })
    if (m.error) return fail(`담당자를 지정하지 못했어요: ${m.error.message}`)
  }
  revalidatePath('/clients')
  return { ok: true, storeId: s.data.id }
}

export async function updateClientAction(storeId: string, clientId: string, input: ClientInput): Promise<Result> {
  await actionStore(storeId)
  const bad = checkClient(input)
  if (bad) return fail(bad)
  const { error } = await db()
    .from('clients')
    .update({ name: clean(input.name), rep_name: clean(input.rep), phone: clean(input.phone), email: clean(input.email) || null, updated_at: new Date().toISOString() })
    .eq('id', clientId)
  if (error) return fail(`저장하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export type StoreInput = { name: string; kind: 'store' | 'brand'; address: string; phone: string; hours: string; intro: string }

export async function updateStoreAction(storeId: string, input: StoreInput): Promise<Result> {
  await actionStore(storeId)
  if (!clean(input.name)) return fail('매장 이름을 넣어 주세요.')
  const { error } = await db()
    .from('stores')
    .update({
      name: clean(input.name),
      kind: input.kind === 'brand' ? 'brand' : 'store',
      address: clean(input.address),
      phone: clean(input.phone, 40),
      hours: clean(input.hours),
      intro: clean(input.intro, 2000),
    })
    .eq('id', storeId)
  if (error) return fail(`저장하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function addStoreAction(clientId: string, input: { name: string; kind: 'store' | 'brand'; managerId: string }): Promise<Result<{ storeId: string }>> {
  await actionSuper()
  if (!clean(input.name)) return fail('이름을 넣어 주세요.')
  const { count } = await db().from('stores').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
  const s = await db()
    .from('stores')
    .insert({ client_id: clientId, name: clean(input.name), kind: input.kind === 'brand' ? 'brand' : 'store', sort: count ?? 0 })
    .select('id')
    .single()
  if (s.error) return fail(`추가하지 못했어요: ${s.error.message}`)
  if (input.managerId) await db().from('store_managers').insert({ store_id: s.data.id, admin_id: input.managerId })
  revalidatePath('/', 'layout')
  return { ok: true, storeId: s.data.id }
}

/* ───────── 홈페이지 자료 API ───────── */

const NEEDS_MIGRATION = 'DB에 홈페이지 자료 칸이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0002_site_feed.sql 을 먼저 돌려 주세요.'
const missingColumn = (e: { code?: string; message: string }) => e.code === '42703' || e.code === 'PGRST204' || e.message.includes('site_feed') || e.message.includes('homepage')

/** 저장된 주소·토큰으로 지금 불러와 본다. 성공하면 지난 자료로도 남긴다. */
export async function testSiteFeedAction(storeId: string): Promise<Result<{ items: number; notices: number }>> {
  await actionStore(storeId)
  const { data, error } = await db().from('stores').select('site_feed_url, site_feed_token').eq('id', storeId).maybeSingle()
  if (error) return fail(missingColumn(error) ? NEEDS_MIGRATION : `불러오지 못했어요: ${error.message}`)
  const row = data as { site_feed_url: string; site_feed_token: string | null } | null
  if (!row?.site_feed_url) return fail('자료 주소를 먼저 저장해 주세요.')
  try {
    const feed = await fetchSiteFeed(row.site_feed_url, row.site_feed_token)
    await db().from('stores').update({ site_feed_cache: feed, site_feed_fetched_at: new Date().toISOString(), site_feed_error: null }).eq('id', storeId)
    revalidatePath('/', 'layout')
    if (!feed.items.length && !feed.notices?.length) return fail('연결은 됐지만 상품·공지가 하나도 없어요. 응답의 items 를 확인해 주세요.')
    return { ok: true, items: feed.items.length, notices: feed.notices?.length ?? 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db().from('stores').update({ site_feed_error: msg }).eq('id', storeId)
    revalidatePath('/', 'layout')
    return fail(msg)
  }
}

/* ───────── 홈페이지 (주소 + 자료 API 사용 여부) ───────── */

const NEEDS_0005 = 'DB에 홈페이지 주소 칸이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0005_store_web_events.sql 을 먼저 돌려 주세요.'

/** 홈페이지 주소와 자료 API 를 한 번에 저장한다. useApi 를 끄면 API 주소·토큰·지난 자료를 지운다.
    token: undefined = 그대로 둠, 값 = 바꿈 */
export async function saveWebSourceAction(storeId: string, input: { homepageUrl: string; useApi: boolean; apiUrl: string; token?: string }): Promise<Result> {
  await actionStore(storeId)
  const homepage = clean(input.homepageUrl, 1000)
  const badHome = checkHomepageUrl(homepage)
  if (badHome) return fail(badHome)
  const apiUrl = input.useApi ? clean(input.apiUrl, 1000) : ''
  if (input.useApi && !apiUrl) return fail('자료 API 주소를 넣거나 "API로 가져오기"를 꺼 주세요.')
  const badApi = checkFeedUrl(apiUrl)
  if (badApi) return fail(badApi)

  const row: Record<string, unknown> = { site_feed_url: apiUrl }
  if (input.token !== undefined) row.site_feed_token = clean(input.token, 500) || null
  if (!apiUrl) Object.assign(row, { site_feed_token: null, site_feed_cache: null, site_feed_fetched_at: null, site_feed_error: null })
  const { data: cur } = await db().from('stores').select('homepage_url').eq('id', storeId).maybeSingle()
  const changed = (cur as { homepage_url?: string } | null)?.homepage_url !== homepage
  Object.assign(row, { homepage_url: homepage }, changed ? { homepage_cache: null, homepage_fetched_at: null, homepage_error: null } : {})

  let { error } = await db().from('stores').update(row).eq('id', storeId)
  // 0005 전: 홈페이지 주소를 비워 둔 거면 API 칸만 저장한다
  if (error && missingColumn(error) && !homepage) {
    for (const k of ['homepage_url', 'homepage_cache', 'homepage_fetched_at', 'homepage_error']) delete row[k]
    ;({ error } = await db().from('stores').update(row).eq('id', storeId))
  }
  if (error) return fail(missingColumn(error) ? (error.message.includes('homepage') ? NEEDS_0005 : NEEDS_MIGRATION) : `저장하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** 저장된 홈페이지 주소를 지금 읽어 본다. 성공하면 지난 결과로도 남긴다. */
export async function testHomepageAction(storeId: string): Promise<Result<{ title: string; chars: number }>> {
  await actionStore(storeId)
  const { data, error } = await db().from('stores').select('homepage_url').eq('id', storeId).maybeSingle()
  if (error) return fail(missingColumn(error) ? NEEDS_0005 : `불러오지 못했어요: ${error.message}`)
  const url = (data as { homepage_url: string } | null)?.homepage_url
  if (!url) return fail('홈페이지 주소를 먼저 저장해 주세요.')
  try {
    const snap = await fetchHomepage(url)
    await db().from('stores').update({ homepage_cache: snap, homepage_fetched_at: new Date().toISOString(), homepage_error: null }).eq('id', storeId)
    revalidatePath('/', 'layout')
    return { ok: true, title: snap.title ?? '', chars: snap.text.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db().from('stores').update({ homepage_error: msg }).eq('id', storeId)
    revalidatePath('/', 'layout')
    return fail(msg)
  }
}

/* ───────── 채널 ───────── */

export async function saveChannelAction(storeId: string, platform: Platform, input: { handle: string; profileUrl: string; kakaoManager?: boolean }): Promise<Result> {
  await actionStore(storeId)
  if (!isPlatform(platform)) return fail('알 수 없는 플랫폼이에요.')
  const handle = clean(input.handle, 120)
  const url = clean(input.profileUrl, 500)
  if (!handle) return fail(`${PLATFORM_INFO[platform].name} 계정 이름을 넣어 주세요.`)
  if (url && !/^https?:\/\//.test(url)) return fail('프로필 주소는 https:// 로 시작해야 해요.')

  const { data: existing } = await db().from('store_channels').select('id, status').eq('store_id', storeId).eq('platform', platform).maybeSingle()
  // 카카오는 API 가 없어서 "매니저 초대됨" 여부만 적는다. 나머지는 고객이 허용해야 connected 가 된다.
  const status = platform === 'kakao' ? (input.kakaoManager ? 'manager' : 'pending') : (existing?.status ?? 'pending')
  const row = { store_id: storeId, platform, handle, profile_url: url, status, updated_at: new Date().toISOString() }
  const { error } = existing ? await db().from('store_channels').update(row).eq('id', existing.id) : await db().from('store_channels').insert(row)
  if (error) return fail(`저장하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** 고객에게 보낼 연결 링크 (7일). 고객이 열어 플랫폼에서 직접 로그인·허용하면 채널이 "연결됨"이 된다 */
export async function createConnectLinkAction(storeId: string, platform: Platform): Promise<Result<{ url: string }>> {
  await actionStore(storeId)
  if (!canConnect(platform)) return fail(`${PLATFORM_INFO[platform]?.name ?? platform} 연결은 아직 준비 중이에요.`)
  const missing = missingKeys(platform)
  if (missing) return fail(missing)
  return { ok: true, url: `${await baseUrl()}/connect/${signState(storeId, platform)}` }
}

export async function removeChannelAction(storeId: string, platform: Platform): Promise<Result> {
  await actionStore(storeId)
  const { error } = await db().from('store_channels').delete().eq('store_id', storeId).eq('platform', platform)
  if (error) return fail(`해제하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ───────── 담당자 (슈퍼어드민) ───────── */

export async function addStoreManagerAction(storeId: string, adminId: string): Promise<Result> {
  await actionSuper()
  if (!adminId) return fail('추가할 담당자를 골라 주세요.')
  const { error } = await db().from('store_managers').insert({ store_id: storeId, admin_id: adminId })
  if (error) return fail(error.code === '23505' ? '이미 이 매장 담당자예요.' : `추가하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removeStoreManagerAction(storeId: string, adminId: string): Promise<Result> {
  await actionSuper()
  const { count } = await db().from('store_managers').select('admin_id', { count: 'exact', head: true }).eq('store_id', storeId)
  if ((count ?? 0) <= 1) return fail('담당자는 최소 한 명이어야 해요. 다른 사람을 먼저 추가해 주세요.')
  const { error } = await db().from('store_managers').delete().eq('store_id', storeId).eq('admin_id', adminId)
  if (error) return fail(`제외하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** 고객사 목록 다이얼로그에서 담당자 고를 때 */
export async function listManagerOptions(): Promise<{ id: string; nickname: string; email: string }[]> {
  await actionStaff()
  const { data } = await db().from('admins').select('id, nickname, email').eq('active', true).order('nickname')
  return data ?? []
}
