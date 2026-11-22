import 'server-only'
import { cache } from 'react'
import { redirect, unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'
import type { Admin } from '@marketing/core/types'
import { authClient, configured, db } from './supabase'

/* 들어올 수 있는 사람 = admins 표에 있고 active 인 사람.
   SUPER_ADMIN_EMAILS 의 이메일은 처음 로그인할 때 슈퍼어드민으로 자동 등록된다(첫 사람을 넣을 방법). */
function bootstrapEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export type Staff = Admin & { storeIds: string[] | null }

/** 요청당 한 번만 묻는다. 로그인 안 했거나 등록되지 않았으면 null. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!configured) return null
  // 로그인에 따라 화면이 달라진다 — 빌드 때 미리 그리지 않고 요청마다 그린다
  await connection()
  try {
    const { data } = await (await authClient()).auth.getUser()
    const email = data.user?.email?.toLowerCase()
    if (!email) return null

    let { data: row } = await db().from('admins').select('*').ilike('email', email).maybeSingle()
    if (!row && bootstrapEmails().includes(email)) {
      const ins = await db()
        .from('admins')
        .insert({ email, nickname: email.split('@')[0], role: 'super' })
        .select('*')
        .single()
      row = ins.data
    }
    const admin = row as Admin | null
    if (!admin || !admin.active) return null

    // 콘텐츠 관리자는 할당된 매장만. 슈퍼어드민은 null(전체).
    let storeIds: string[] | null = null
    if (admin.role !== 'super') {
      const { data: rows } = await db().from('store_managers').select('store_id').eq('admin_id', admin.id)
      storeIds = (rows ?? []).map((r: { store_id: string }) => r.store_id)
    }
    return { ...admin, storeIds }
  } catch (e) {
    unstable_rethrow(e) // Next 내부 신호(동적 렌더링·redirect)는 삼키지 않는다
    console.error('[staff]', e)
    return null
  }
})

/** 화면용: 없으면 로그인으로 보낸다 */
export async function requireStaff() {
  const s = await getStaff()
  if (!s) redirect('/login')
  return s
}

/** 화면용: 슈퍼어드민이 아니면 첫 화면으로 */
export async function requireSuper() {
  const s = await requireStaff()
  if (s.role !== 'super') redirect('/clients')
  return s
}

export function canSeeStore(s: Staff, storeId: string) {
  return s.storeIds === null || s.storeIds.includes(storeId)
}

/* 서버 액션은 누구나 부를 수 있는 엔드포인트다. 화면에서 막았어도 여기서 다시 확인한다. */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
export const fail = (error: string) => ({ ok: false as const, error })

export async function actionStaff() {
  const s = await getStaff()
  if (!s) throw new Error('로그인이 풀렸어요. 새로고침해서 다시 로그인해 주세요.')
  return s
}
export async function actionSuper() {
  const s = await actionStaff()
  if (s.role !== 'super') throw new Error('슈퍼어드민만 할 수 있어요.')
  return s
}
export async function actionStore(storeId: string) {
  const s = await actionStaff()
  if (!canSeeStore(s, storeId)) throw new Error('담당하지 않는 매장이에요.')
  return s
}
