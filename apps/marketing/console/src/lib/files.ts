import 'server-only'
import { BUCKET } from '@marketing/core/storage'
import { db } from './supabase'

/** 비공개 파일을 화면에 보이려고 서명 링크를 만든다(1시간). 빈 경로는 건너뛴다. */
export async function signMany(paths: (string | null | undefined)[], seconds = 3600) {
  const list = [...new Set(paths.filter((p): p is string => !!p))]
  const out = new Map<string, string>()
  if (!list.length) return out
  const { data, error } = await db().storage.from(BUCKET).createSignedUrls(list, seconds)
  if (error) {
    console.error('[sign]', error.message)
    return out
  }
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl)
  return out
}

export async function signOne(path: string | null | undefined) {
  if (!path) return null
  return (await signMany([path])).get(path) ?? null
}
