import { NextResponse, type NextRequest } from 'next/server'
import { authClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  await (await authClient()).auth.signOut()
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
}
