'use client'

import Link from 'next/link'
import { useState } from 'react'
import { eventPeriod, type EventSnapshot, type StoreEvent } from '@marketing/core/events'
import { EventDialog, EventSummary } from '@/components/event-dialog'
import { Button, cx, Note, Pill } from '@/components/ui'

/** 생성 화면에 보여 줄 매장 정보 (AI 에 함께 넘어가는 것들) */
export type StoreBriefView = {
  id: string
  intro: string
  address: string
  hours: string
  phone: string
  homepageUrl: string
  /** 생성할 때 참고할 홈페이지 자료 */
  source: { kind: 'api' | 'homepage' | 'none'; ok: boolean; note: string }
}

/** 매장 정보 요약 + 이벤트 고르기 */
export function StoreBriefSection({
  sec,
  h3,
  store,
  events,
  onEvents,
  eventId,
  onPick,
  locked,
  lockedEvent,
}: {
  sec: string
  h3: string
  store: StoreBriefView
  events: StoreEvent[] | null
  onEvents: (e: StoreEvent[]) => void
  eventId: string | null
  onPick: (id: string | null) => void
  locked: boolean
  lockedEvent: EventSnapshot | null
}) {
  const [adding, setAdding] = useState(false)
  const [more, setMore] = useState(false)
  const intro = store.intro.trim()
  const long = intro.length > 140
  return (
    <section className={sec}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={h3}>매장 정보 · 이벤트</h3>
        <span className="text-[12.5px] text-ink-soft">AI에 함께 넘어가요</span>
        <Link href={`/stores/${store.id}/info`} className="ml-auto text-[12.5px] text-accent">매장 정보 고치기</Link>
      </div>

      <div className="grid gap-2 rounded-xl bg-soft p-3.5 text-[13px]">
        {intro ? (
          <p className="whitespace-pre-line">
            {long && !more ? `${intro.slice(0, 140)}…` : intro}
            {long && <button type="button" className="ml-1 text-ink-soft underline" onClick={() => setMore(!more)}>{more ? '접기' : '더 보기'}</button>}
          </p>
        ) : (
          <p className="text-warn">소개 · 브랜드 톤이 비어 있어요. 강점·타깃·말투를 적어 두면 결과가 매장에 더 맞게 나와요.</p>
        )}
        <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-[12.5px] [&>dt]:text-ink-soft">
          {store.address && <><dt>주소</dt><dd>{store.address}</dd></>}
          {store.hours && <><dt>영업시간</dt><dd>{store.hours}</dd></>}
          <dt>홈페이지</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {store.homepageUrl && <a href={store.homepageUrl} target="_blank" rel="noreferrer" className="max-w-full truncate text-accent">{store.homepageUrl.replace(/^https?:\/\//, '')}</a>}
            {store.source.kind === 'api' && <Pill tone={store.source.ok ? 'info' : 'warn'}>자료 API</Pill>}
            {store.source.kind === 'homepage' && <Pill tone={store.source.ok ? 'info' : 'warn'}>페이지 글 읽기</Pill>}
            <span className="text-ink-soft">{store.source.note}</span>
          </dd>
        </dl>
      </div>

      {locked ? (
        lockedEvent ? (
          <div className="rounded-xl border border-line p-3 text-[13px]">
            <b>이벤트: {lockedEvent.title}</b>
            <span className="block text-ink-soft">{[eventPeriod(lockedEvent), lockedEvent.offer].filter(Boolean).join(' · ')}</span>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-soft">이벤트 없이 만들었어요.</p>
        )
      ) : events === null ? (
        <Note tone="warn">이벤트를 쓰려면 Supabase SQL Editor에서 supabase/migrations/0005_store_web_events.sql 을 돌려 주세요.</Note>
      ) : (
        <div className="grid gap-2">
          <div className="grid gap-1.5" role="radiogroup" aria-label="이벤트">
            <Choice on={eventId === null} onClick={() => onPick(null)}>
              <span className="text-[13.5px]">이벤트 없이 <span className="text-ink-soft">— 매장·상품 홍보</span></span>
            </Choice>
            {events.map((e) => (
              <Choice key={e.id} on={eventId === e.id} onClick={() => onPick(e.id)}>
                <EventSummary e={e} />
              </Choice>
            ))}
          </div>
          <Button size="sm" className="justify-self-start" onClick={() => setAdding(true)}>+ 새 이벤트</Button>
        </div>
      )}
      {adding && (
        <EventDialog
          storeId={store.id}
          event={null}
          open
          onClose={() => setAdding(false)}
          onSaved={(e) => {
            setAdding(false)
            onEvents([e, ...(events ?? [])])
            onPick(e.id)
          }}
        />
      )}
    </section>
  )
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cx('flex items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2 text-left', on ? 'border-accent bg-accent-weak' : 'border-line bg-card hover:border-accent')}>
      <span className={cx('grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]', on ? 'border-accent' : 'border-line')}>{on && <span className="size-2 rounded-full bg-accent" />}</span>
      {children}
    </button>
  )
}
