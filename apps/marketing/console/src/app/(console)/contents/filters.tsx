'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PLATFORM_INFO, PLATFORMS } from '@marketing/core/channels'
import { cx, inputCls } from '@/components/ui'

type F = { q: string; client: string; type: string; ch: string; scope: 'published' | 'all' }

export function ContentFilters({ value, clients }: { value: F; clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [q, setQ] = useState(value.q)
  const go = (next: Partial<F>) => {
    const v = { ...value, q, ...next }
    const sp = new URLSearchParams()
    if (v.q) sp.set('q', v.q)
    if (v.client) sp.set('client', v.client)
    if (v.type) sp.set('type', v.type)
    if (v.ch) sp.set('ch', v.ch)
    if (v.scope === 'all') sp.set('scope', 'all')
    router.push(`/contents${sp.size ? `?${sp}` : ''}`)
  }
  const sel = cx(inputCls, 'w-auto min-w-[130px]')
  return (
    <div className="mb-1.5 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-[200px] flex-1" onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() }) }}>
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 검색 후 Enter" aria-label="제목 검색" />
        </form>
        <select className={sel} value={value.client} onChange={(e) => go({ client: e.target.value })} aria-label="고객사">
          <option value="">모든 고객사</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={sel} value={value.type} onChange={(e) => go({ type: e.target.value })} aria-label="유형">
          <option value="">모든 유형</option>
          <option value="short">AI 숏폼</option>
          <option value="banner">AI 배너</option>
        </select>
        <select className={sel} value={value.ch} onChange={(e) => go({ ch: e.target.value })} aria-label="채널">
          <option value="">모든 채널</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_INFO[p].name}</option>)}
        </select>
      </div>
      <div className="flex gap-1 text-[12.5px]">
        {([['published', '올라간 것'], ['all', '만든 것 전체']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => go({ scope: v })} className={cx('rounded-md px-2.5 py-1', value.scope === v ? 'bg-ink text-white' : 'text-ink-soft hover:bg-soft')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
