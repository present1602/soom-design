'use server'

import { revalidatePath } from 'next/cache'
import { PLATFORM_INFO, supports } from '@marketing/core/channels'
import { MAX_PRODUCT_IMAGES, MAX_REFERENCE_IMAGES, isGeneratedPath, isUploadPath } from '@marketing/core/storage'
import type { Content, ContentSettings, StoreChannel } from '@marketing/core/types'
import { modelStatus } from '@marketing/core/types'
import { type StoreEvent, toSnapshot } from '@marketing/core/events'
import { type ShortLength, toShortLength } from '@marketing/core/short-length'
import { NARRATION_MAX } from '@marketing/core/voice'
import { actionStaff, actionStore, canSeeStore, fail, type Result } from '@/lib/staff'
import { db } from '@/lib/supabase'

/* ───────── 퍼스트 프레임 미리 합성 ───────── */

export async function requestFrameAction(input: { storeId: string; modelId: string; productPaths: string[]; prompt: string; moods: string[] }): Promise<Result<{ jobId: string }>> {
  await actionStore(input.storeId)
  if (!input.modelId) return fail('가상 모델을 먼저 골라 주세요.')
  if (!input.productPaths.length) return fail('제품 이미지를 한 장 이상 올려 주세요.')
  if (!input.productPaths.every(isUploadPath)) return fail('제품 이미지를 다시 올려 주세요.')
  const { data, error } = await db()
    .from('jobs')
    .insert({
      kind: 'compose_frame',
      payload: { modelId: input.modelId, productPaths: input.productPaths.slice(0, MAX_PRODUCT_IMAGES), prompt: input.prompt.trim().slice(0, 2000), moods: input.moods.slice(0, 10) },
    })
    .select('id')
    .single()
  if (error) return fail(`요청하지 못했어요: ${error.message}`)
  return { ok: true, jobId: data.id }
}

/* ───────── 생성 ───────── */

export type CreateInput = {
  storeId: string
  type: 'short' | 'banner'
  modelId: string
  prompt: string
  moods: string[]
  products: string[]
  references: string[]
  // 숏폼
  length?: ShortLength
  /** 고른 매장 이벤트 (없으면 이벤트 없이) */
  eventId?: string | null
  /** 내레이션 대본 (비우면 소리 없음) */
  narration?: string
  firstFrame?: { mode: 'none' | 'upload' | 'ai'; path?: string }
  thumb?: { mode: 'ai' | 'auto' | 'upload'; path?: string }
  // 배너
  size?: '1:1' | '4:5' | '9:16'
  variants?: 2 | 4
  headline?: string
  subline?: string
  cta?: string
}

function titleOf(prompt: string) {
  const first = prompt.split(/[.\n!?。]/)[0].trim()
  return (first || prompt).slice(0, 40)
}

