import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'
import { CONNECT_LINK_DAYS, GOOGLE_SCOPES, IG_GRAPH, IG_SCOPES, readJson, type ConnectState } from '@marketing/core/oauth'
import { db } from './supabase'

/* 연결 링크 = /connect/<서명된 상태값>. 같은 값을 OAuth state 로 넘겨 콜백에서 어느 매장·플랫폼인지 안다.
   로그인 없이 열리는 링크라(고객이 연다) 서명과 만료로만 지킨다. */

function secret() {
  const s = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('OAUTH_STATE_SECRET 가 없어요. console/.env.local 을 확인해 주세요.')
  return s
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const mac = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url')

export function signState(storeId: string, platform: ConnectState['platform']) {
  const body = b64(JSON.stringify({ storeId, platform, exp: Date.now() + CONNECT_LINK_DAYS * 86400_000 } satisfies ConnectState))
  return `${body}.${mac(body)}`
}

/** 서명이 맞고 안 지났으면 내용, 아니면 이유 */
export function readState(token: string): { ok: true; state: ConnectState } | { ok: false; error: string } {
  const [body, sig] = token.split('.')
  if (!body || !sig) return { ok: false, error: '링크가 잘못됐어요. 받은 링크를 그대로 열어 주세요.' }
  const want = Buffer.from(mac(body))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, error: '링크가 잘못됐어요. 받은 링크를 그대로 열어 주세요.' }
  try {
    const state = JSON.parse(Buffer.from(body, 'base64url').toString()) as ConnectState
    if (state.exp < Date.now()) return { ok: false, error: `링크가 만료됐어요(${CONNECT_LINK_DAYS}일). 담당자에게 새 링크를 요청해 주세요.` }
    return { ok: true, state }
  } catch {
    return { ok: false, error: '링크가 잘못됐어요. 받은 링크를 그대로 열어 주세요.' }
  }
}

/** 콘솔 바깥 주소. 플랫폼에 등록한 리디렉션 주소와 정확히 같아야 한다 — CONSOLE_URL 을 두면 그것만 쓴다 */
export async function baseUrl() {
  const fixed = process.env.CONSOLE_URL?.replace(/\/+$/, '')
  if (fixed) return fixed
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export const callbackPath = (p: ConnectState['platform']) => `/api/oauth/callback/${p}`

function creds(p: ConnectState['platform']) {
  const id = p === 'instagram' ? process.env.INSTAGRAM_APP_ID : process.env.GOOGLE_CLIENT_ID
  const sec = p === 'instagram' ? process.env.INSTAGRAM_APP_SECRET : process.env.GOOGLE_CLIENT_SECRET
  return id && sec ? { id, secret: sec } : null
}

/** 연결에 필요한 키가 없으면 그 안내 문구 */
export function missingKeys(p: ConnectState['platform']) {
  if (creds(p)) return null
  return p === 'instagram'
    ? 'INSTAGRAM_APP_ID · INSTAGRAM_APP_SECRET 가 없어 인스타그램 연결을 시작할 수 없어요. console/.env.local 을 확인해 주세요.'
    : 'GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET 가 없어 유튜브 연결을 시작할 수 없어요. console/.env.local 을 확인해 주세요.'
}

/** 고객이 로그인·허용하는 플랫폼 화면 주소 */
export async function authorizeUrl(state: ConnectState, token: string) {
  const c = creds(state.platform)
  if (!c) throw new Error(missingKeys(state.platform)!)
  const redirect = (await baseUrl()) + callbackPath(state.platform)
  if (state.platform === 'instagram') {
    const u = new URL('https://www.instagram.com/oauth/authorize')
    u.searchParams.set('client_id', c.id)
    u.searchParams.set('redirect_uri', redirect)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', IG_SCOPES.join(','))
    u.searchParams.set('state', token)
    return u.toString()
  }
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', c.id)
  u.searchParams.set('redirect_uri', redirect)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
  u.searchParams.set('access_type', 'offline') // refresh_token 받기
  u.searchParams.set('prompt', 'consent') // 다시 연결할 때도 refresh_token 을 새로 받는다
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', token)
  return u.toString()
}

type Connected = { handle: string; profileUrl: string; externalId: string; accessToken: string | null; refreshToken: string | null; expiresAt: string | null }

/** 허용 코드 → 토큰 + 계정 정보 */
export async function exchange(platform: ConnectState['platform'], code: string): Promise<Connected> {
  const c = creds(platform)
  if (!c) throw new Error(missingKeys(platform)!)
  const redirect = (await baseUrl()) + callbackPath(platform)
  return platform === 'instagram' ? exchangeInstagram(c, code, redirect) : exchangeGoogle(c, code, redirect)
}

async function exchangeInstagram(c: { id: string; secret: string }, rawCode: string, redirect: string): Promise<Connected> {
  const code = rawCode.replace(/#_$/, '') // 인스타그램이 끝에 붙이는 #_ 는 코드가 아니다
  const short = await readJson<{ data?: { access_token: string; permissions?: string }[]; access_token?: string; permissions?: string }>(
    await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, grant_type: 'authorization_code', redirect_uri: redirect, code }),
    }),
    '인스타그램 허용 확인',
  )
  const s = short.data?.[0] ?? short
  if (!s.access_token) throw new Error('인스타그램이 토큰을 주지 않았어요. 다시 시도해 주세요.')
  const perms = s.permissions ?? ''
  if (perms && !perms.includes('instagram_business_content_publish')) {
    throw new Error('게시물 올리기 권한을 허용하지 않았어요. 다시 연결하면서 모든 권한을 허용해 주세요.')
  }

  const long = new URL('https://graph.instagram.com/access_token')
  long.searchParams.set('grant_type', 'ig_exchange_token')
  long.searchParams.set('client_secret', c.secret)
  long.searchParams.set('access_token', s.access_token)
  const l = await readJson<{ access_token: string; expires_in: number }>(await fetch(long), '인스타그램 장기 토큰 발급')

  const me = new URL(`${IG_GRAPH}/me`)
  me.searchParams.set('fields', 'user_id,username')
  me.searchParams.set('access_token', l.access_token)
  const raw = await readJson<{ data?: { user_id: string; username: string }[]; user_id?: string; username?: string }>(await fetch(me), '인스타그램 계정 확인')
  const info = raw.data?.[0] ?? raw
  if (!info.user_id) throw new Error('인스타그램 계정 정보를 받지 못했어요. 프로페셔널(비즈니스·크리에이터) 계정인지 확인해 주세요.')
  const username = info.username ?? ''
  return {
    handle: username ? `@${username}` : info.user_id,
    profileUrl: username ? `https://www.instagram.com/${username}/` : '',
    externalId: info.user_id, // 업로드(/<IG_ID>/media)에 쓰는 프로페셔널 계정 ID
    accessToken: l.access_token,
    refreshToken: null,
    expiresAt: new Date(Date.now() + l.expires_in * 1000).toISOString(),
  }
}

