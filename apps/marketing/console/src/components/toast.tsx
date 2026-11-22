'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* 화면 아래 가운데에 잠깐 뜨는 알림. 기본은 성공(어두운색, 2.4초).
   tone='bad' 는 AI 크레딧 부족처럼 놓치면 안 되는 실패(빨강, 7초) — 이때도 자세한 내용은 그 자리(ErrorLine)에 남긴다. */
type Tone = 'ok' | 'bad'
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; tone: Tone } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string, tone: Tone = 'ok') => {
    setMsg({ text, tone })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), tone === 'bad' ? 7000 : 2400)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg &&
        createPortal(
          <div
            role={msg.tone === 'bad' ? 'alert' : 'status'}
            className={`fixed bottom-6 left-1/2 z-[60] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] text-white shadow-lg ${msg.tone === 'bad' ? 'bg-bad' : 'bg-ink'}`}
          >
            {msg.text}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
