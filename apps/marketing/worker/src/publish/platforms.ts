/* 플랫폼별 업로드 (PUBLISH_MODE=live).
   토큰은 고객이 연결 링크(/connect/…)에서 허용한 뒤 store_channels 에 저장된다(console/src/lib/oauth.ts).
   - 인스타그램: https://developers.facebook.com/docs/instagram-platform/content-publishing/
   - 스레드:     https://developers.facebook.com/docs/threads/posts (연결 흐름은 아직 없다)
   - 유튜브:     https://developers.google.com/youtube/v3/docs/videos/insert */
import { googleAccessToken as exchangeRefresh, IG_GRAPH, readJson as json } from '@marketing/core/oauth'
import type { StoreChannel } from '@marketing/core/types'
import { sleep } from '../handlers/common'

export type Media = { type: 'short' | 'banner'; url: string; bytes?: () => Promise<Uint8Array>; caption: string; title: string; coverUrl?: string }

function need(ch: StoreChannel) {
  if (!ch.access_token || !ch.external_id) {
    throw new Error('이 채널은 아직 연결되지 않았어요. 채널 관리에서 고객에게 연결 링크를 보내 허용받아 주세요.')
  }
  return { token: ch.access_token, userId: ch.external_id }
}

/* Meta 계열(인스타그램·스레드)은 컨테이너를 만들고 → 준비될 때까지 기다렸다 → 발행한다 */
async function waitReady(statusUrl: string, field: 'status_code' | 'status', what: string) {
  for (let i = 0; i < 60; i++) {
    const s = await json<Record<string, string>>(await fetch(statusUrl), `${what} 상태 확인`)
    if (s[field] === 'FINISHED') return
    if (s[field] === 'ERROR' || s[field] === 'EXPIRED') {
      // 인스타그램은 status 에 이유가 온다(예: 영상 규격 오류)
      const why = field === 'status_code' && s.status && s.status !== s[field] ? `: ${s.status}` : ''
      throw new Error(`${what} 처리에 실패했어요 (${s[field]}${why})`)
    }
    await sleep(5000)
  }
  throw new Error(`${what} 처리가 5분 넘게 끝나지 않았어요`)
}

export async function publishInstagram(ch: StoreChannel, m: Media) {
  const { token, userId } = need(ch)
  const base = IG_GRAPH
  const params = new URLSearchParams({ access_token: token, caption: m.caption })
  if (m.type === 'short') {
    params.set('media_type', 'REELS')
    params.set('video_url', m.url)
    params.set('share_to_feed', 'true')
    if (m.coverUrl) params.set('cover_url', m.coverUrl)
  } else {
    params.set('image_url', m.url)
  }
  const c = await json<{ id: string }>(await fetch(`${base}/${userId}/media`, { method: 'POST', body: params }), '인스타그램 업로드 준비')
  await waitReady(`${base}/${c.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`, 'status_code', '인스타그램')
  const pub = await json<{ id: string }>(
    await fetch(`${base}/${userId}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }),
    '인스타그램 발행',
  )
  const info = await json<{ permalink?: string }>(await fetch(`${base}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), '게시물 주소 조회')
  return info.permalink ?? `https://www.instagram.com/${ch.handle.replace(/^@/, '')}/`
}

export async function publishThreads(ch: StoreChannel, m: Media) {
  const { token, userId } = need(ch)
  const base = 'https://graph.threads.net/v1.0'
  const params = new URLSearchParams({ access_token: token, text: m.caption.slice(0, 500) })
  if (m.type === 'short') {
    params.set('media_type', 'VIDEO')
    params.set('video_url', m.url)
  } else {
    params.set('media_type', 'IMAGE')
    params.set('image_url', m.url)
  }
  const c = await json<{ id: string }>(await fetch(`${base}/${userId}/threads`, { method: 'POST', body: params }), '스레드 업로드 준비')
  await waitReady(`${base}/${c.id}?fields=status&access_token=${encodeURIComponent(token)}`, 'status', '스레드')
  const pub = await json<{ id: string }>(
    await fetch(`${base}/${userId}/threads_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }),
    '스레드 발행',
  )
  const info = await json<{ permalink?: string }>(await fetch(`${base}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), '게시물 주소 조회')
  return info.permalink ?? `https://www.threads.net/${ch.handle}`
}

async function googleAccessToken(ch: StoreChannel) {
  if (!ch.refresh_token) throw new Error('유튜브 채널이 아직 연결되지 않았어요. 채널 관리에서 고객에게 연결 링크를 보내 주세요.')
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET 가 없어 유튜브 토큰을 갱신할 수 없어요. worker/.env.local 을 확인해 주세요.')
  return exchangeRefresh(ch.refresh_token, id, secret)
}

export async function publishYoutube(ch: StoreChannel, m: Media) {
  if (m.type !== 'short' || !m.bytes) throw new Error('유튜브에는 영상만 올릴 수 있어요.')
  const token = await googleAccessToken(ch)
  const bytes = await m.bytes()
  const meta = {
    snippet: { title: m.title.slice(0, 100), description: m.caption.slice(0, 4900), categoryId: '22' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    // 2026-11-16 부터 매번 밝혀야 한다(YouTube Data API revision history)
    paidProductPlacementDetails: { hasPaidProductPlacement: false },
  }
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,paidProductPlacementDetails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(bytes.byteLength),
    },
    body: JSON.stringify(meta),
  })
  if (!init.ok) await json(init, '유튜브 업로드 준비')
  const loc = init.headers.get('location')
  if (!loc) throw new Error('유튜브 업로드 주소를 받지 못했어요')
  const done = await json<{ id: string }>(
    await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: new Uint8Array(bytes) }),
    '유튜브 업로드',
  )
  return `https://youtube.com/shorts/${done.id}`
}