async function exchangeGoogle(c: { id: string; secret: string }, code: string, redirect: string): Promise<Connected> {
  const t = await readJson<{ access_token: string; refresh_token?: string; scope?: string }>(
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: redirect }),
    }),
    '구글 허용 확인',
  )
  // 구글 허용 화면은 권한을 하나씩 끌 수 있다
  if (t.scope && !t.scope.includes('youtube.upload')) throw new Error('동영상 업로드 권한을 허용하지 않았어요. 다시 연결하면서 "YouTube 동영상 관리" 권한에 체크해 주세요.')
  if (!t.refresh_token) throw new Error('구글이 갱신 토큰을 주지 않았어요. 다시 연결해 주세요.')

  const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${t.access_token}` } })
  const ch = await readJson<{ items?: { id: string; snippet: { title: string; customUrl?: string } }[] }>(r, '유튜브 채널 확인')
  const item = ch.items?.[0]
  if (!item) throw new Error('이 구글 계정에는 유튜브 채널이 없어요. 채널이 있는 계정(또는 브랜드 계정)을 골라 주세요.')
  const custom = item.snippet.customUrl
  return {
    handle: item.snippet.title,
    profileUrl: custom ? `https://www.youtube.com/${custom.startsWith('@') ? custom : `@${custom}`}` : `https://www.youtube.com/channel/${item.id}`,
    externalId: item.id,
    accessToken: null, // 1시간짜리라 저장하지 않는다. 올릴 때마다 refresh_token 으로 받는다
    refreshToken: t.refresh_token,
    expiresAt: null,
  }
}

/** 매장 채널에 연결 결과를 적는다(없으면 만든다) */
export async function saveConnection(state: ConnectState, c: Connected) {
  const row = {
    store_id: state.storeId,
    platform: state.platform,
    handle: c.handle,
    profile_url: c.profileUrl,
    status: 'connected',
    external_id: c.externalId,
    access_token: c.accessToken,
    refresh_token: c.refreshToken,
    token_expires_at: c.expiresAt,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db().from('store_channels').upsert(row, { onConflict: 'store_id,platform' })
  if (error) throw new Error(`연결 결과를 저장하지 못했어요: ${error.message}`)
}
