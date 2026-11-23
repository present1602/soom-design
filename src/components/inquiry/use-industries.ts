'use client'

import { useEffect, useState } from 'react'
import { getIndustryOptions } from '@/app/inquiry-actions'
import { DEFAULT_INDUSTRIES } from '@/lib/industries'

/* 의뢰·마케팅 문의 폼의 업종 선택지(어드민 설정 > 업종 목록). 폼을 열 때 한 번 받아 오고,
   실패하면 기본 목록을 쓴다 — 선택지가 비어 폼을 못 보내는 일이 없게 */
let cached: Promise<string[]> | null = null

export function useIndustries(): string[] {
  const [list, setList] = useState<string[]>([...DEFAULT_INDUSTRIES])
  useEffect(() => {
    let alive = true
    cached ??= getIndustryOptions().catch(() => {
      cached = null
      return [...DEFAULT_INDUSTRIES]
    })
    cached.then((l) => alive && l.length && setList(l))
    return () => {
      alive = false
    }
  }, [])
  return list
}
