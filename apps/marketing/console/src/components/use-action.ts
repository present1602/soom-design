'use client'

import { useCallback, useState, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'

type R = { ok: true } | { ok: false; error: string }

/* 서버 액션을 부르고 결과를 화면에 남긴다.
   - { ok: false } → error 에 문구
   - 요청이 서버에 닿지 못하거나 서버가 예외로 죽으면 promise 가 거절된다 → 그것도 error 로 잡아
     화면 전체가 에러 화면으로 바뀌지 않게 한다. redirect()·notFound() 는 Next 에 넘긴다. */
export function useAction() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(<T extends R>(fn: () => Promise<T>, onOk?: (r: Extract<T, { ok: true }>) => void) => {
    setError(null)
    start(async () => {
      try {
        const r = await fn()
        if (!r.ok) setError(r.error)
        else onOk?.(r as Extract<T, { ok: true }>)
      } catch (e) {
        unstable_rethrow(e)
        setError(e instanceof Error && e.message ? e.message : '서버와 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      }
    })
  }, [])
  return { pending, error, setError, run }
}
