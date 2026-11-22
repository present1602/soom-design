import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import type { Content, ContentAsset } from '@marketing/core/types'
import { composeImages, generateImages } from '@marketing/core/ai/openai-image'
import { pollTask, startImageToVideo } from '@marketing/core/ai/runway'
import { inspirePrompt } from '@marketing/core/model-shots'
import { bannerPrompt, modelPrompt, videoPrompt } from '@marketing/core/prompt'
import { segmentsOf, toShortLength } from '@marketing/core/short-length'
import { candidatePath, generatedPath } from '@marketing/core/storage'
import { db, download, must, upload } from '../db'
import { env } from '../env'
import { concatVideos, cropTo, extractFrames, lastFrame, mixNarration, mockComposite, mockPortrait, mockVideo, normalizeVideo } from '../ffmpeg'
import { composeFrame, images, loadModel, loadStoreBrief, sleep } from './common'
import { narrate } from './voice'

async function loadContent(id: string) {
  const c = await must(db.from('contents').select('*').eq('id', id).maybeSingle(), '콘텐츠 조회')
  if (!c) throw new Error('콘텐츠를 찾지 못했어요.')
  const assets = await must(db.from('content_assets').select('*').eq('content_id', id).order('sort'), '첨부 조회')
  return { content: c as Content, assets: assets as ContentAsset[] }
}

async function addAsset(contentId: string, kind: ContentAsset['kind'], path: string, sort: number, selected = false, meta: Record<string, unknown> = {}) {
  await must(db.from('content_assets').insert({ content_id: contentId, kind, path, sort, selected, meta }), '결과 저장')
}

/* ───────── 퍼스트 프레임 미리 만들기 ───────── */
export async function composeFrameJob(p: JobPayloads['compose_frame']): Promise<JobResults['compose_frame']> {
  const path = await composeFrame(p.modelId, p.productPaths, p.prompt, p.moods, Date.now() % 6)
  return { path, mock: env.aiMode === 'mock' }
}

/* ───────── 숏폼 ───────── */
export async function generateShortJob(p: JobPayloads['generate_short']): Promise<JobResults['generate_short']> {
  const { content, assets } = await loadContent(p.contentId)
  if (!content.model_id) throw new Error('가상 모델이 정해지지 않았어요.')
  const len = toShortLength(content.settings.length)
  const segments = segmentsOf(len)
  const products = assets.filter((a) => a.kind === 'product').map((a) => a.path)
  // 홈페이지 자료는 생성 직전에 매번 새로 불러온다 (모의 생성에서도 불러서 연결을 확인할 수 있게)
  const { brief, siteFeed } = await loadStoreBrief(content.store_id, content.settings.event)

  // 0) 내레이션을 가장 먼저 만든다 — 목소리 키·크레딧 문제면 비싼 이미지·영상 단계 전에 멈춘다
  const narration = content.settings.narration?.trim()
  const speech = narration ? await narrate(content.model_id, narration) : null
  if (speech) await addAsset(content.id, 'narration', await upload(generatedPath('mp3'), speech, 'audio/mpeg'), 0)

  // 1) 첫 장면: 직접 올렸거나 미리 합성한 것 → 없으면 모델+제품 합성 → 제품이 없으면 모델 사진
  let framePath = assets.find((a) => a.kind === 'first_frame')?.path
  if (!framePath) {
    if (products.length) {
      framePath = await composeFrame(content.model_id, products, content.prompt, content.moods)
    } else {
      framePath = (await loadModel(content.model_id)).model.cover_path!
    }
    await addAsset(content.id, 'first_frame', framePath, 0, false, { auto: true })
  }
  const frame = await download(framePath)

  // 2) 영상. 15·30초는 구간(5·10초)마다 앞 구간의 마지막 장면에서 이어 만들어 붙인다
  const parts: Uint8Array[] = []
  if (env.aiMode === 'live') {
    const { brief: mb } = await loadModel(content.model_id)
    const prompt = videoPrompt(content.prompt, content.moods, brief, mb.persona)
    let img = frame
    for (const [i, seg] of segments.entries()) {
      const dataUri = `data:${img.mime};base64,${Buffer.from(img.data).toString('base64')}`
      const part = await normalizeVideo(await runwayClip(dataUri, prompt, seg, i, segments.length))
      parts.push(part)
      if (i < segments.length - 1) img = { data: await lastFrame(part), mime: 'image/png' }
    }
  } else {
    parts.push(await normalizeVideo(await mockVideo(frame.data, len)))
  }
  let video = await concatVideos(parts)

  // 3) 내레이션을 영상에 입힌다 (영상보다 길면 뒤가 잘린다)
  if (speech) video = await mixNarration(video, speech)
  const videoPath = await upload(generatedPath('mp4'), video, 'video/mp4')
  await addAsset(content.id, 'video', videoPath, 0, true)

  // 4) 썸네일 후보. 직접 올린 썸네일이 없으면 첫 후보를 골라 둔다(화면에서 바꿀 수 있다).
  const uploadedThumb = assets.some((a) => a.kind === 'thumbnail')
  const frames = await extractFrames(video, 4)
  for (const [i, f] of frames.entries()) {
    const fp = await upload(generatedPath('jpg'), f, 'image/jpeg')
    await addAsset(content.id, 'thumb_candidate', fp, i, !uploadedThumb && i === 0)
  }

  await must(
    db.from('contents').update({ status: 'ready', error: null, settings: { ...content.settings, mock: env.aiMode === 'mock', siteFeed, narrated: !!narration } }).eq('id', content.id),
    '상태 저장',
  )
  return { videoPath }
}

