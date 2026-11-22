import { createClient } from '@supabase/supabase-js'
import { BUCKET } from '@marketing/core/storage'
import { env } from './env'

export const db = createClient(env.supabaseUrl, env.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function download(path: string) {
  const { data, error } = await db.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`파일을 받지 못했어요: ${path} (${error?.message ?? '없음'})`)
  return { data: new Uint8Array(await data.arrayBuffer()), mime: data.type || mimeOf(path) }
}

export async function upload(path: string, data: Uint8Array, mime: string) {
  const { error } = await db.storage.from(BUCKET).upload(path, data, { contentType: mime, upsert: false })
  if (error) throw new Error(`파일을 저장하지 못했어요: ${path} (${error.message})`)
  return path
}

export async function signedUrl(path: string, seconds = 3600) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error || !data) throw new Error(`파일 주소를 만들지 못했어요: ${path}`)
  return data.signedUrl
}

export function mimeOf(path: string) {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.mp4')) return 'video/mp4'
  return 'image/jpeg'
}

/** 꼭 성공해야 하는 쓰기 — 실패를 삼키지 않는다 */
export async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string) {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
