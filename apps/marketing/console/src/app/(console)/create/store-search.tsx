'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { inputCls } from '@/components/ui'

export function StoreSearch({ q }: { q: string }) {
  const router = useRouter()
  const [v, setV] = useState(q)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        router.push(v.trim() ? `/create?q=${encodeURIComponent(v.trim())}` : '/create')
      }}
    >
      <input className={inputCls} value={v} onChange={(e) => setV(e.target.value)} placeholder="고객사명이나 매장명으로 찾기 (Enter)" aria-label="매장 찾기" />
    </form>
  )
}
