import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import { ChannelAuthError, refreshInstagramToken } from '@marketing/core/oauth'
import type { Content, ContentAsset, ContentPost, StoreChannel } from '@marketing/core/types'
import { db, download, must, signedUrl } from '../db'
import { env } from '../env'
import { publishInstagram, publishThreads, publishYoutube, type Media } from '../publish/platforms'
import { sleep } from './common'

export async function publishJob(p: JobPayloads['publish']): Promise<JobResults['publish']> {
  const post = (await must(db.from('content_posts').select('*').eq('id', p.postId).maybeSingle(), '업로드 조회')) as ContentPost | null
  if (!post) throw new Error('업로드 기록을 찾지 못했어요.')
  await must(db.from('content_posts').update({ status: 'uploading', error: null }).eq('id', post.id), '상태 저장')

  try {
    const url = await upload(post)
    const now = new Date().toISOString()
    await must(db.from('content_posts').update({ status: 'done', post_url: url, posted_at: now, error: null }).eq('id', post.id), '결과 저장')
    // 처음 올라간 시각을 발행 시각으로 남긴다
    await must(db.from('contents').update({ status: 'published' }).eq('id', post.content_id), '콘텐츠 상태 저장')
    await must(db.from('contents').update({ published_at: now }).eq('id', post.content_id).is('published_at', null), '발행 시각 저장')
    return { url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db.from('content_posts').update({ status: 'failed', error: msg }).eq('id', post.id)
    // 토큰이 끊겼으면 채널 관리에 "연결 만료"로 보이게 한다
    if (e instanceof ChannelAuthError && post.channel_id) {
      await db.from('store_channels').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', post.channel_id)
    }
    throw e
  }
}

const DAY = 86400_000

/** 인스타그램 장기 토큰(60일)은 갱신하지 않으면 끊긴다. 남은 기간이 20일 아래면 새로 받는다.
    발급 24시간 안에는 갱신이 안 되니 그때는 지금 토큰을 그대로 쓴다. */
export async function freshInstagram(ch: StoreChannel): Promise<StoreChannel> {
  if (ch.platform !== 'instagram' || !ch.access_token || !ch.token_expires_at) return ch
  const left = new Date(ch.token_expires_at).getTime() - Date.now()
  if (left > 20 * DAY) return ch
  if (Date.now() - new Date(ch.updated_at).getTime() < DAY && left > 0) return ch
  try {
    const r = await refreshInstagramToken(ch.access_token)
    const patch = { access_token: r.token, token_expires_at: r.expiresAt, status: 'connected' as const, updated_at: new Date().toISOString() }
    await must(db.from('store_channels').update(patch).eq('id', ch.id), '인스타그램 토큰 저장')
    return { ...ch, ...patch }
  } catch (e) {
    if (e instanceof ChannelAuthError) {
      await db.from('store_channels').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', ch.id)
    }
    if (left > 0) return ch // 아직 살아 있으면 이번 업로드는 지금 토큰으로
    throw e
  }
}

/** 하루 한 번 정도: 업로드가 없어도 인스타그램 토큰이 끊기지 않게 미리 연장한다 */
export async function refreshInstagramTokens() {
  const soon = new Date(Date.now() + 20 * DAY).toISOString()
  const { data } = await db.from('store_channels').select('*').eq('platform', 'instagram').eq('status', 'connected').lt('token_expires_at', soon)
  for (const ch of (data ?? []) as StoreChannel[]) {
    try {
      await freshInstagram(ch)
    } catch (e) {
      console.error(`[token] 인스타그램 ${ch.handle} 연장 실패:`, e instanceof Error ? e.message : e)
    }
  }
}

async function upload(post: ContentPost) {
  const content = (await must(db.from('contents').select('*').eq('id', post.content_id).maybeSingle(), '콘텐츠 조회')) as Content | null
  if (!content) throw new Error('콘텐츠를 찾지 못했어요.')
  const found = (await must(db.from('store_channels').select('*').eq('id', post.channel_id ?? '').maybeSingle(), '채널 조회')) as StoreChannel | null
  if (!found) throw new Error('채널이 등록 해제됐어요. 채널 관리를 확인해 주세요.')
  let ch = found

  if (env.publishMode === 'mock') {
    await sleep(1500)
    const handle = ch.handle.replace(/^@/, '') || 'account'
    const id = post.id.slice(0, 8)
    return {
      instagram: `https://www.instagram.com/${content.type === 'short' ? 'reel' : 'p'}/mock-${id}/`,
      youtube: `https://youtube.com/shorts/mock-${id}`,
      threads: `https://www.threads.net/@${handle}/post/mock-${id}`,
      kakao: ch.profile_url || 'https://pf.kakao.com/',
    }[ch.platform]
  }

  const assets = (await must(db.from('content_assets').select('*').eq('content_id', content.id), '파일 조회')) as ContentAsset[]
  const main = content.type === 'short' ? assets.find((a) => a.kind === 'video') : assets.find((a) => a.kind === 'variant' && a.selected)
  if (!main) throw new Error('올릴 결과 파일이 없어요. 다시 생성해 주세요.')
  const cover = assets.find((a) => a.kind === 'thumbnail' && a.selected) ?? assets.find((a) => a.kind === 'thumb_candidate' && a.selected)
  const media: Media = {
    type: content.type,
    url: await signedUrl(main.path, 6 * 3600),
    bytes: async () => (await download(main.path)).data,
    caption: post.caption,
    title: content.title || post.caption.split('\n')[0],
    coverUrl: cover ? await signedUrl(cover.path, 6 * 3600) : undefined,
  }
  if (ch.status === 'expired') throw new Error(`${ch.handle} 연결이 만료됐어요. 채널 관리에서 연결 링크를 다시 보내 허용받아 주세요.`)
  ch = await freshInstagram(ch)
  if (ch.platform === 'instagram') return publishInstagram(ch, media)
  if (ch.platform === 'threads') return publishThreads(ch, media)
  if (ch.platform === 'youtube') return publishYoutube(ch, media)
  throw new Error('카카오는 직접 올려야 해요.')
}
