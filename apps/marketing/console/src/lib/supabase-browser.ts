'use client'

import { createBrowserClient } from '@supabase/ssr'

/* 브라우저용: 로그인과, 서명 받은 주소로 파일을 바로 올릴 때만 쓴다. 데이터는 서버에서 읽는다. */
let client: ReturnType<typeof createBrowserClient> | null = null
export function browserClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!)
  return client
}
