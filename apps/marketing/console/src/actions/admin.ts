'use server'

import { revalidatePath } from 'next/cache'
import { AUDIO_TYPES, IMAGE_TYPES, MAX_UPLOAD_BYTES, BUCKET, uploadPath } from '@marketing/core/storage'
import { actionStaff, actionSuper, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'

/* ───────── 관리자 계정 (슈퍼어드민) ───────── */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 콘텐츠 관리자(또는 슈퍼어드민) 추가.
    임시 비밀번호를 주면 그 비밀번호로 바로 로그인할 수 있게 계정을 만든다. 비우면 구글 로그인으로만 들어온다. */
export async function inviteAdminAction(input: { email: string; nickname: string; role: 'super' | 'manager'; password: string }): Promise<Result> {
  await actionSuper()
  const email = input.email.trim().toLowerCase()
  const nickname = input.nickname.trim().slice(0, 20)
  if (!EMAIL.test(email)) return fail('이메일 형식이 맞지 않아요.')
  if (!nickname) return fail('닉네임을 넣어 주세요. 콘텐츠 담당자로 화면에 보이는 이름이에요.')
  if (input.password && input.password.length < 8) return fail('임시 비밀번호는 8자 이상으로 정해 주세요.')

  const ins = await db().from('admins').insert({ email, nickname, role: input.role === 'super' ? 'super' : 'manager' })
  if (ins.error) return fail(ins.error.code === '23505' ? '이미 등록된 이메일이에요.' : `추가하지 못했어요: ${ins.error.message}`)

  if (input.password) {
    const u = await db().auth.admin.createUser({ email, password: input.password, email_confirm: true })
    // 이미 로그인 계정이 있으면(구글로 들어온 적 있는 사람 등) 비밀번호만 새로 정한다
    if (u.error && /already/i.test(u.error.message)) {
      const list = await db().auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = list.data?.users.find((x) => x.email?.toLowerCase() === email)
      if (found) await db().auth.admin.updateUserById(found.id, { password: input.password })
    } else if (u.error) {
      return fail(`관리자는 추가했지만 로그인 계정을 만들지 못했어요: ${u.error.message}. 구글 로그인으로 들어오게 하거나 다시 시도해 주세요.`)
    }
  }
  revalidatePath('/managers')
  return { ok: true }
}

export async function setAdminActiveAction(adminId: string, active: boolean): Promise<Result> {
  const me = await actionSuper()
  if (me.id === adminId && !active) return fail('내 계정은 끌 수 없어요.')
  const { error } = await db().from('admins').update({ active }).eq('id', adminId)
  if (error) return fail(`바꾸지 못했어요: ${error.message}`)
  revalidatePath('/managers')
  return { ok: true }
}

/* ───────── 분위기 옵션 (슈퍼어드민) ───────── */

export async function addMoodAction(label: string): Promise<Result> {
  await actionSuper()
  const v = label.trim()
  if (!v) return fail('단어를 넣어 주세요.')
  if (v.length > 12) return fail('12자 이내로 적어 주세요.')
  const { data: last } = await db().from('mood_options').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle()
  const { error } = await db().from('mood_options').insert({ label: v, sort: (last?.sort ?? 0) + 1 })
  if (error) return fail(error.code === '23505' ? '이미 있는 분위기예요.' : `추가하지 못했어요: ${error.message}`)
  revalidatePath('/settings')
  return { ok: true }
}

export async function setMoodActiveAction(id: string, active: boolean): Promise<Result> {
  await actionSuper()
  const { error } = await db().from('mood_options').update({ active }).eq('id', id)
  if (error) return fail(`바꾸지 못했어요: ${error.message}`)
  revalidatePath('/settings')
  return { ok: true }
}

export async function renameMoodAction(id: string, label: string): Promise<Result> {
  await actionSuper()
  const v = label.trim()
  if (!v || v.length > 12) return fail('1–12자로 적어 주세요.')
  const { error } = await db().from('mood_options').update({ label: v }).eq('id', id)
  if (error) return fail(error.code === '23505' ? '이미 있는 분위기예요.' : `바꾸지 못했어요: ${error.message}`)
  revalidatePath('/settings')
  return { ok: true }
}

export async function deleteMoodAction(id: string): Promise<Result> {
  await actionSuper()
  // 이미 만든 콘텐츠에는 글자로 남아 있어서(contents.moods) 지워도 기록은 그대로다
  const { error } = await db().from('mood_options').delete().eq('id', id)
  if (error) return fail(`지우지 못했어요: ${error.message}`)
  revalidatePath('/settings')
  return { ok: true }
}

/** 순서 저장: 화면에서 바꾼 순서 그대로 id 목록을 받는다 */
export async function reorderMoodsAction(ids: string[]): Promise<Result> {
  await actionSuper()
  for (const [i, id] of ids.entries()) {
    const { error } = await db().from('mood_options').update({ sort: i + 1 }).eq('id', id)
    if (error) return fail(`순서를 저장하지 못했어요: ${error.message}`)
  }
  revalidatePath('/settings')
  return { ok: true }
}

/* ───────── 파일 올리기 ───────── */

/** 브라우저가 저장소에 바로 올릴 수 있는 일회용 주소를 준다(서버를 거치지 않아 큰 파일도 된다). */
export async function createUploadTargetsAction(files: { mime: string; size: number }[], kind: 'image' | 'audio' = 'image'): Promise<Result<{ targets: { path: string; token: string }[] }>> {
  await actionStaff()
  if (!files.length || files.length > 10) return fail('한 번에 1–10개까지 올릴 수 있어요.')
  const types: readonly string[] = kind === 'audio' ? AUDIO_TYPES : IMAGE_TYPES
  for (const f of files) {
    if (!types.includes(f.mime)) return fail(kind === 'audio' ? 'MP3 · WAV · M4A 녹음 파일만 올릴 수 있어요.' : 'JPG · PNG · WEBP 이미지만 올릴 수 있어요.')
    if (f.size > MAX_UPLOAD_BYTES) return fail(`파일 하나는 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 까지예요.`)
  }
  const targets = []
  for (const f of files) {
    const path = uploadPath(f.mime)
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) return fail(`올릴 주소를 만들지 못했어요: ${error?.message ?? ''}`)
    targets.push({ path, token: data.token })
  }
  return { ok: true, targets }
}
