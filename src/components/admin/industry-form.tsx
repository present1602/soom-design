'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { setIndustries } from '@/app/admin/settings/actions'
import { INDUSTRY_MAX, INDUSTRY_NAME_MAX } from '@/lib/industries'

/* 의뢰·문의 폼과 마케팅 문의 폼이 같이 쓰는 업종 목록 — 한 줄에 하나, 적은 순서대로 보인다 */
export function IndustryForm({ industries }: { industries: string[] }) {
  const [text, setText] = useState(industries.join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()
  const count = text.split('\n').map((s) => s.trim()).filter(Boolean).length
  const dirty = text.trim() !== industries.join('\n').trim()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const save = () => {
    setError(null)
    setToast(null)
    start(async () => {
      const r = await setIndustries(text)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setToast('업종 목록을 저장했어요')
      router.refresh()
    }, '업종 목록 저장')
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">업종 목록</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        의뢰·문의 폼과 마케팅 문의 폼의 &lsquo;업종&rsquo; 선택지예요. 한 줄에 하나씩, 적은 순서대로 보여요.
        <br />
        최대 {INDUSTRY_MAX}개, 하나에 {INDUSTRY_NAME_MAX}자까지. 이미 들어온 문의의 업종은 바뀌지 않아요.
      </p>
      <textarea
        id="industries"
        aria-label="업종 목록"
        rows={Math.min(16, Math.max(6, count + 1))}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        className="mt-3 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed focus:border-neutral-900 focus:outline-none"
      />
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-3">
        {toast && <span role="status" className="text-sm text-emerald-700">{toast}</span>}
        <span className="text-xs text-neutral-400 tabular-nums">{count}개</span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
