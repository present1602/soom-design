import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
// 새 키(sb_publishable_… / sb_secret_…)를 먼저 읽고, 없으면 예전 이름(anon / service_role)을 읽는다
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export const configured = Boolean(url && anon && service)

export function configError() {
  return 'NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY · SUPABASE_SECRET_KEY 가 없어요. console/.env.local 을 확인해 주세요(.env.example 참고).'
}

/* 로그인 세션용 (anon 키 + 쿠키). 데이터는 이걸로 읽지 않는다. */
export async function authClient() {
  if (!configured) throw new Error(configError())
  const store = await cookies()
  return createServerClient(url!, anon!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          /* 서버 컴포넌트에서는 쿠키를 쓸 수 없다. proxy 가 갱신을 맡는다. */
        }
      },
    },
  })
}

/* 데이터용 (service_role). RLS 를 우회하므로 서버에서만 쓴다 — 권한은 staff.ts 에서 먼저 확인한다. */
const make = () => createAdminClient(url!, service!, { auth: { persistSession: false, autoRefreshToken: false } })
let admin: ReturnType<typeof make> | null = null
export function db() {
  if (!configured) throw new Error(configError())
  admin ??= make()
  return admin
}
