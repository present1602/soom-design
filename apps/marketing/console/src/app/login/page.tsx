import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getStaff } from '@/lib/staff'
import { authClient, configError, configured } from '@/lib/supabase'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: '로그인' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  if (!configured) return <Shell><p className="rounded-lg bg-bad-weak px-3 py-2.5 text-[13px] text-bad">{configError()}</p></Shell>
  if (await getStaff()) redirect('/clients')
  // 로그인은 했는데 관리자로 등록되지 않은 계정
  const { data } = await (await authClient()).auth.getUser()
  const denied = data.user?.email ?? null
  return (
    <Shell>
      {denied ? (
        <div className="grid gap-3">
          <p className="rounded-lg bg-warn-weak px-3 py-2.5 text-[13px] text-warn">
            <b>{denied}</b> 계정은 콘솔에 등록되지 않았어요. 슈퍼어드민에게 담당자 관리에서 추가해 달라고 요청해 주세요.
          </p>
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-lg border border-line bg-card py-2 font-medium hover:bg-soft">다른 계정으로 로그인</button>
          </form>
        </div>
      ) : (
        <LoginForm error={typeof sp.error === 'string' ? sp.error : null} />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="grid w-full max-w-[400px] gap-5 rounded-2xl border border-line bg-card p-7">
        <div className="flex items-center gap-2.5 font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-white">M</span>
          <div>
            마케팅 콘솔<small className="block text-[11.5px] font-normal text-ink-soft">직원 전용</small>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
