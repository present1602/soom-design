'use client'

import { useState } from 'react'
import { eventPeriod, eventState, type StoreEvent } from '@marketing/core/events'
import { saveEventAction } from '@/actions/events'
import { Dialog } from './dialog'
import { Button, ErrorLine, Field, inputCls, Pill } from './ui'
import { useAction } from './use-action'

/** 매장 이벤트 추가·수정. 매장 정보 화면과 콘텐츠 생성 화면이 같이 쓴다 */
export function EventDialog({ storeId, event, open, onClose, onSaved }: { storeId: string; event: StoreEvent | null; open: boolean; onClose: () => void; onSaved: (e: StoreEvent) => void }) {
  const [f, setF] = useState(() => ({
    title: event?.title ?? '',
    startsOn: event?.starts_on ?? '',
    endsOn: event?.ends_on ?? '',
    offer: event?.offer ?? '',
    details: event?.details ?? '',
  }))
  const { pending, error, setError, run } = useAction()
  const close = () => {
    setError(null)
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={event ? '이벤트 고치기' : '이벤트 추가'}
      footer={
        <>
          <Button onClick={close}>취소</Button>
          <Button tone="primary" disabled={pending} onClick={() => run(() => saveEventAction(storeId, event?.id ?? null, f), (r) => onSaved(r.event))}>
            {pending ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="이벤트 이름" htmlFor="ev-t"><input id="ev-t" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} placeholder="예: 오픈 1주년 감사 이벤트" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="시작일 (선택)" htmlFor="ev-s"><input id="ev-s" type="date" className={inputCls} value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></Field>
          <Field label="종료일 (선택)" htmlFor="ev-e"><input id="ev-e" type="date" className={inputCls} value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} /></Field>
        </div>
        <Field label="혜택 한 줄 (선택)" htmlFor="ev-o" hint="배너 보조 문구로도 쓰여요."><input id="ev-o" className={inputCls} value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} maxLength={120} placeholder="예: 아메리카노 1+1, 케이크 20% 할인" /></Field>
        <Field label="자세한 내용 (선택)" htmlFor="ev-d" hint="대상·조건·참여 방법·강조할 점. AI 프롬프트에 함께 들어가요.">
          <textarea id="ev-d" rows={4} className={inputCls} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} maxLength={1000} placeholder="예: 평일 오후 2–5시 매장 방문 고객 대상. 인스타 팔로우 인증 시 쿠키 증정." />
        </Field>
        <ErrorLine error={error} />
      </div>
    </Dialog>
  )
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 이벤트 한 줄 요약: 이름 · 상태 · 기간 · 혜택 */
export function EventSummary({ e }: { e: StoreEvent }) {
  const snap = { startsOn: e.starts_on, endsOn: e.ends_on }
  const state = eventState(snap, today())
  const period = eventPeriod(snap)
  return (
    <span className="grid gap-0.5 text-left">
      <span className="flex flex-wrap items-center gap-1.5">
        <b className="text-[14px]">{e.title}</b>
        {state === 'running' && <Pill tone="ok">진행 중</Pill>}
        {state === 'upcoming' && <Pill tone="info">예정</Pill>}
        {state === 'ended' && <Pill>끝남</Pill>}
        {e.archived && <Pill tone="warn">내림</Pill>}
      </span>
      {(period || e.offer) && <span className="text-[12.5px] text-ink-soft">{[period, e.offer].filter(Boolean).join(' · ')}</span>}
    </span>
  )
}
