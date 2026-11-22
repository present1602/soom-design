'use client'

import { useEffect, useRef } from 'react'
import { aiErrorInfo } from '@marketing/core/ai/errors'
import { useToast } from './toast'

/** 실패 문구. 버튼 바로 옆이나 다이얼로그 안에 둔다 — 눌렀는데 아무 일도 없어 보이면 안 된다.
    AI 업체 에러("[크레딧 부족] …" 처럼 종류가 붙은 문구)면 제목·할 일 링크가 있는 상자로 크게 보여 주고,
    처음 나타날 때 빨간 토스트도 띄운다(작업이 끝나 결과가 바뀌는 순간 다른 곳을 보고 있어도 알 수 있게). */
export function ErrorLine({ error }: { error?: string | null }) {
  const toast = useToast()
  const shown = useRef<string | null>(null)
  const info = aiErrorInfo(error)

  useEffect(() => {
    const i = aiErrorInfo(error)
    if (error && i && shown.current !== error) toast(i.kind === 'billing' ? `${i.title} — 충전한 뒤 다시 시도해 주세요` : i.title, 'bad')
    shown.current = error ?? null
  }, [error, toast])

  if (!error) return null
  if (!info) {
    return (
      <p role="alert" className="rounded-lg bg-bad-weak px-3 py-2 text-[13px] text-bad">
        {error}
      </p>
    )
  }
  return (
    <div role="alert" className="grid gap-1.5 rounded-lg border border-bad/30 bg-bad-weak px-3.5 py-3 text-[13px] text-bad">
      <b className="text-[13.5px]">{info.title}</b>
      <span>{error.replace(/\[[^\]]+\]\s*/, '')}</span>
      {info.action && (
        <a href={info.action.href} target="_blank" rel="noreferrer" className="justify-self-start font-bold underline underline-offset-2">
          {info.action.label} ↗
        </a>
      )}
    </div>
  )
}