export async function createContentAction(input: CreateInput): Promise<Result<{ contentId: string }>> {
  const staff = await actionStore(input.storeId)
  const prompt = input.prompt.trim()
  if (input.type !== 'short' && input.type !== 'banner') return fail('콘텐츠 유형이 올바르지 않아요.')
  if (!input.modelId) return fail('가상 모델을 골라 주세요.')
  if (prompt.length < 5) return fail('프롬프트를 조금 더 자세히 적어 주세요 (5자 이상).')
  if (input.products.length > MAX_PRODUCT_IMAGES) return fail(`제품 이미지는 ${MAX_PRODUCT_IMAGES}장까지예요.`)
  if (input.references.length > MAX_REFERENCE_IMAGES) return fail(`참고 이미지는 ${MAX_REFERENCE_IMAGES}장까지예요.`)
  if (![...input.products, ...input.references].every(isUploadPath)) return fail('이미지를 다시 올려 주세요.')

  const { data: model } = await db().from('virtual_models').select('*').eq('id', input.modelId).maybeSingle()
  if (!model || modelStatus(model) !== 'published') return fail(model && modelStatus(model) === 'draft' ? '고른 가상 모델이 아직 대기 상태예요. 모델 화면에서 공개한 뒤 골라 주세요.' : '고른 가상 모델을 쓸 수 없어요(숨김). 다른 모델을 골라 주세요.')
  const narration = input.type === 'short' ? (input.narration ?? '').trim() : ''
  if (narration.length > NARRATION_MAX) return fail(`내레이션은 ${NARRATION_MAX}자까지예요.`)
  if (narration && !(model.voice_source === 'upload' || model.voice)) return fail('고른 가상 모델에 목소리가 없어요. 모델 화면에서 목소리를 정하거나 내레이션을 비워 주세요.')

  // 분위기는 지금 켜져 있는 옵션 안에서만
  const { data: moodRows } = await db().from('mood_options').select('label').eq('active', true)
  const allowed = new Set((moodRows ?? []).map((m: { label: string }) => m.label))
  const moods = [...new Set(input.moods)].filter((m) => allowed.has(m)).slice(0, 10)

  const settings: ContentSettings = {}
  // 이벤트는 고른 시점의 내용을 콘텐츠에 복사해 둔다(나중에 이벤트를 고쳐도 이 콘텐츠의 기록은 그대로)
  if (input.eventId) {
    const { data: ev } = await db().from('store_events').select('*').eq('id', input.eventId).eq('store_id', input.storeId).maybeSingle()
    if (!ev) return fail('고른 이벤트를 찾지 못했어요. 새로고침한 뒤 다시 골라 주세요.')
    settings.event = toSnapshot(ev as StoreEvent)
  }
  const extra: { kind: 'first_frame' | 'thumbnail'; path: string }[] = []
  if (input.type === 'short') {
    settings.length = toShortLength(input.length)
    settings.firstFrame = input.firstFrame?.mode ?? 'none'
    settings.thumbMode = input.thumb?.mode ?? 'ai'
    if (narration) settings.narration = narration
    if (settings.firstFrame !== 'none') {
      const p = input.firstFrame?.path
      const valid = settings.firstFrame === 'upload' ? isUploadPath(p) : isGeneratedPath(p)
      if (!valid) return fail(settings.firstFrame === 'upload' ? '퍼스트 프레임 이미지를 올려 주세요. 안 쓰려면 "사용 안 함"을 고르세요.' : '퍼스트 프레임을 먼저 만들어 주세요. 안 쓰려면 "사용 안 함"을 고르세요.')
      extra.push({ kind: 'first_frame', path: p! })
    }
    if (settings.thumbMode === 'upload') {
      if (!isUploadPath(input.thumb?.path)) return fail('썸네일 이미지를 올려 주세요. 아니면 AI 추천이나 자동을 고르세요.')
      extra.push({ kind: 'thumbnail', path: input.thumb!.path! })
    }
  } else {
    settings.size = input.size === '4:5' || input.size === '9:16' ? input.size : '1:1'
    settings.variants = input.variants === 2 ? 2 : 4
    settings.headline = input.headline?.trim().slice(0, 40) || undefined
    settings.subline = input.subline?.trim().slice(0, 60) || undefined
    settings.cta = input.cta?.trim().slice(0, 16) || undefined
  }

  const c = await db()
    .from('contents')
    .insert({ store_id: input.storeId, type: input.type, status: 'generating', title: titleOf(prompt), prompt: prompt.slice(0, 2000), moods, model_id: input.modelId, settings, created_by: staff.id })
    .select('id')
    .single()
  if (c.error) return fail(`저장하지 못했어요: ${c.error.message}`)
  const contentId = c.data.id as string

  // 여러 행을 한 번에 넣을 때는 모든 행에 같은 칸이 있어야 한다(빠진 칸은 null 로 들어간다)
  const assets = [
    ...input.products.map((path, i) => ({ content_id: contentId, kind: 'product', path, sort: i, selected: false })),
    ...input.references.map((path, i) => ({ content_id: contentId, kind: 'reference', path, sort: i, selected: false })),
    ...extra.map((e) => ({ content_id: contentId, kind: e.kind, path: e.path, sort: 0, selected: e.kind === 'thumbnail' })),
  ]
  // 중간에 실패하면 만들다 만 콘텐츠가 "생성 중"으로 남지 않게 지운다
  const undo = () => db().from('contents').delete().eq('id', contentId)
  if (assets.length) {
    const { error } = await db().from('content_assets').insert(assets)
    if (error) {
      await undo()
      return fail(`첨부를 저장하지 못했어요: ${error.message}`)
    }
  }
  const j = await db().from('jobs').insert({ kind: input.type === 'short' ? 'generate_short' : 'generate_banner', payload: { contentId } })
  if (j.error) {
    await undo()
    return fail(`생성 요청을 넣지 못했어요: ${j.error.message}`)
  }
  revalidatePath('/contents')
  return { ok: true, contentId }
}

