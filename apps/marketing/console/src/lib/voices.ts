import 'server-only'
import type { LibraryVoice } from '@marketing/core/types'
import type { LibraryVoiceView } from '@/components/voice-designer'
import { signMany } from './files'
import { db } from './supabase'

export const VOICE_LIBRARY_MIGRATION = 'DB에 목소리 보관함이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0006_voice_library.sql 을 먼저 돌려 주세요.'
/** 0006 을 돌리기 전 — 표·칸이 없거나 voice_source 에 library 를 못 넣는다 */
export const libraryMissing = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || e.code === '23514' || /voices|voice_library_id|voice_source_chk/.test(e.message)

export const toView = (v: LibraryVoice, url: string | null): LibraryVoiceView => ({ id: v.id, alias: v.alias, gender: v.gender, description: v.description, url })

/** 보관함 목록 (내린 것 빼고, 최근 것부터). 0006 전이면 missing */
export async function listLibraryVoices(): Promise<{ voices: LibraryVoiceView[]; missing: boolean }> {
  const { data, error } = await db().from('voices').select('*').eq('archived', false).order('created_at', { ascending: false }).limit(500)
  if (error) {
    if (libraryMissing(error)) return { voices: [], missing: true }
    throw new Error(`목소리 보관함을 읽지 못했어요: ${error.message}`)
  }
  const rows = (data ?? []) as LibraryVoice[]
  const signed = await signMany(rows.map((r) => r.sample_path))
  return { voices: rows.map((r) => toView(r, signed.get(r.sample_path) ?? null)), missing: false }
}
