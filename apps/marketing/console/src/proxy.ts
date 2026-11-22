import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* 요청마다 Supabase 세션 토큰을 갱신한다. 이게 없으면 토큰이 만료될 때 로그아웃된 것처럼 보인다.
   (Next 16 에서 middleware 는 proxy 로 이름이 바뀌었다) */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return response
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|api/health).*)'],
}
