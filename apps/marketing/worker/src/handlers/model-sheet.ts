import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import { isFatalAiError } from '@marketing/core/ai/errors'
import { composeImages } from '@marketing/core/ai/openai-image'
import { BODY_FRONT, FACE_FRONT, SHOTS, shotPrompt, type Shot } from '@marketing/core/model-shots'
import { modelFilePath } from '@marketing/core/storage'
import type { VirtualModel } from '@marketing/core/types'
import { db, must, upload } from '../db'
import { env } from '../env'
import { mockPortrait } from '../ffmpeg'
import { images } from './common'

/* 가상 모델 각도 세트 (얼굴 15 + 전신 4).
   - 이미 있는 컷은 건너뛴다 → 실패해서 다시 돌거나 "빠진 컷 채우기"를 눌러도 없는 것만 만든다.
   - 기준 컷(얼굴 정면·전신 정면)을 먼저 만들고, 나머지는 대표 + 기준 컷을 함께 넣어 같은 사람으로 맞춘다.
   - 한 장씩 저장하므로 화면에서 진행 상황이 바로 보인다. 일부만 실패하면 나머지는 남기고 실패한 컷을 알려 준다. */

const PARALLEL = 3

export async function modelSheetJob(p: JobPayloads['model_sheet']): Promise<JobResults['model_sheet']> {
  const m = await must(db.from('virtual_models').select('*').eq('id', p.modelId).maybeSingle(), '모델 조회')
  if (!m) throw new Error('가상 모델을 찾지 못했어요. 삭제됐을 수 있어요.')
  const model = m as VirtualModel
  if (!model.cover_path) throw new Error(`가상 모델 ${model.name}에 대표 이미지가 없어요.`)
  const look = { gender: model.gender, ageBand: model.age_band, mood: model.mood }

  const existing = async () => (await must(db.from('model_images').select('label, path').eq('model_id', model.id), '모델 이미지 조회')) as { label: string; path: string }[]
  const have = new Set((await existing()).map((r) => r.label))
  const wanted = p.shots?.length ? SHOTS.filter((s) => p.shots!.includes(s.label)) : SHOTS
  const todo = wanted.filter((s) => !have.has(s.label))
  const made: string[] = []
  const failed: { label: string; error: string }[] = []
  // 크레딧·키·정책 문제면 남은 컷도 같은 이유로 실패한다 — 더 부르지 않고 멈춘다
  let fatal: unknown = null

  const makeOne = async (shot: Shot) => {
    if (fatal) return
    try {
      let png: Uint8Array
      if (env.aiMode === 'live') {
        const rows = await existing()
        const anchor = (l: string) => rows.find((r) => r.label === l)?.path
        const refs = [model.cover_path!, anchor(FACE_FRONT), shot.kind === 'body' ? anchor(BODY_FRONT) : undefined].filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
        const [out] = await composeImages(await images(refs), shotPrompt(shot, look, refs.length), 1, '1024x1536')
        png = new Uint8Array(out)
      } else {
        png = await mockPortrait(SHOTS.indexOf(shot))
      }
      const path = await upload(modelFilePath(model.id, shot.key, 'png'), png, 'image/png')
      await must(db.from('model_images').insert({ model_id: model.id, label: shot.label, path, sort: 100 + SHOTS.indexOf(shot) }), '컷 저장')
      made.push(shot.label)
    } catch (e) {
      if (isFatalAiError(e)) fatal ??= e
      failed.push({ label: shot.label, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 1) 기준 컷 먼저 (나머지 컷이 이걸 같이 보고 그린다)
  await Promise.all(todo.filter((s) => s.label === FACE_FRONT || s.label === BODY_FRONT).map(makeOne))
  // 2) 나머지는 몇 장씩 동시에
  const rest = todo.filter((s) => s.label !== FACE_FRONT && s.label !== BODY_FRONT)
  for (let i = 0; i < rest.length && !fatal; i += PARALLEL) await Promise.all(rest.slice(i, i + PARALLEL).map(makeOne))

  if (fatal) throw fatal // 만든 컷은 남는다. 고친 뒤 "빠진 컷 채우기"로 이어서 만든다

  if (todo.length && !made.length) throw new Error(`각도 세트를 한 장도 만들지 못했어요: ${failed[0]?.error ?? '알 수 없는 오류'}`)
  return { made, failed, mock: env.aiMode === 'mock' }
}
