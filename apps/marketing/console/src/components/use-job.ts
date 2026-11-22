'use client'

import { useEffect, useState } from 'react'

export type JobView = { status: 'queued' | 'running' | 'done' | 'failed'; error: string | null; retrying: boolean; files: { path: string; url: string | null }[]; mock: boolean }

/** 워커 작업이 끝날 때까지 2초마다 묻는다. jobId 가 null 이면 쉰다. */
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobView | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!jobId) return
    let stop = false
    let timer: number | undefined
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? '작업 상태를 확인하지 못했어요')
        if (stop) return
        setJob(j as JobView)
        setError(null)
        if (j.status === 'done' || j.status === 'failed') return
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : '작업 상태를 확인하지 못했어요')
      }
      if (!stop) timer = window.setTimeout(tick, 2000)
    }
    tick()
    return () => {
      stop = true
      window.clearTimeout(timer)
      setJob(null)
    }
  }, [jobId])
  return { job, error }
}
