import { NextResponse, type NextRequest } from 'next/server'
import { authClient } from '@/lib/supabase'

/* 구글 로그인에서 돌아오는 곳. code 를 세션으로 바꾼 뒤 첫 화면으로 보낸다. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const next = req.nextUrl.searchParams.get('next') || '/clients'
  if (code) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url))
  }
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/clients', req.url))
}
