import type { StoreBrief, ModelBrief } from '@marketing/core/prompt'
import type { VirtualModel } from '@marketing/core/types'
import { composeImages, type InputImage } from '@marketing/core/ai/openai-image'
import { BODY_FRONT, FACE_FRONT } from '@marketing/core/model-shots'
import { personaBrief } from '@marketing/core/persona'
import { framePrompt } from '@marketing/core/prompt'
import { eventBrief, type EventSnapshot } from '@marketing/core/events'
import { fetchHomepage, homepageBrief, type HomepageSnapshot } from '@marketing/core/homepage'
import { fetchSiteFeed, siteFeedBrief, type SiteFeed, type SiteFeedUse } from '@marketing/core/site-feed'
import { generatedPath } from '@marketing/core/storage'
import { db, download, must, upload } from '../db'
import { env } from '../env'
import { mockComposite } from '../ffmpeg'

export async function loadModel(modelId: string) {
  const m = await must(db.from('virtual_models').select('*').eq('id', modelId).maybeSingle(), '모델 조회')
  if (!m) throw new Error('가상 모델을 찾지 못했어요. 삭제됐을 수 있어요.')
  const model = m as VirtualModel
  if (!model.cover_path) throw new Error(`가상 모델 ${model.name}에 대표 이미지가 없어요.`)
  // 대표 + 기준 컷 두 장. 각도 세트가 있으면 얼굴 정면·전신 정면, 없으면 앞의 두 장
  const all = (await must(db.from('model_images').select('path, label').eq('model_id', modelId).order('sort'), '모델 이미지 조회')) as { path: string; label: string }[]
  const preferred = [FACE_FRONT, BODY_FRONT].map((l) => all.find((r) => r.label === l)).filter((r): r is { path: string; label: string } => !!r)
  const extra = (preferred.length ? [...preferred, ...all.filter((r) => !preferred.includes(r))] : all).slice(0, 2)
  const brief: ModelBrief = { name: model.name, gender: model.gender, ageBand: model.age_band, mood: model.mood, persona: personaBrief(model.persona) || undefined }
  return { model, brief, paths: [model.cover_path, ...extra.map((r) => r.path)] }
}

/** 매장 정보 + 홈페이지 자료 + 고른 이벤트. 홈페이지 자료는 생성 직전에 매번 새로 불러온다.
    자료 API 를 켠 매장은 API, 아니면 홈페이지 주소의 페이지 글을 읽는다. */
export async function loadStoreBrief(storeId: string, event?: EventSnapshot): Promise<{ brief: StoreBrief; siteFeed: SiteFeedUse }> {
  const s = await must(db.from('stores').select('name, intro, clients(name)').eq('id', storeId).maybeSingle(), '매장 조회')
  if (!s) throw new Error('매장을 찾지 못했어요.')
  const row = s as unknown as { name: string; intro: string; clients: { name: string } | null }
  const { site, use } = await loadSite(storeId)
  return { brief: { clientName: row.clients?.name ?? '', storeName: row.name, intro: row.intro, site, event: event ? eventBrief(event) : undefined }, siteFeed: use }
}

type SiteRow = {
  site_feed_url: string
  site_feed_token: string | null
  site_feed_cache: SiteFeed | null
  site_feed_fetched_at: string | null
  homepage_url?: string
  homepage_cache?: HomepageSnapshot | null
  homepage_fetched_at?: string | null
}

/** 실패하면 지난 자료로 대신하고, 그것도 없으면 자료 없이 진행한다(생성은 막지 않는다). */
async function loadSite(storeId: string): Promise<{ site: string; use: SiteFeedUse }> {
  const none = { site: '', use: { source: 'none' } as SiteFeedUse }
  let { data, error } = await db.from('stores').select('site_feed_url, site_feed_token, site_feed_cache, site_feed_fetched_at, homepage_url, homepage_cache, homepage_fetched_at').eq('id', storeId).maybeSingle()
  // 0005 전이면 홈페이지 칸이 없다 — 자료 API 칸만 다시 읽는다 (0002 전이면 자료 없이)
  if (error) ({ data, error } = await db.from('stores').select('site_feed_url, site_feed_token, site_feed_cache, site_feed_fetched_at').eq('id', storeId).maybeSingle())
  if (error || !data) return none
  const row = data as SiteRow

  if (row.site_feed_url) {
    try {
      const feed = await fetchSiteFeed(row.site_feed_url, row.site_feed_token)
      const fetchedAt = new Date().toISOString()
      await db.from('stores').update({ site_feed_cache: feed, site_feed_fetched_at: fetchedAt, site_feed_error: null }).eq('id', storeId)
      return { site: siteFeedBrief(feed), use: { source: 'live', via: 'api', fetchedAt, items: feed.items.length } }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[site-feed] ${storeId}: ${msg}`)
      await db.from('stores').update({ site_feed_error: msg }).eq('id', storeId)
      if (row.site_feed_cache) return { site: siteFeedBrief(row.site_feed_cache), use: { source: 'cache', via: 'api', fetchedAt: row.site_feed_fetched_at ?? undefined, items: row.site_feed_cache.items.length, error: msg } }
      return { site: '', use: { source: 'none', via: 'api', error: msg } }
    }
  }

  if (row.homepage_url) {
    try {
      const snap = await fetchHomepage(row.homepage_url)
      const fetchedAt = new Date().toISOString()
      await db.from('stores').update({ homepage_cache: snap, homepage_fetched_at: fetchedAt, homepage_error: null }).eq('id', storeId)
      return { site: homepageBrief(snap), use: { source: 'live', via: 'homepage', fetchedAt } }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[homepage] ${storeId}: ${msg}`)
      await db.from('stores').update({ homepage_error: msg }).eq('id', storeId)
      if (row.homepage_cache) return { site: homepageBrief(row.homepage_cache), use: { source: 'cache', via: 'homepage', fetchedAt: row.homepage_fetched_at ?? undefined, error: msg } }
      return { site: '', use: { source: 'none', via: 'homepage', error: msg } }
    }
  }
  return none
}

export async function images(paths: string[]): Promise<InputImage[]> {
  return Promise.all(
    paths.map(async (p, i) => {
      const f = await download(p)
      return { data: f.data, mime: f.mime, name: `img${i}.${p.split('.').pop()}` }
    }),
  )
}

/** 모델 + 제품으로 9:16 장면 한 장. 결과는 generated/ 에 저장하고 경로를 돌려준다. */
export async function composeFrame(modelId: string, productPaths: string[], prompt: string, moods: string[], seed = 0) {
  const { brief, paths } = await loadModel(modelId)
  let png: Uint8Array
  if (env.aiMode === 'live') {
    const imgs = await images([...paths.slice(0, 2), ...productPaths.slice(0, 8)])
    const [first] = await composeImages(imgs, framePrompt(prompt, moods, brief), 1, '1024x1536')
    png = new Uint8Array(first)
  } else {
    const [model, ...products] = await images([paths[0], ...productPaths.slice(0, 3)])
    png = await mockComposite({ model: model.data, products: products.map((p) => p.data), w: 1080, h: 1920, seed })
  }
  return upload(generatedPath('png'), png, 'image/png')
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
