'use server'

import { revalidatePath } from 'next/cache'
import type { StoreEvent } from '@marketing/core/events'
import { actionStore, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'

/* 매장 이벤트. 그 매장을 볼 수 있는 직원(담당자·슈퍼)이 넣고 고친다. */

export type EventInput = { title: string; startsOn: string; endsOn: string; offer: string; details: string }

const NEEDS_MIGRATION = 'DB에 매장 이벤트 표가 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0005_store_web_events.sql 을 먼저 돌려 주세요.'
const missingTable = (e: { code?: string; message: string }) => e.code === '42P01' || e.code === 'PGRST205' || e.message.includes('store_events')

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const DATE = /^\d{4}-\d{2}-\d{2}$/

function check(i: EventInput) {
  if (!clean(i.title, 80)) return { error: '이벤트 이름을 넣어 주세요.' }
  const startsOn = DATE.test(i.startsOn) ? i.startsOn : null
  const endsOn = DATE.test(i.endsOn) ? i.endsOn : null
  if (startsOn && endsOn && endsOn < startsOn) return { error: '끝나는 날이 시작일보다 빨라요.' }
  return { row: { title: clean(i.title, 80), starts_on: startsOn, ends_on: endsOn, offer: clean(i.offer, 120), details: clean(i.details, 1000) } }
}

/** id 가 없으면 새로 만든다 */
export async function saveEventAction(storeId: string, id: string | null, input: EventInput): Promise<Result<{ event: StoreEvent }>> {
  await actionStore(storeId)
  const c = check(input)
  if (!c.row) return fail(c.error!)
  const q = id
    ? db().from('store_events').update({ ...c.row, updated_at: new Date().toISOString() }).eq('id', id).eq('store_id', storeId).select('*').single()
    : db().from('store_events').insert({ ...c.row, store_id: storeId }).select('*').single()
  const { data, error } = await q
  if (error) return fail(missingTable(error) ? NEEDS_MIGRATION : `저장하지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true, event: data as StoreEvent }
}

/** 목록에서 내린다(지우지 않는다 — 이 이벤트로 만든 콘텐츠 기록은 남아 있다) */
export async function archiveEventAction(storeId: string, id: string, archived = true): Promise<Result> {
  await actionStore(storeId)
  const { error } = await db().from('store_events').update({ archived, updated_at: new Date().toISOString() }).eq('id', id).eq('store_id', storeId)
  if (error) return fail(missingTable(error) ? NEEDS_MIGRATION : `바꾸지 못했어요: ${error.message}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}
