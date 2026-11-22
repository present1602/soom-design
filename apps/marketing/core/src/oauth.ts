/* 채널 연결(OAuth) 공용 — 콘솔(연결 링크·콜백)과 워커(토큰 갱신·업로드)가 같이 쓴다.
   비밀번호는 받지 않는다. 고객이 플랫폼 화면에서 직접 로그인해 허용하면 토큰만 store_channels 에 남는다.

   인스타그램: Instagram API with Instagram Login (페이스북 페이지 없이 프로페셔널 계정만 있으면 된다)
     https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
     - client_id 는 Meta 앱 ID 가 아니라 "Instagram 앱 ID" (앱 대시보드 > Instagram > API setup with Instagram login)
     - 단기 토큰(1시간) → 장기 토큰(60일). 발급 24시간 뒤부터 갱신할 수 있고, 만료되면 다시 허용받아야 한다
   유튜브: Google OAuth (youtube.upload + 채널 이름 확인용 youtube.readonly). refresh_token 을 저장한다
     https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps */

export const IG_GRAPH = 'https://graph.instagram.com/v27.0'
export const IG_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish']
export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly']

/** 연결 링크 유효 기간 */
export const CONNECT_LINK_DAYS = 7

/** 토큰이 끊겼거나 허용이 취소됐다 — 다시 연결받아야 한다(다시 시도해도 같다) */
export class ChannelAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChannelAuthError'
  }
}

type GraphError = { error?: { message?: string; code?: number; type?: string } | string; error_description?: string; error_message?: string }

/** 응답을 JSON 으로 읽고, 실패면 플랫폼이 준 문구를 붙여 던진다. 토큰 문제면 ChannelAuthError */
export async function readJson<T>(res: Response, what: string): Promise<T> {
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    /* JSON 아님 */
  }
  if (!res.ok) {
    const b = (body ?? {}) as GraphError
    const e = typeof b.error === 'object' ? b.error : null
    const msg = e?.message ?? b.error_description ?? b.error_message ?? (typeof b.error === 'string' ? b.error : '')
    // Meta: code 190 = 토큰 만료·취소. Google: invalid_grant = refresh_token 취소·만료
    const full = `${what}에 실패했어요${msg ? `: ${msg}` : ` (${res.status})`}`
    // 우리 앱 키가 틀린 것 — 고객이 다시 허용해도 해결되지 않는다
    if (b.error === 'invalid_client') throw new Error(`${full} — 앱 키(클라이언트 ID·시크릿)를 확인해 주세요.`)
    const auth = e?.code === 190 || b.error === 'invalid_grant' || res.status === 401
    if (auth) throw new ChannelAuthError(`${full} — 연결이 끊겼어요. 채널 관리에서 연결 링크를 다시 보내 허용받아 주세요.`)
    throw new Error(full)
  }
  return body as T
}

/** 인스타그램 장기 토큰 갱신 (새 60일). 발급 24시간 안이면 실패한다 */
export async function refreshInstagramToken(token: string) {
  const u = new URL('https://graph.instagram.com/refresh_access_token')
  u.searchParams.set('grant_type', 'ig_refresh_token')
  u.searchParams.set('access_token', token)
  const r = await readJson<{ access_token: string; expires_in: number }>(await fetch(u), '인스타그램 토큰 갱신')
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() }
}

/** 유튜브: refresh_token 으로 1시간짜리 access_token 받기 */
export async function googleAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const r = await readJson<{ access_token: string }>(
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    }),
    '유튜브 토큰 갱신',
  )
  return r.access_token
}

/** 링크에 들어가는 내용. 서명은 콘솔에서만 한다(비밀키가 콘솔에 있다) */
export type ConnectState = { storeId: string; platform: 'instagram' | 'youtube'; exp: number }

/** 이 플랫폼은 연결 링크로 허용받는가 (스레드는 아직) */
export function canConnect(platform: string): platform is ConnectState['platform'] {
  return platform === 'instagram' || platform === 'youtube'
}
