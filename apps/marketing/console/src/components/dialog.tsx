'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './ui'

/** 가운데 뜨는 창. Esc · 바깥 누르면 닫힌다. 저장 실패 문구는 이 안에 그린다(뒤 페이지에 그리면 안 보인다). */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  // 부모가 onClose 를 매 렌더마다 새로 만들어도 아래 effect 가 다시 돌지 않게 ref 로 둔다
  // (다시 돌면 타이핑할 때마다 포커스가 첫 칸·닫기 버튼으로 튄다)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    // 열릴 때 한 번만: 첫 입력칸, 없으면 본문·아래쪽 버튼 (머리의 닫기 버튼은 건너뛴다)
    const el = box.current
    const first = el?.querySelector<HTMLElement>('input:not([readonly]):not([disabled]), textarea, select') ?? el?.querySelector<HTMLElement>('button:not([aria-label="닫기"])')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,14,22,.45)] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" className={cx('grid max-h-[calc(100vh-32px)] w-full gap-4 overflow-y-auto rounded-2xl bg-card p-[22px] shadow-2xl', wide ? 'max-w-[760px]' : 'max-w-[540px]')}>
        <div className="flex items-center gap-2.5">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-md px-2 py-1 text-ink-soft hover:bg-soft" aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
