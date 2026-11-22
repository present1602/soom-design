'use server'

import { revalidatePath } from 'next/cache'
import { detectSource, isStoreSourceKind, SMARTSTORE_MESSAGE, sourceLabel, type CrawlResult, type SourceKind } from '@marketing/core/crawl/index'
import { actionStore, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { SOURCES_MIGRATION, sourcesMissing } from '@/lib/sources'

/* 매장 자료 수집. 소스 주소를 등록하면 바로 워커(store_crawl)가 가져와 store_sources 에 저장한다.
   소스 종류마다 한 줄(매장 × 종류). 주소를 바꾸면 지난 결과는 다른 곳의 자료라 비운다. */

const path = (storeId: string) => `/stores/${storeId}/sources`

function checkUrl(raw: string) {
  const url = raw.trim()
  if (!url) return { error: '주소를 넣어 주세요.' }
  if (/^\d{5,}$/.test(url)) return { url } // 네이버 플레이스 번호만 넣은 경우
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
  } catch {
    return { error: '주소 형식이 올바르지 않아요.' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'http·https 주소만 넣을 수 있어요.' }
  return { url: u.toString().slice(0, 2000) }
}

async function running(sourceIds: string[]) {
  if (!sourceIds.length) return new Set<string>()
  const { data } = await db().from('jobs').select('payload').eq('kind', 'store_crawl').in('status', ['queued', 'running']).in('payload->>sourceId', sourceIds)
  return new Set(((data ?? []) as { payload: { sourceId: string } }[]).map((j) => j.payload.sourceId))
}

async function enqueue(sourceIds: string[]) {
  const busy = await running(sourceIds)
  const todo = sourceIds.filter((id) => !busy.has(id))
  if (!todo.length) return null
  const { error } = await db().from('jobs').insert(todo.map((sourceId) => ({ kind: 'store_crawl', payload: { sourceId } })))
  return error ? `가져오기를 시작하지 못했어요: ${error.message}` : null
}

/** 소스 등록(또는 같은 종류의 주소 바꾸기) + 바로 가져오기 */
export async function addStoreSourceAction(storeId: string, rawUrl: string, kind?: SourceKind): Promise<Result> {
  await actionStore(storeId)
  const c = checkUrl(rawUrl)
  if (c.error) return fail(c.error)
  const k = kind ?? detectSource(c.url!)
  if (k === 'smartstore') return fail(SMARTSTORE_MESSAGE)
  if (!isStoreSourceKind(k)) return fail('가져올 수 없는 주소 종류예요.')

  const { data: cur, error: readErr } = await db().from('store_sources').select('id, url').eq('store_id', storeId).eq('kind', k).maybeSingle()
  if (readErr) return fail(sourcesMissing(readErr) ? SOURCES_MIGRATION : `확인하지 못했어요: ${readErr.message}`)
  let id: string
  if (cur) {
    if (cur.url === c.url) return fail(`이미 등록된 ${sourceLabel(k)} 주소예요. "다시 가져오기"를 눌러 주세요.`)
    if ((await running([cur.id])).size) return fail(`${sourceLabel(k)}을(를) 가져오는 중이에요. 끝난 뒤 바꿔 주세요.`)
    const { error } = await db().from('store_sources').update({ url: c.url, data: null, fetched_at: null, prev_data: null, prev_fetched_at: null, error: null, updated_at: new Date().toISOString() }).eq('id', cur.id)
    if (error) return fail(`주소를 바꾸지 못했어요: ${error.message}`)
    id = cur.id
  } else {
    const { data, error } = await db().from('store_sources').insert({ store_id: storeId, kind: k, url: c.url }).select('id').single()
    if (error) return fail(sourcesMissing(error) ? SOURCES_MIGRATION : `등록하지 못했어요: ${error.message}`)
    id = data.id
  }
  const qErr = await enqueue([id])
  revalidatePath(path(storeId))
  return qErr ? fail(`주소는 저장했어요. ${qErr}`) : { ok: true }
}

async function ownSource(sourceId: string) {
  const { data } = await db().from('store_sources').select('id, store_id').eq('id', sourceId).maybeSingle()
  return data as { id: string; store_id: string } | null
}

export async function recrawlStoreSourceAction(sourceId: string): Promise<Result> {
  const src = await ownSource(sourceId)
  if (!src) return fail('자료 소스를 찾지 못했어요. 새로고침해 주세요.')
  await actionStore(src.store_id)
  if ((await running([sourceId])).size) return fail('지금 가져오고 있어요. 잠시만 기다려 주세요.')
  const err = await enqueue([sourceId])
  if (err) return fail(err)
  await db().from('store_sources').update({ error: null }).eq('id', sourceId)
  revalidatePath(path(src.store_id))
  return { ok: true }
}

/** 이 매장의 소스 전부 다시 가져오기 (가져오는 중인 것은 건너뛴다) */
export async function recrawlAllStoreSourcesAction(storeId: string): Promise<Result<{ started: number }>> {
  await actionStore(storeId)
  const { data, error } = await db().from('store_sources').select('id').eq('store_id', storeId)
  if (error) return fail(sourcesMissing(error) ? SOURCES_MIGRATION : `읽지 못했어요: ${error.message}`)
  const ids = (data ?? []).map((r: { id: string }) => r.id)
  if (!ids.length) return fail('등록된 주소가 없어요. 먼저 주소를 추가해 주세요.')
  const busy = await running(ids)
  const err = await enqueue(ids)
  if (err) return fail(err)
  revalidatePath(path(storeId))
  return { ok: true, started: ids.length - busy.size }
}

export async function removeStoreSourceAction(sourceId: string): Promise<Result> {
  const src = await ownSource(sourceId)
  if (!src) return fail('자료 소스를 찾지 못했어요. 새로고침해 주세요.')
  await actionStore(src.store_id)
  if ((await running([sourceId])).size) return fail('가져오는 중에는 지울 수 없어요. 끝난 뒤 지워 주세요.')
  const { error } = await db().from('store_sources').delete().eq('id', sourceId)
  if (error) return fail(`지우지 못했어요: ${error.message}`)
  revalidatePath(path(src.store_id))
  return { ok: true }
}

/** 저장된 결과 전체 (목록에는 요약만 보내고, "결과 보기"를 누를 때 받는다) */
export async function getStoreSourceDataAction(sourceId: string, which: 'data' | 'prev_data' = 'data'): Promise<Result<{ data: CrawlResult }>> {
  const src = await ownSource(sourceId)
  if (!src) return fail('자료 소스를 찾지 못했어요. 새로고침해 주세요.')
  await actionStore(src.store_id)
  const { data, error } = await db().from('store_sources').select(which).eq('id', sourceId).single()
  if (error) return fail(`읽지 못했어요: ${error.message}`)
  const d = (data as Record<string, unknown>)[which] as CrawlResult | null
  if (!d) return fail(which === 'data' ? '아직 가져온 결과가 없어요.' : '직전 결과가 없어요.')
  return { ok: true, data: d }
}
