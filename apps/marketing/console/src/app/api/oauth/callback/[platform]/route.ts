import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { baseUrl, exchange, readState, saveConnection } from '@/lib/oauth'

/* 플랫폼 허용 화면에서 돌아오는 곳. code → 토큰으로 바꿔 매장 채널에 저장하고 연결 링크 화면으로 결과를 보여 준다.
   이 주소(…/api/oauth/callback/instagram · …/youtube)를 각 플랫폼 앱 설정의 리디렉션 주소에 등록해야 한다. */
export async function GET(req: NextRequest, ctx: RouteContext<'/api/oauth/callback/[platform]'>) {
  const { platform } = await ctx.params
  const sp = req.nextUrl.searchParams
  const t = sp.get('state') ?? ''
  const base = await baseUrl()
  const back = (q: string) => NextResponse.redirect(`${base}/connect/${encodeURIComponent(t)}?${q}`)

  const r = readState(t)
  if (!r.ok) return back(`error=${encodeURIComponent(r.error)}`)
  if (r.state.platform !== platform) return back(`error=${encodeURIComponent('링크와 돌아온 플랫폼이 달라요. 링크를 다시 열어 주세요.')}`)

  // 고객이 "취소"·"허용 안 함"을 누른 경우
  const denied = sp.get('error')
  if (denied) {
    const why = denied === 'access_denied' ? '허용하지 않고 돌아왔어요. 다시 시도하려면 아래 버튼을 눌러 주세요.' : `허용하지 못했어요: ${sp.get('error_description') ?? sp.get('error_reason') ?? denied}`
    return back(`error=${encodeURIComponent(why)}`)
  }
  const code = sp.get('code')
  if (!code) return back(`error=${encodeURIComponent('허용 코드가 없어요. 다시 시도해 주세요.')}`)

  try {
    const c = await exchange(r.state.platform, code)
    await saveConnection(r.state, c)
    revalidatePath('/', 'layout')
    return back(`ok=${encodeURIComponent(c.handle)}`)
  } catch (e) {
    console.error('[oauth]', platform, e)
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`)
  }
}