async function loadOwned(contentId: string) {
  const staff = await actionStaff()
  const { data } = await db().from('contents').select('*').eq('id', contentId).maybeSingle()
  const c = data as Content | null
  if (!c || !canSeeStore(staff, c.store_id)) throw new Error('콘텐츠를 찾지 못했어요.')
  return c
}

/** 같은 입력으로 다시 생성. 이전 결과(영상·썸네일 후보·배너 시안·자동 첫 장면)는 지운다. */
export async function regenerateAction(contentId: string): Promise<Result> {
  const c = await loadOwned(contentId)
  if (c.status === 'generating') return fail('지금 만들고 있어요. 끝난 뒤 다시 시도해 주세요.')
  const { count } = await db().from('content_posts').select('id', { count: 'exact', head: true }).eq('content_id', contentId).in('status', ['done', 'uploading', 'queued'])
  if (count) return fail('이미 올린 콘텐츠는 다시 생성할 수 없어요. 새로 만들어 주세요.')
  await db().from('content_assets').delete().eq('content_id', contentId).in('kind', ['video', 'thumb_candidate', 'variant', 'narration'])
  await db().from('content_assets').delete().eq('content_id', contentId).eq('kind', 'first_frame').contains('meta', { auto: true })
  await db().from('content_posts').delete().eq('content_id', contentId)
  const u = await db().from('contents').update({ status: 'generating', error: null }).eq('id', contentId)
  if (u.error) return fail(`다시 생성하지 못했어요: ${u.error.message}`)
  const j = await db().from('jobs').insert({ kind: c.type === 'short' ? 'generate_short' : 'generate_banner', payload: { contentId } })
  if (j.error) return fail(`생성 요청을 넣지 못했어요: ${j.error.message}`)
  return { ok: true }
}

/** 썸네일 후보나 배너 시안 중 하나 고르기 */
export async function selectAssetAction(contentId: string, assetId: string): Promise<Result> {
  await loadOwned(contentId)
  const { data: a } = await db().from('content_assets').select('id, kind').eq('id', assetId).eq('content_id', contentId).maybeSingle()
  if (!a || !['thumb_candidate', 'variant', 'thumbnail'].includes(a.kind)) return fail('고를 수 없는 파일이에요.')
  // 썸네일은 직접 올린 것과 추천 후보 중 하나만 쓴다
  const group = a.kind === 'variant' ? ['variant'] : ['thumb_candidate', 'thumbnail']
  const off = await db().from('content_assets').update({ selected: false }).eq('content_id', contentId).in('kind', group)
  if (off.error) return fail(`바꾸지 못했어요: ${off.error.message}`)
  const on = await db().from('content_assets').update({ selected: true }).eq('id', assetId)
  if (on.error) return fail(`바꾸지 못했어요: ${on.error.message}`)
  return { ok: true }
}

/* ───────── 업로드 ───────── */

