'use server'

import { revalidatePath } from 'next/cache'
import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import { BUCKET, isVoiceCandidatePath, voiceLibraryPath } from '@marketing/core/storage'
import type { LibraryVoice } from '@marketing/core/types'
import { MAX_VOICE_TONES, VOICE_AGES, VOICE_DESIGN_N, VOICE_DESIGN_TEXT, VOICE_PITCHES, VOICE_SPEEDS, VOICE_TONES, describeVoice, isVoiceGender, type VoiceDesignInput } from '@marketing/core/voice'
import type { LibraryVoiceView } from '@/components/voice-designer'
import { signOne } from '@/lib/files'
import { actionStaff, actionSuper, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { VOICE_LIBRARY_MIGRATION, libraryMissing, toView } from '@/lib/voices'

/* 목소리 보관함. 후보 만들기 → 워커(voice_design) → 마음에 드는 후보를 별칭과 함께 보관(voices 표 + voices/<id>/ 파일).
   모델에 고르는 것은 actions/models.ts (voiceSource: 'library'). */

const has = (opts: { label: string }[], v: string) => opts.some((o) => o.label === v)

export async function requestVoiceDesignAction(input: VoiceDesignInput): Promise<Result<{ jobId: string }>> {
  await actionStaff()
  if (!isVoiceGender(input.gender)) return fail('성별을 골라 주세요.')
  if (input.age && !has(VOICE_AGES, input.age)) return fail('나이대를 목록에서 골라 주세요.')
  if (input.pitch && !has(VOICE_PITCHES, input.pitch)) return fail('음높이를 목록에서 골라 주세요.')
  if (input.speed && !has(VOICE_SPEEDS, input.speed)) return fail('말 속도를 목록에서 골라 주세요.')
  const tones = [...new Set(input.tones ?? [])]
  if (tones.length > MAX_VOICE_TONES || !tones.every((t) => has(VOICE_TONES, t))) return fail(`분위기는 ${MAX_VOICE_TONES}개까지 목록에서 골라 주세요.`)
  const extra = (input.extra ?? '').trim()
  if (extra.length > 200) return fail('추가 설명은 200자까지 적을 수 있어요.')
  const payload: JobPayloads['voice_design'] = { input: { gender: input.gender, age: input.age ?? '', pitch: input.pitch ?? '', tones, speed: input.speed ?? '', extra }, text: VOICE_DESIGN_TEXT, n: VOICE_DESIGN_N }
  const { data, error } = await db().from('jobs').insert({ kind: 'voice_design', payload }).select('id').single()
  if (error) return fail(`요청하지 못했어요: ${error.message}`)
  return { ok: true, jobId: data.id }
}

type DesignJob = { status: string; payload: JobPayloads['voice_design']; result: (JobResults['voice_design'] & { saved?: Record<string, string> }) | null }

/** 후보 하나를 보관함에 넣는다. 같은 후보를 다시 누르면 이미 보관한 목소리를 돌려준다 */
export async function saveVoiceAction(input: { jobId: string; path: string; alias: string }): Promise<Result<{ voice: LibraryVoiceView }>> {
  const staff = await actionStaff()
  const alias = input.alias.trim().slice(0, 30)
  if (!alias) return fail('별칭을 적어 주세요. 예: 중저음 따뜻한 톤')
  if (!isVoiceCandidatePath(input.path)) return fail('후보를 다시 만들어 주세요.')
  const { data: jr } = await db().from('jobs').select('status, payload, result').eq('id', input.jobId).eq('kind', 'voice_design').maybeSingle()
  const job = jr as DesignJob | null
  if (!job || job.status !== 'done' || !job.result?.paths?.includes(input.path)) return fail('후보를 찾지 못했어요. 후보를 다시 만들어 주세요.')

  const already = job.result.saved?.[input.path]
  if (already) {
    const { data: v } = await db().from('voices').select('*').eq('id', already).maybeSingle()
    if (v) {
      const row = v as LibraryVoice
      // 별칭을 바꿔서 다시 눌렀으면 별칭만 고친다
      if (row.alias !== alias) await db().from('voices').update({ alias }).eq('id', row.id)
      return { ok: true, voice: toView({ ...row, alias }, await signOne(row.sample_path)) }
    }
  }

  const id = crypto.randomUUID()
  const dest = voiceLibraryPath(id)
  const st = db().storage.from(BUCKET)
  const cp = await st.copy(input.path, dest)
  if (cp.error) return fail(`보관하지 못했어요: ${cp.error.message}`)
  const row = {
    id,
    alias,
    gender: job.payload.input.gender,
    description: describeVoice(job.payload.input),
    instruct: job.result.instruct ?? '',
    engine: 'qwen',
    sample_path: dest,
    sample_text: job.payload.text,
    created_by: staff.email,
  }
  const { data, error } = await db().from('voices').insert(row).select('*').single()
  if (error) {
    await st.remove([dest])
    return fail(libraryMissing(error) ? VOICE_LIBRARY_MIGRATION : `보관하지 못했어요: ${error.message}`)
  }
  await db().from('jobs').update({ result: { ...job.result, saved: { ...(job.result.saved ?? {}), [input.path]: id } } }).eq('id', input.jobId)
  revalidatePath('/voices')
  return { ok: true, voice: toView(data as LibraryVoice, await signOne(dest)) }
}

export async function renameVoiceAction(id: string, alias: string): Promise<Result> {
  await actionStaff()
  const a = alias.trim().slice(0, 30)
  if (!a) return fail('별칭을 적어 주세요.')
  const { error } = await db().from('voices').update({ alias: a }).eq('id', id)
  if (error) return fail(`바꾸지 못했어요: ${error.message}`)
  // 이 목소리를 쓰는 모델에 보이는 이름도 같이 바꾼다
  await db().from('virtual_models').update({ voice: a }).eq('voice_library_id', id).eq('voice_source', 'library')
  revalidatePath('/voices')
  revalidatePath('/models')
  return { ok: true }
}

/** 보관함에서 내리기. 이미 이 목소리를 고른 모델은 모델 폴더에 사본이 있어 그대로 동작한다 */
export async function archiveVoiceAction(id: string): Promise<Result> {
  await actionSuper()
  const { error } = await db().from('voices').update({ archived: true }).eq('id', id)
  if (error) return fail(`내리지 못했어요: ${error.message}`)
  revalidatePath('/voices')
  return { ok: true }
}
