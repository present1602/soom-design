'use server'

import { revalidatePath } from 'next/cache'
import { SHOT_LABELS, shotOf } from '@marketing/core/model-shots'
import { BUCKET, extOfPath, isAudioUploadPath, isCandidatePath, isGeneratedPath, isModelAudioPath, isModelImagePath, isUploadPath, modelFilePath } from '@marketing/core/storage'
import { cleanPersona, isEmptyPersona, personaBrief, type Persona } from '@marketing/core/persona'
import { isVoiceEngine, isVoicePreset } from '@marketing/core/voice'
import { MODEL_STATUS_LABEL, isModelStatus, modelStatus, type ModelStatus, type VirtualModel } from '@marketing/core/types'
import { actionStaff, actionSuper, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { VOICE_LIBRARY_MIGRATION, libraryMissing } from '@/lib/voices'
import { adopt, archiveSources, removeModelFiles } from '@/lib/model-files'

/** 모델에 새로 붙일 수 있는 이미지 — 직원이 올린 사진, AI 후보, 그리고 이 규칙 전에 만든 generated/ 후보 */
const ok = (p: unknown) => isUploadPath(p) || isCandidatePath(p) || isGeneratedPath(p)

/** AI 후보 얼굴 4장 만들기 → 워커가 처리. 화면은 /api/jobs/[id] 로 기다린다.
    refPaths: 참고 사진(최대 5장). 그 사람이 아니라 분위기만 따온 다른 인물로 만든다. */
export async function requestModelCandidatesAction(input: { gender: string; ageBand: string; mood: string; refPaths?: string[]; persona?: Persona }): Promise<Result<{ jobId: string }>> {
  await actionStaff()
  if (!input.mood.trim()) return fail('분위기·스타일을 한 줄 적어 주세요.')
  const refPaths = input.refPaths ?? []
  if (refPaths.length > 5) return fail('참고 사진은 5장까지예요.')
  if (!refPaths.every(isUploadPath)) return fail('참고 사진을 다시 올려 주세요.')
  const { data, error } = await db()
    .from('jobs')
    .insert({ kind: 'model_candidates', payload: { gender: input.gender, ageBand: input.ageBand, mood: input.mood.trim().slice(0, 200), ...(refPaths.length ? { refPaths } : {}), ...(personaBrief(cleanPersona(input.persona)) ? { persona: personaBrief(cleanPersona(input.persona)) } : {}) } })
    .select('id')
    .single()
  if (error) return fail(`요청하지 못했어요: ${error.message}`)
  return { ok: true, jobId: data.id }
}

export type ModelInput = {
  name: string
  gender: string
  ageBand: string
  mood: string
  voice: string
  source: 'ai' | 'photo'
  consent: boolean
  coverPath: string
  extraPaths: string[]
  /** 저장하면서 각도 세트(얼굴 15 · 전신 4)도 만들기 */
  makeSheet?: boolean
  /** preset = voice 의 기본 목소리, upload = 녹음 파일로 목소리 등록, library = 목소리 보관함에서 고르기 */
  voiceSource?: 'preset' | 'upload' | 'library'
  voiceLibraryId?: string
  voiceSamplePath?: string
  voiceConsent?: boolean
  /** 녹음 목소리를 읽을 엔진 (qwen | elevenlabs) */
  voiceEngine?: string
  /** 녹음에서 읽은 문장 (Qwen3-TTS 품질용) */
  voiceSampleText?: string
  persona?: Persona
}

const VOICE_MIGRATION = 'DB에 목소리 칸이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0003_voice.sql 을 먼저 돌려 주세요.'
const PERSONA_MIGRATION = 'DB에 페르소나·목소리 엔진 칸이 아직 없어요. Supabase SQL Editor에서 0003_voice.sql, 0004_persona.sql 을 차례로 돌려 주세요.'
const voiceColumnMissing = (e: { code?: string; message: string }) => e.code === '42703' || e.code === 'PGRST204' || /voice_|persona/.test(e.message)
const missingMsg = (e: { message: string }) => (/persona|voice_engine|voice_sample_text/.test(e.message) ? PERSONA_MIGRATION : VOICE_MIGRATION)

/** modelId: 이미 저장된 모델이면 그 모델 폴더의 녹음(지금 쓰는 녹음)도 받는다 */
function checkVoice(v: { voiceSource?: string; voice?: string; voiceSamplePath?: string; voiceConsent?: boolean; voiceEngine?: string; voiceLibraryId?: string }, modelId?: string) {
  if (v.voiceSource === 'library') {
    if (!v.voiceLibraryId || !/^[0-9a-f-]{36}$/.test(v.voiceLibraryId)) return '보관함에서 목소리를 골라 주세요.'
  } else if (v.voiceSource === 'upload') {
    if (!isVoiceEngine(v.voiceEngine)) return '목소리 엔진(Qwen3-TTS 또는 ElevenLabs)을 골라 주세요.'
    if (!isAudioUploadPath(v.voiceSamplePath) && !(modelId && isModelAudioPath(v.voiceSamplePath, modelId))) return '목소리 녹음 파일을 올려 주세요.'
    if (!v.voiceConsent) return '녹음한 사람에게 광고 목소리 사용 동의를 받았는지 확인해 주세요.'
  } else if (v.voice && !isVoicePreset(v.voice)) return '목소리를 목록에서 골라 주세요.'
  return null
}

/** 보관함 목소리 → 모델 칸. 샘플은 모델 폴더로 복사한다(보관함에서 내려도 모델 목소리는 그대로).
    Qwen3-TTS 는 업체 등록이 없어 voice_provider_id 를 바로 채운다 — 등록 작업 없이 바로 쓸 수 있다. */
async function libraryVoice(modelId: string, voiceId: string) {
  const { data, error } = await db().from('voices').select('id, alias, sample_path, sample_text').eq('id', voiceId).maybeSingle()
  if (error) return { error: libraryMissing(error) ? VOICE_LIBRARY_MIGRATION : `목소리를 읽지 못했어요: ${error.message}` }
  const v = data as { id: string; alias: string; sample_path: string; sample_text: string } | null
  if (!v) return { error: '고른 목소리를 보관함에서 찾지 못했어요. 새로고침해 주세요.' }
  const dest = modelFilePath(modelId, 'voice', extOfPath(v.sample_path))
  const cp = await db().storage.from(BUCKET).copy(v.sample_path, dest)
  if (cp.error) return { error: `목소리 파일을 모델로 가져오지 못했어요: ${cp.error.message}` }
  return {
    row: { voice: v.alias, voice_source: 'library', voice_library_id: v.id, voice_sample_path: dest, voice_sample_text: v.sample_text, voice_consent: true, voice_engine: 'qwen', voice_provider_id: 'qwen:ref', voice_error: null },
    undo: () => db().storage.from(BUCKET).remove([dest]),
  }
}

export async function createModelAction(input: ModelInput): Promise<Result<{ id: string }>> {
  const staff = await actionStaff()
  const name = input.name.trim().slice(0, 20)
  if (!name) return fail('모델 이름을 넣어 주세요.')
  if (!ok(input.coverPath)) return fail('대표 이미지를 골라 주세요.')
  if (input.source === 'photo' && !input.consent) return fail('실제 인물 사진이면 광고 모델 사용 동의를 받았는지 확인해 주세요.')
  if (!input.extraPaths.every(ok)) return fail('이미지 경로가 올바르지 않아요. 다시 올려 주세요.')
  const badVoice = checkVoice(input)
  if (badVoice) return fail(badVoice)
  const upload = input.voiceSource === 'upload'
  const persona = cleanPersona(input.persona)

  // 모델 폴더(models/<id>/)에 파일을 먼저 모으려고 ID 를 여기서 정한다
  const id = crypto.randomUUID()
  const lib = input.voiceSource === 'library' ? await libraryVoice(id, input.voiceLibraryId!) : null
  if (lib?.error) return fail(lib.error)
  const main = await adopt(id, [{ path: input.coverPath, name: 'cover' }, ...(upload && input.voiceSamplePath ? [{ path: input.voiceSamplePath, name: 'voice' as const }] : [])])

  const row = {
      id,
      name,
      gender: input.gender,
      age_band: input.ageBand,
      mood: input.mood.trim().slice(0, 200),
      voice: upload ? '녹음 목소리' : lib ? '' : input.voice,
      source: input.source,
      consent: input.consent,
      cover_path: main.to(input.coverPath),
      // 0003 전에도 기본 목소리로는 저장되게, 녹음 목소리일 때만 새 칸을 넣는다
      ...(lib?.row ?? {}),
      ...(upload ? { voice_source: 'upload', voice_sample_path: main.to(input.voiceSamplePath!), voice_consent: true, voice_engine: input.voiceEngine, voice_sample_text: input.voiceSampleText?.trim().slice(0, 1000) || null } : {}),
      // 0004 전에도 페르소나 없이는 저장되게
      ...(isEmptyPersona(persona) ? {} : { persona }),
  }
  // 새 모델은 대기로 시작한다. 0008 전 DB(status 칸 없음)면 칸 없이 다시 넣는다 — 그때는 예전처럼 바로 쓸 수 있다
  let m = await db().from('virtual_models').insert({ ...row, status: 'draft', archived: true }).select('id').single()
  if (m.error && (m.error.code === 'PGRST204' || m.error.code === '42703') && /status/.test(m.error.message)) m = await db().from('virtual_models').insert(row).select('id').single()
  if (m.error) {
    await main.undo()
    await lib?.undo?.()
    if (lib && libraryMissing(m.error)) return fail(VOICE_LIBRARY_MIGRATION)
    return fail(voiceColumnMissing(m.error) ? missingMsg(m.error) : `저장하지 못했어요: ${m.error.message}`)
  }
  // 원본을 지우기 전에, 이 모델을 만든 실제 인물 사진을 초상권 확인용으로 따로 남긴다
  await archiveSources(id, { modelName: name, createdBy: staff.email, source: input.source, consent: input.consent }, await sourcePhotos(input))
  await main.done()
  if (input.extraPaths.length) {
    // 대표 이미지로 고른 것과 같은 사진은 대표 쪽에서 이미 옮겼다 — 참고로 한 번 더 복사하지 않는다
    const extras = input.extraPaths.filter((p) => p !== input.coverPath)
    const refs = await adopt(id, extras.map((path) => ({ path, name: 'ref' as const })))
    const { error } = await db()
      .from('model_images')
      .insert(extras.map((path, i) => ({ model_id: id, path: refs.to(path), sort: i, label: '참고' })))
    if (error) {
      await refs.undo()
      return fail(`모델은 저장했지만 추가 이미지를 저장하지 못했어요: ${error.message}`)
    }
    await refs.done()
  }
  if (upload) {
    const v = await db().from('jobs').insert({ kind: 'voice_clone', payload: { modelId: m.data.id } })
    if (v.error) return fail(`모델은 저장했지만 목소리 등록을 시작하지 못했어요: ${v.error.message} — 모델 화면에서 다시 등록해 주세요.`)
  }
  if (input.makeSheet) {
    const j = await db().from('jobs').insert({ kind: 'model_sheet', payload: { modelId: m.data.id } })
    if (j.error) return fail(`모델은 저장했지만 각도 세트를 시작하지 못했어요: ${j.error.message} — 모델 화면에서 다시 시작해 주세요.`)
  }
  revalidatePath('/models')
  return { ok: true, id: m.data.id }
}

/** 이 모델을 만드는 데 쓴 실제 인물 사진.
    - 실제 인물 사진으로 만든 모델: 올린 사진 전부(대표 포함)
    - 사진 참고해 만든 모델: 고른 후보를 만든 작업에 넣었던 참고 사진. 화면이 아니라 그 작업 기록에서 찾아서,
      후보를 여러 번 다시 뽑았어도 고른 얼굴을 만든 바로 그 사진이 남는다. */
async function sourcePhotos(input: ModelInput): Promise<{ path: string; name: 'inspiration' | 'photo' }[]> {
  if (input.source === 'photo') return [input.coverPath, ...input.extraPaths].map((path) => ({ path, name: 'photo' }))
  const { data, error } = await db().from('jobs').select('payload').eq('kind', 'model_candidates').contains('result', { paths: [input.coverPath] }).limit(1).maybeSingle()
  if (error) console.error('[models] 후보 작업을 찾지 못했어요:', error.message)
  const refs = ((data?.payload as { refPaths?: unknown } | undefined)?.refPaths ?? []) as unknown[]
  return refs.filter(isUploadPath).map((path) => ({ path, name: 'inspiration' }))
}

/* ───────── 각도 세트 ───────── */

async function sheetRunning(modelId: string) {
  const { count } = await db().from('jobs').select('id', { count: 'exact', head: true }).eq('kind', 'model_sheet').eq('payload->>modelId', modelId).in('status', ['queued', 'running'])
  return (count ?? 0) > 0
}

/** 빠진 컷을 모두 만든다(처음이면 19장 전부) */
export async function requestModelSheetAction(modelId: string): Promise<Result> {
  await actionStaff()
  if (await sheetRunning(modelId)) return fail('지금 각도 세트를 만들고 있어요. 끝난 뒤 다시 눌러 주세요.')
  const { error } = await db().from('jobs').insert({ kind: 'model_sheet', payload: { modelId } })
  if (error) return fail(`시작하지 못했어요: ${error.message}`)
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

/* ───────── 컷 수정 (수정본을 만들고 비교해서 고른다) ─────────
   워커(model_shot_edit)가 수정본을 models/<id>/draft-… 로 만들고, 고르기 전까지 model_images 는 그대로다.
   어떤 수정본이 어느 이미지 것인지는 jobs 기록(payload.imageId · result.paths)으로 안다.
   고르거나 버리면 result.resolved 를 적어 다시 보여 주지 않고, 남은 draft 파일은 지운다. */

type EditJob = { id: string; status: string; payload: { imageId: string; basePath?: string }; result: { paths?: string[]; resolved?: string } | null }

/** 이 이미지의 아직 고르지 않은 수정 작업들 */
async function openEdits(modelId: string, imageId: string) {
  const { data } = await db().from('jobs').select('id, status, payload, result').eq('kind', 'model_shot_edit').eq('payload->>modelId', modelId).eq('payload->>imageId', imageId)
  return ((data ?? []) as EditJob[]).filter((j) => !j.result?.resolved)
}

const isDraft = (p: unknown, modelId: string): p is string => isModelImagePath(p, modelId) && /\/draft-[^/]+$/.test(p)

/** 수정본 파일을 지우고(keep 은 남긴다) 작업에 결과를 적는다 */
async function closeEdit(modelId: string, j: EditJob, resolved: 'applied' | 'discarded' | 'continued', keep?: string) {
  const drafts = [...(j.result?.paths ?? []), j.payload.basePath].filter((p): p is string => isDraft(p, modelId) && p !== keep)
  if (drafts.length) {
    const { error } = await db().storage.from(BUCKET).remove(drafts)
    if (error) console.error('[models] 수정본 지우기 실패:', drafts.join(', '), error.message)
  }
  await db().from('jobs').update({ result: { ...(j.result ?? { paths: [] }), resolved } }).eq('id', j.id)
}

/** 수정본 만들기. edit = 지금 사진(또는 basePath 의 수정본)을 고치기, fresh = 그 컷을 처음부터 다시 */
export async function requestShotEditAction(modelId: string, imageId: string, input: { mode: 'edit' | 'fresh'; instruction?: string; basePath?: string }): Promise<Result> {
  await actionStaff()
  const { data: img } = await db().from('model_images').select('label').eq('id', imageId).eq('model_id', modelId).maybeSingle()
  if (!img) return fail('이미지를 찾지 못했어요. 새로고침해 주세요.')
  const instruction = (input.instruction ?? '').trim()
  if (input.mode === 'fresh' && !SHOT_LABELS.has(img.label)) return fail('직접 올린 이미지는 처음부터 다시 그릴 수 없어요. 고칠 내용을 적어 "수정본 만들기"를 눌러 주세요.')
  if (input.mode === 'edit' && !instruction) return fail('무엇을 고칠지 적어 주세요. 예: 얼굴을 조금 더 작게')
  if (instruction.length > 300) return fail('고칠 내용은 300자까지 적을 수 있어요.')

  const open = await openEdits(modelId, imageId)
  if (open.some((j) => j.status === 'queued' || j.status === 'running')) return fail('이 이미지의 수정본을 만들고 있어요. 끝난 뒤 다시 눌러 주세요.')
  if (input.basePath && !open.some((j) => j.result?.paths?.includes(input.basePath!))) return fail('이어서 고칠 수정본을 찾지 못했어요. 새로고침해 주세요.')

  // 지난 수정본은 정리한다 — 이어서 고치는 그 한 장만 남긴다
  for (const j of open) await closeEdit(modelId, j, input.basePath && j.result?.paths?.includes(input.basePath) ? 'continued' : 'discarded', input.basePath)

  const { error } = await db()
    .from('jobs')
    .insert({ kind: 'model_shot_edit', payload: { modelId, imageId, mode: input.mode, n: 2, ...(input.mode === 'edit' ? { instruction } : {}), ...(input.basePath ? { basePath: input.basePath } : {}) } })
  if (error) return fail(`시작하지 못했어요: ${error.message}`)
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

/** 수정본 하나로 교체. 원본 파일과 나머지 수정본은 지운다. */
export async function applyShotEditAction(modelId: string, imageId: string, draftPath: string): Promise<Result> {
  await actionStaff()
  if (!isDraft(draftPath, modelId)) return fail('고른 수정본을 찾지 못했어요. 새로고침해 주세요.')
  const job = (await openEdits(modelId, imageId)).find((j) => j.status === 'done' && j.result?.paths?.includes(draftPath))
  if (!job) return fail('고른 수정본을 찾지 못했어요. 새로고침해 주세요.')
  const { data: img } = await db().from('model_images').select('label, path').eq('id', imageId).eq('model_id', modelId).maybeSingle()
  if (!img) return fail('이미지를 찾지 못했어요. 새로고침해 주세요.')

  // draft- 이름을 떼고 원래 컷 이름으로 둔다
  const st = db().storage.from(BUCKET)
  const dest = modelFilePath(modelId, shotOf(img.label)?.key ?? 'ref', extOfPath(draftPath))
  const cp = await st.copy(draftPath, dest)
  if (cp.error) return fail(`교체하지 못했어요: ${cp.error.message}`)
  const up = await db().from('model_images').update({ path: dest }).eq('id', imageId).eq('path', img.path).select('id')
  if (up.error || !up.data?.length) {
    await st.remove([dest])
    return fail(up.error ? `교체하지 못했어요: ${up.error.message}` : '그 사이 이미지가 바뀌었어요. 새로고침해 주세요.')
  }
  await closeEdit(modelId, job, 'applied')
  await removeModelFiles(modelId, [img.path])
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

/** 수정본 버리기 — 원본은 그대로 */
export async function discardShotEditAction(modelId: string, imageId: string): Promise<Result> {
  await actionStaff()
  const open = await openEdits(modelId, imageId)
  if (open.some((j) => j.status === 'queued' || j.status === 'running')) return fail('아직 만드는 중이에요. 끝난 뒤 버려 주세요.')
  for (const j of open) await closeEdit(modelId, j, 'discarded')
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

/** 이미 있는 이미지 하나를 대표로 바꾼다.
    고른 이미지를 cover- 이름으로 복사해 대표로 삼는다 — 같은 파일을 둘이 같이 가리키면 그 컷을 지우거나
    다시 뽑을 때 대표가 흔들린다. 지금 대표는 지우지 않고 "이전 대표" 이미지로 남겨 되돌릴 수 있게 한다. */
export async function setModelCoverAction(modelId: string, imageId: string): Promise<Result> {
  await actionStaff()
  const [mr, ir] = await Promise.all([
    db().from('virtual_models').select('cover_path').eq('id', modelId).maybeSingle(),
    db().from('model_images').select('path').eq('id', imageId).eq('model_id', modelId).maybeSingle(),
  ])
  const m = mr.data as { cover_path: string | null } | null
  const img = ir.data as { path: string } | null
  if (!m) return fail('모델을 찾지 못했어요. 새로고침해 주세요.')
  if (!img) return fail('이미지를 찾지 못했어요. 새로고침해 주세요.')
  if (img.path === m.cover_path) return fail('이미 대표 이미지예요.')
  // 각도 세트는 대표 얼굴을 보고 그린다 — 도중에 바꾸면 컷마다 기준이 달라진다
  if (await sheetRunning(modelId)) return fail('각도 세트를 만드는 중에는 대표를 바꿀 수 없어요. 끝난 뒤 다시 눌러 주세요.')

  const st = db().storage.from(BUCKET)
  const dest = modelFilePath(modelId, 'cover', extOfPath(img.path))
  const cp = await st.copy(img.path, dest)
  if (cp.error) return fail(`대표 이미지를 만들지 못했어요: ${cp.error.message}`)

  // 지금 대표를 이미지 목록에 먼저 남긴다(이미 목록에 있는 파일이면 건너뛴다)
  let keptId: string | null = null
  if (m.cover_path) {
    const { count } = await db().from('model_images').select('id', { count: 'exact', head: true }).eq('model_id', modelId).eq('path', m.cover_path)
    if (!count) {
      const { count: n } = await db().from('model_images').select('id', { count: 'exact', head: true }).eq('model_id', modelId)
      const kept = await db().from('model_images').insert({ model_id: modelId, path: m.cover_path, label: '이전 대표', sort: n ?? 0 }).select('id').single()
      if (kept.error) {
        await st.remove([dest])
        return fail(`지금 대표 이미지를 보관하지 못해 바꾸지 않았어요: ${kept.error.message}`)
      }
      keptId = kept.data.id
    }
  }

  const { error } = await db().from('virtual_models').update({ cover_path: dest }).eq('id', modelId)
  if (error) {
    await st.remove([dest])
    if (keptId) await db().from('model_images').delete().eq('id', keptId)
    return fail(`대표 이미지를 바꾸지 못했어요: ${error.message}`)
  }
  revalidatePath(`/models/${modelId}`)
  revalidatePath('/models')
  return { ok: true }
}

export async function addModelImagesAction(modelId: string, paths: string[], label: string): Promise<Result> {
  await actionStaff()
  if (!paths.length || !paths.every(ok)) return fail('올린 이미지를 다시 확인해 주세요.')
  const { count } = await db().from('model_images').select('id', { count: 'exact', head: true }).eq('model_id', modelId)
  const refs = await adopt(modelId, paths.map((path) => ({ path, name: 'ref' as const })))
  const { error } = await db()
    .from('model_images')
    .insert(paths.map((path, i) => ({ model_id: modelId, path: refs.to(path), sort: (count ?? 0) + i, label: label.trim().slice(0, 20) || '참고' })))
  if (error) {
    await refs.undo()
    return fail(`저장하지 못했어요: ${error.message}`)
  }
  await refs.done()
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

export async function removeModelImageAction(modelId: string, imageId: string): Promise<Result> {
  await actionStaff()
  const { data } = await db().from('model_images').select('path').eq('id', imageId).eq('model_id', modelId).maybeSingle()
  const { error } = await db().from('model_images').delete().eq('id', imageId).eq('model_id', modelId)
  if (error) return fail(`지우지 못했어요: ${error.message}`)
  await removeModelFiles(modelId, [data?.path])
  // 고르지 않은 수정본도 같이 정리한다 (만드는 중인 작업은 워커가 끝낸 뒤 이미지가 없어 그냥 남는다)
  for (const j of await openEdits(modelId, imageId)) if (j.status !== 'queued' && j.status !== 'running') await closeEdit(modelId, j, 'discarded')
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

const STATUS_MIGRATION = 'DB에 모델 상태 칸이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0008_model_status.sql 을 먼저 돌려 주세요.'
const statusMissing = (e: { code?: string; message: string }) => e.code === '42703' || e.code === 'PGRST204' || /status/.test(e.message)

/** 모델 상태 바꾸기 — 대기 → 공개, 공개 → 숨김, 숨김 → 공개. 숨겨도 이미 만든 콘텐츠의 기록은 남는다.
    예전 archived 칸도 같이 맞춘다(공개가 아니면 true) */
export async function setModelStatusAction(modelId: string, status: ModelStatus): Promise<Result> {
  await actionSuper()
  if (!isModelStatus(status)) return fail('상태가 올바르지 않아요.')
  const { data: cur } = await db().from('virtual_models').select('*').eq('id', modelId).maybeSingle()
  if (!cur) return fail('모델을 찾지 못했어요. 새로고침해 주세요.')
  if (!('status' in cur)) return fail(STATUS_MIGRATION)
  const from = modelStatus(cur as VirtualModel)
  if (from === status) return fail(`이미 ${MODEL_STATUS_LABEL[status]} 상태예요.`)
  if (status === 'draft') return fail('대기로 되돌릴 수는 없어요. 숨김을 써 주세요.')
  if (status === 'published' && !cur.cover_path) return fail('대표 이미지가 없어 공개할 수 없어요.')
  const { error } = await db().from('virtual_models').update({ status, archived: status !== 'published' }).eq('id', modelId)
  if (error) return fail(statusMissing(error) ? STATUS_MIGRATION : `바꾸지 못했어요: ${error.message}`)
  revalidatePath(`/models/${modelId}`)
  revalidatePath('/models')
  return { ok: true }
}

/* ───────── 목소리 ───────── */

/** 모델 목소리 바꾸기. 녹음 파일이면 업체 등록을 다시 한다(지난 등록 목소리는 워커가 지운다). */
export async function updateModelVoiceAction(
  modelId: string,
  input: { voiceSource: 'preset' | 'upload' | 'library'; voice?: string; voiceSamplePath?: string; voiceConsent?: boolean; voiceEngine?: string; voiceSampleText?: string; voiceLibraryId?: string },
): Promise<Result> {
  await actionStaff()
  const { data: cur } = await db().from('virtual_models').select('*').eq('id', modelId).maybeSingle()
  if (!cur) return fail('모델을 찾지 못했어요. 새로고침해 주세요.')
  // 녹음은 그대로 두고 엔진·문장만 바꾸는 경우: 저장된 녹음과 같고 이미 동의를 받았으면 동의를 다시 묻지 않는다
  if (input.voiceSource === 'upload' && !input.voiceConsent) {
    if (cur?.voice_consent && cur.voice_sample_path === input.voiceSamplePath) input = { ...input, voiceConsent: true }
  }
  const bad = checkVoice(input, modelId)
  if (bad) return fail(bad)
  if (input.voiceSource === 'preset' && !input.voice) return fail('목소리를 골라 주세요.')
  const upload = input.voiceSource === 'upload'
  const lib = input.voiceSource === 'library' ? await libraryVoice(modelId, input.voiceLibraryId!) : null
  if (lib?.error) return fail(lib.error)
  // 새로 올린 녹음이면 모델 폴더로 가져온다(지금 쓰는 녹음이면 그대로)
  const voice = await adopt(modelId, upload && input.voiceSamplePath ? [{ path: input.voiceSamplePath, name: 'voice' }] : [])
  const samplePath = upload ? voice.to(input.voiceSamplePath!) : (lib?.row?.voice_sample_path ?? null)
  // 0006 전 DB 에는 voice_library_id 칸이 없다 — 칸이 있을 때만 비운다
  const clearLib = 'voice_library_id' in cur ? { voice_library_id: null } : {}
  const row = lib?.row
    ? lib.row
    : upload
      ? { voice: '녹음 목소리', voice_source: 'upload', voice_sample_path: samplePath, voice_consent: true, voice_error: null, voice_engine: input.voiceEngine, voice_sample_text: input.voiceSampleText?.trim().slice(0, 1000) || null, ...clearLib, ...(cur.voice_source === 'library' ? { voice_provider_id: null } : {}) }
      : { voice: input.voice, voice_source: 'preset', voice_error: null, ...clearLib }
  const { error } = await db().from('virtual_models').update(row).eq('id', modelId)
  if (error) {
    await voice.undo()
    await lib?.undo?.()
    if (lib && libraryMissing(error)) return fail(VOICE_LIBRARY_MIGRATION)
    return fail(voiceColumnMissing(error) ? missingMsg(error) : `저장하지 못했어요: ${error.message}`)
  }
  await voice.done()
  // 녹음·보관함 목소리를 바꿨으면 지난 파일을 지운다 (기본 목소리로 바꿀 때는 다시 돌아올 수 있게 남긴다.
  // 보관함 목소리의 사본은 보관함에 원본이 있어 언제 지워도 된다)
  if ((upload || lib || cur.voice_source === 'library') && cur.voice_sample_path && cur.voice_sample_path !== samplePath && (input.voiceSource !== 'preset' || cur.voice_source === 'library'))
    await removeModelFiles(modelId, [cur.voice_sample_path])
  if (upload) {
    const j = await db().from('jobs').insert({ kind: 'voice_clone', payload: { modelId } })
    if (j.error) return fail(`저장했지만 목소리 등록을 시작하지 못했어요: ${j.error.message}`)
  }
  revalidatePath(`/models/${modelId}`)
  revalidatePath('/models')
  return { ok: true }
}

/** 녹음 목소리 등록을 다시 시도 (실패했을 때) */
export async function retryVoiceCloneAction(modelId: string): Promise<Result> {
  await actionStaff()
  const { count } = await db().from('jobs').select('id', { count: 'exact', head: true }).eq('kind', 'voice_clone').eq('payload->>modelId', modelId).in('status', ['queued', 'running'])
  if (count) return fail('지금 등록하고 있어요. 잠시만 기다려 주세요.')
  await db().from('virtual_models').update({ voice_error: null }).eq('id', modelId)
  const { error } = await db().from('jobs').insert({ kind: 'voice_clone', payload: { modelId } })
  if (error) return fail(`다시 시작하지 못했어요: ${error.message}`)
  revalidatePath(`/models/${modelId}`)
  return { ok: true }
}

/* ───────── 페르소나 ───────── */

export async function updateModelPersonaAction(modelId: string, input: Persona): Promise<Result> {
  await actionStaff()
  const persona = cleanPersona(input)
  const { error } = await db().from('virtual_models').update({ persona }).eq('id', modelId)
  if (error) return fail(voiceColumnMissing(error) ? PERSONA_MIGRATION : `저장하지 못했어요: ${error.message}`)
  revalidatePath(`/models/${modelId}`)
  revalidatePath('/models')
  return { ok: true }
}