export async function publishContentAction(contentId: string, posts: { channelId: string; caption: string }[]): Promise<Result> {
  const c = await loadOwned(contentId)
  if (c.status === 'generating') return fail('아직 만들고 있어요.')
  if (c.status === 'failed') return fail('생성에 실패한 콘텐츠예요. 다시 생성해 주세요.')
  if (!posts.length) return fail('올릴 채널을 하나 이상 골라 주세요.')

  const { data: chs } = await db().from('store_channels').select('*').eq('store_id', c.store_id)
  const channels = (chs ?? []) as StoreChannel[]
  const { data: prev } = await db().from('content_posts').select('channel_id, status').eq('content_id', contentId)
  const taken = new Set(((prev ?? []) as { channel_id: string; status: string }[]).filter((p) => p.status !== 'failed').map((p) => p.channel_id))

  const rows = []
  for (const p of posts) {
    const ch = channels.find((x) => x.id === p.channelId)
    if (!ch) return fail('등록 해제된 채널이 있어요. 새로고침해 주세요.')
    const name = PLATFORM_INFO[ch.platform].name
    if (!supports(ch.platform, c.type)) return fail(`${name}에는 ${c.type === 'short' ? '영상' : '이미지'}를 올릴 수 없어요.`)
    if (taken.has(ch.id)) return fail(`${name}에는 이미 올렸거나 올리는 중이에요.`)
    const caption = p.caption.trim()
    if (ch.platform === 'threads' && caption.length > 500) return fail('스레드 글은 500자까지예요.')
    if (ch.platform === 'youtube' && !caption) return fail('유튜브 제목을 넣어 주세요.')
    rows.push({ content_id: contentId, channel_id: ch.id, platform: ch.platform, caption: caption.slice(0, 2200), status: PLATFORM_INFO[ch.platform].api ? 'queued' : 'manual' })
  }
  // 실패했던 기록은 지우고 새로 올린다
  await db().from('content_posts').delete().eq('content_id', contentId).eq('status', 'failed').in('channel_id', rows.map((r) => r.channel_id))
  const ins = await db().from('content_posts').insert(rows).select('id, status')
  if (ins.error) return fail(`업로드를 시작하지 못했어요: ${ins.error.message}`)
  const jobs = (ins.data as { id: string; status: string }[]).filter((r) => r.status === 'queued').map((r) => ({ kind: 'publish', payload: { postId: r.id }, max_attempts: 1 }))
  if (jobs.length) {
    const j = await db().from('jobs').insert(jobs)
    if (j.error) return fail(`업로드 요청을 넣지 못했어요: ${j.error.message}`)
  }
  revalidatePath('/contents')
  return { ok: true }
}

/** 카카오처럼 직접 올린 채널: 게시물 주소를 적으면 완료 */
export async function markManualPostedAction(postId: string, url: string): Promise<Result> {
  const staff = await actionStaff()
  const u = url.trim()
  if (!/^https?:\/\/\S+$/.test(u)) return fail('올린 게시물 주소를 https:// 로 시작하게 붙여 넣어 주세요.')
  const { data: post } = await db().from('content_posts').select('id, content_id, contents(store_id)').eq('id', postId).maybeSingle()
  const p = post as unknown as { id: string; content_id: string; contents: { store_id: string } | null } | null
  if (!p?.contents || !canSeeStore(staff, p.contents.store_id)) return fail('업로드 기록을 찾지 못했어요.')
  const now = new Date().toISOString()
  const { error } = await db().from('content_posts').update({ status: 'done', post_url: u, posted_at: now, error: null }).eq('id', postId)
  if (error) return fail(`저장하지 못했어요: ${error.message}`)
  await db().from('contents').update({ status: 'published' }).eq('id', p.content_id)
  await db().from('contents').update({ published_at: now }).eq('id', p.content_id).is('published_at', null)
  revalidatePath('/contents')
  return { ok: true }
}
