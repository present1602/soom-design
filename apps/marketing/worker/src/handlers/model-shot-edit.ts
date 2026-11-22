import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import { composeImages } from '@marketing/core/ai/openai-image'
import { BODY_FRONT, FACE_FRONT, shotEditPrompt, shotOf, shotPrompt } from '@marketing/core/model-shots'
import { isModelImagePath, modelFilePath } from '@marketing/core/storage'
import type { VirtualModel } from '@marketing/core/types'
import { db, must, upload } from '../db'
import { env } from '../env'
import { mockPortrait } from '../ffmpeg'
import { images } from './common'

/* 모델 이미지 한 장의 수정본 만들기.
   수정본은 models/<모델ID>/draft-<컷>-<8자>.png 로만 저장하고 model_images 는 건드리지 않는다.
   콘솔에서 원본과 나란히 보고 고르면 그때 교체한다(console actions/models.ts applyShotEditAction). */
export async function modelShotEditJob(p: JobPayloads['model_shot_edit']): Promise<JobResults['model_shot_edit']> {
  const m = await must(db.from('virtual_models').select('*').eq('id', p.modelId).maybeSingle(), '모델 조회')
  if (!m) throw new Error('가상 모델을 찾지 못했어요. 삭제됐을 수 있어요.')
  const model = m as VirtualModel
  if (!model.cover_path) throw new Error(`가상 모델 ${model.name}에 대표 이미지가 없어요.`)
  const img = (await must(db.from('model_images').select('label, path').eq('id', p.imageId).eq('model_id', model.id).maybeSingle(), '이미지 조회')) as { label: string; path: string } | null
  if (!img) throw new Error('고칠 이미지를 찾지 못했어요. 지워졌을 수 있어요.')

  const shot = shotOf(img.label)
  const look = { gender: model.gender, ageBand: model.age_band, mood: model.mood }
  const rows = (await must(db.from('model_images').select('label, path').eq('model_id', model.id), '모델 이미지 조회')) as { label: string; path: string }[]
  const anchor = (l: string) => rows.find((r) => r.label === l)?.path
  // 같은 사람으로 맞출 기준: 대표 + 얼굴 정면 (+ 전신 컷이면 전신 정면)
  const anchors = [model.cover_path, anchor(FACE_FRONT), shot?.kind === 'body' ? anchor(BODY_FRONT) : undefined]
  const n = Math.min(Math.max(p.n || 2, 1), 4)

  let outs: Uint8Array[]
  if (env.aiMode === 'live') {
    let refs: string[]
    let prompt: string
    if (p.mode === 'fresh') {
      if (!shot) throw new Error('직접 올린 이미지는 처음부터 다시 그릴 수 없어요. "수정"으로 고쳐 주세요.')
      refs = uniq(anchors.filter((x) => x !== img.path))
      prompt = shotPrompt(shot, look, refs.length)
    } else {
      // 이어서 수정이면 그 수정본을, 아니면 지금 사진을 고친다
      const base = p.basePath && isModelImagePath(p.basePath, model.id) ? p.basePath : img.path
      refs = uniq([base, ...anchors.filter((x) => x !== img.path)])
      prompt = shotEditPrompt(img.label, look, (p.instruction ?? '').trim(), refs.length)
    }
    outs = (await composeImages(await images(refs), prompt, n, '1024x1536')).map((b) => new Uint8Array(b))
  } else {
    outs = await Promise.all(Array.from({ length: n }, () => mockPortrait(Math.floor(Math.random() * 12))))
  }

  const name = `draft-${shot?.key ?? 'ref'}`
  const paths: string[] = []
  for (const o of outs) paths.push(await upload(modelFilePath(model.id, name, 'png'), o, 'image/png'))
  return { paths, mock: env.aiMode === 'mock' }
}

function uniq(xs: (string | undefined | null)[]) {
  return xs.filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
}
