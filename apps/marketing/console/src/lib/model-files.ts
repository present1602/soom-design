import 'server-only'
import { BUCKET, extOfPath, isAudioUploadPath, isCandidatePath, isModelAudioPath, isModelImagePath, isUploadPath, modelFilePath, sourcePath } from '@marketing/core/storage'
import { db } from './supabase'

/* 모델 파일을 모델 폴더(models/<모델ID>/)로 모은다 — 경로 규칙은 core/src/storage.ts.

   모델을 저장하기 전에 올라온 파일(uploads/ 의 사진·녹음, candidates/ 의 AI 후보)을
   저장하는 순간 모델 폴더로 가져온다. 옮기기(move)가 아니라 복사한 뒤 원본을 지운다:
   DB 저장이 실패하면 복사본만 지우면 되고, 원본 경로는 그대로 살아 있어 다시 저장할 수 있다.

   1) adopt()  복사 → 새 경로를 받는다
   2) DB 에 새 경로를 저장
   3) 성공하면 done(), 실패하면 undo() */

export type Adopted = {
  /** 원래 경로 → 모델 폴더 경로. 복사하지 않은(이미 모델 폴더거나 예전 generated/ 경로) 것은 그대로 */
  to: (path: string) => string
  /** DB 저장이 끝났을 때 — 원본을 지운다 */
  done: () => Promise<void>
  /** DB 저장이 실패했을 때 — 복사본을 지운다 */
  undo: () => Promise<void>
}

/** 모델 폴더로 가져올 대상인지 — 아직 어느 모델에도 속하지 않은 새 파일만 */
const isLoose = (p: string) => isUploadPath(p) || isAudioUploadPath(p) || isCandidatePath(p)

export async function adopt(modelId: string, files: { path: string; name: 'cover' | 'ref' | 'voice' }[]): Promise<Adopted> {
  const map = new Map<string, string>()
  for (const f of files) {
    if (map.has(f.path) || !isLoose(f.path)) continue
    const dest = modelFilePath(modelId, f.name, extOfPath(f.path))
    const { error } = await db().storage.from(BUCKET).copy(f.path, dest)
    // 복사하지 못해도 원래 자리의 파일은 그대로 쓸 수 있다 — 모델 저장은 막지 않는다
    if (error) console.error('[model-files] 모델 폴더로 복사 실패:', f.path, error.message)
    else map.set(f.path, dest)
  }
  return {
    to: (p) => map.get(p) ?? p,
    done: () => removeQuietly([...map.keys()]),
    undo: () => removeQuietly([...map.values()]),
  }
}

/** 모델에서 뺀 파일을 저장소에서도 지운다. 그 모델 폴더의 파일만 지운다 —
    예전 경로(generated/·uploads/)는 다른 곳에서 쓰고 있을 수 있어 건드리지 않는다. */
export async function removeModelFiles(modelId: string, paths: (string | null | undefined)[]) {
  const mine = paths.filter((p): p is string => isModelImagePath(p, modelId) || isModelAudioPath(p, modelId))
  if (!mine.length) return
  // 대표 이미지·지금 쓰는 녹음은 어떤 경우에도 지우지 않는다
  const { data: m } = await db().from('virtual_models').select('cover_path, voice_sample_path').eq('id', modelId).maybeSingle()
  const keep = new Set([m?.cover_path, m?.voice_sample_path])
  await removeQuietly(mine.filter((p) => !keep.has(p)))
}

/* ───────── 초상권 확인용 보관 (sources/<모델ID>/) ─────────

   나중에 "이 모델은 누구 사진으로 만들었나"를 답할 수 있게, 모델을 만들 때 넣은 실제 인물 사진을
   사본으로 따로 둔다. 모델 폴더의 사진은 지우거나 바꿀 수 있지만 여기는 앱이 건드리지 않는다.
   DB 에는 남기지 않는다 — 폴더 이름(모델 ID)과 info.json 만으로 알 수 있게.

   - inspiration-…  "사진 참고해 새 인물"로 후보를 만들 때 넣은 참고 사진
   - photo-…        "실제 인물 사진"으로 만든 모델의 사진(대표 포함) */

export type SourceInfo = {
  modelName: string
  createdBy: string
  source: 'ai' | 'photo'
  consent: boolean
}

export async function archiveSources(modelId: string, info: SourceInfo, files: { path: string; name: 'inspiration' | 'photo' }[]) {
  if (!files.length) return
  const st = db().storage.from(BUCKET)
  const saved: { file: string; kind: string; original: string }[] = []
  const failed: string[] = []
  for (const [i, f] of files.entries()) {
    const dest = sourcePath(modelId, `${f.name}-${i + 1}`, extOfPath(f.path))
    const { error } = await st.copy(f.path, dest)
    if (error) failed.push(`${f.path} (${error.message})`)
    else saved.push({ file: dest.split('/').pop()!, kind: f.name === 'inspiration' ? 'AI 후보를 만들 때 넣은 참고 사진' : '모델로 쓴 실제 인물 사진', original: f.path })
  }
  const doc = {
    modelId,
    modelName: info.modelName,
    createdAt: new Date().toISOString(),
    createdBy: info.createdBy,
    source: info.source,
    consentChecked: info.consent,
    files: saved,
    ...(failed.length ? { notCopied: failed } : {}),
  }
  const { error } = await st.upload(`sources/${modelId}/info.json`, new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), { contentType: 'application/json', upsert: true })
  // 보관은 모델 저장을 막지 않는다. 빠진 사본은 로그와 info.json 의 notCopied 로 찾는다.
  if (failed.length || error) console.error('[model-files] 초상권 보관 일부 실패:', modelId, failed.join(', '), error?.message ?? '')
}

/* 지우기는 정리일 뿐이라 실패해도 사용자 작업을 되돌리지 않는다. 남은 파일은 로그로 찾는다. */
async function removeQuietly(paths: string[]) {
  if (!paths.length) return
  const { error } = await db().storage.from(BUCKET).remove(paths)
  if (error) console.error('[model-files] 파일 지우기 실패:', paths.join(', '), error.message)
}
