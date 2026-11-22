'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ErrorLine, Field, btn, inputCls } from '@/components/ui'
import { browserClient } from '@/lib/supabase-browser'

export function LoginForm({ error: initial }: { error: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initial)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const { error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(error.message === 'Invalid login credentials' ? '이메일이나 비밀번호가 맞지 않아요.' : error.message)
        return
      }
      router.replace('/clients')
      router.refresh()
    })
  }

  const google = async () => {
    setError(null)
    const { error } = await browserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(`구글 로그인을 시작하지 못했어요: ${error.message}`)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="이메일" htmlFor="email">
        <input id="email" type="email" autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="비밀번호" htmlFor="password">
        <input id="password" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <ErrorLine error={error} />
      <button type="submit" className={btn({ tone: 'primary', size: 'lg' })} disabled={pending}>
        {pending ? '로그인 중…' : '로그인'}
      </button>
      <button type="button" className={btn({ size: 'lg' })} onClick={google}>
        구글 계정으로 로그인
      </button>
    </form>
  )
}