/** Runway 로 한 구간을 만들고 결과 영상을 받는다 */
async function runwayClip(imageDataUri: string, prompt: string, duration: 5 | 10, i: number, total: number) {
  const where = total > 1 ? ` (${i + 1}/${total}구간)` : ''
  const taskId = await startImageToVideo({ imageDataUri, prompt, duration })
  const started = Date.now()
  for (;;) {
    await sleep(5000)
    const t = await pollTask(taskId)
    if (t.state === 'failed') throw t.failure!
    if (t.state === 'succeed' && t.videoUrl) {
      const res = await fetch(t.videoUrl)
      if (!res.ok) throw new Error(`만든 영상을 받지 못했어요${where} (${res.status})`)
      return new Uint8Array(await res.arrayBuffer())
    }
    if (Date.now() - started > 12 * 60_000) throw new Error(`영상 생성이 12분 넘게 끝나지 않았어요${where}. 다시 시도해 주세요.`)
  }
}

/* ───────── 배너 ───────── */
const BANNER_PX = { '1:1': [1080, 1080], '4:5': [1080, 1350], '9:16': [1080, 1920] } as const

export async function generateBannerJob(p: JobPayloads['generate_banner']): Promise<JobResults['generate_banner']> {
  const { content, assets } = await loadContent(p.contentId)
  if (!content.model_id) throw new Error('가상 모델이 정해지지 않았어요.')
  const size = content.settings.size ?? '1:1'
  const n = content.settings.variants === 2 ? 2 : 4
  const { brief, siteFeed } = await loadStoreBrief(content.store_id, content.settings.event)
  const products = assets.filter((a) => a.kind === 'product').map((a) => a.path)
  const refs = assets.filter((a) => a.kind === 'reference').map((a) => a.path)
  const { paths, brief: mb } = await loadModel(content.model_id)

  let outs: Uint8Array[]
  if (env.aiMode === 'live') {
    const imgs = await images([paths[0], ...products.slice(0, 8), ...refs.slice(0, 2)])
    const prompt = bannerPrompt(content.prompt, content.moods, brief, { headline: content.settings.headline, subline: content.settings.subline, cta: content.settings.cta }, size, mb.persona)
    const raw = await composeImages(imgs, prompt, n, size === '1:1' ? '1024x1024' : '1024x1536')
    outs = await Promise.all(raw.map((b) => cropTo(new Uint8Array(b), size)))
  } else {
    const [model, ...prods] = await images([paths[0], ...products.slice(0, 3)])
    const [w, h] = BANNER_PX[size]
    outs = []
    for (let i = 0; i < n; i++) outs.push(await mockComposite({ model: model.data, products: prods.map((x) => x.data), w, h, seed: i }))
  }

  const variantPaths: string[] = []
  for (const [i, png] of outs.entries()) {
    const vp = await upload(generatedPath('png'), png, 'image/png')
    await addAsset(content.id, 'variant', vp, i, i === 0)
    variantPaths.push(vp)
  }
  await must(
    db.from('contents').update({ status: 'ready', error: null, settings: { ...content.settings, mock: env.aiMode === 'mock', siteFeed } }).eq('id', content.id),
    '상태 저장',
  )
  return { variantPaths }
}

/* ───────── 가상 모델 후보 ───────── */
export async function modelCandidatesJob(p: JobPayloads['model_candidates']): Promise<JobResults['model_candidates']> {
  let outs: Uint8Array[]
  if (env.aiMode === 'live') {
    // 참고 사진이 있으면 그 사람이 아니라 분위기만 따온 다른 인물로 (초상권)
    const refs = (p.refPaths ?? []).slice(0, 5)
    const raw = refs.length
      ? await composeImages(await images(refs), inspirePrompt({ gender: p.gender, ageBand: p.ageBand, mood: p.mood, persona: p.persona }, refs.length), 4, '1024x1536')
      : await generateImages(modelPrompt(p.gender, p.ageBand, p.mood, p.persona), 4, '1024x1536')
    outs = raw.map((b) => new Uint8Array(b))
  } else {
    outs = await Promise.all([0, 1, 2, 3].map((i) => mockPortrait(i + Math.floor(Math.random() * 6))))
  }
  const paths = []
  // 아직 모델이 없어 후보 폴더에 둔다. 고른 한 장은 모델을 저장할 때 모델 폴더로 옮긴다(console lib/model-files.ts)
  for (const o of outs) paths.push(await upload(candidatePath(), o, 'image/png'))
  return { paths, mock: env.aiMode === 'mock' }
}
