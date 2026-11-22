import { NextResponse, type NextRequest } from 'next/server'
import { authorizeUrl, baseUrl, readState } from '@/lib/oauth'

/* 연결 링크의 "허용하러 가기" 버튼 → 플랫폼 로그인·허용 화면으로 보낸다. 로그인 없이 열린다(고객용). */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? ''
  const back = `${await baseUrl()}/connect/${encodeURIComponent(t)}`
  const r = readState(t)
  if (!r.ok) return NextResponse.redirect(`${back}?error=${encodeURIComponent(r.error)}`)
  try {
    return NextResponse.redirect(await authorizeUrl(r.state, t))
  } catch (e) {
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`)
  }
}
