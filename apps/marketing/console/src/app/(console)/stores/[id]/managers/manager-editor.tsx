'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addStoreManagerAction, removeStoreManagerAction } from '@/actions/clients'
import { useToast } from '@/components/toast'
import { Button, Card, CardHead, ErrorLine, Field, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

type M = { id: string; nickname: string; email: string }

export function ManagerEditor({ storeId, current, options }: { storeId: string; current: (M & { stores: number })[]; options: M[] }) {
  const router = useRouter()
  const toast = useToast()
  const [picked, setPick] = useState('')
  // 추가한 사람은 목록에서 빠지므로, 고른 값이 없어지면 첫 사람으로 돌아간다
  const pick = options.some((o) => o.id === picked) ? picked : (options[0]?.id ?? '')
  const add = useAction()
  const del = useAction()
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHead title="이 매장의 콘텐츠 담당자" sub={`${current.length}명`} />
        <ul className="grid">
          {current.map((m) => (
            <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <b className="block font-medium">{m.nickname}</b>
                <span className="text-[12.5px] text-ink-soft">{m.email} · 담당 매장 {m.stores}개</span>
              </div>
              <Button
                size="sm"
                tone="danger"
                disabled={del.pending || current.length <= 1}
                title={current.length <= 1 ? '담당자는 최소 한 명이어야 해요' : undefined}
                onClick={() => del.run(() => removeStoreManagerAction(storeId, m.id), () => { toast(`${m.nickname}님을 담당자에서 뺐어요`); router.refresh() })}
              >
                제외
              </Button>
            </li>
          ))}
          {!current.length && <li className="py-2 text-bad">담당자가 없어요. 오른쪽에서 추가해 주세요.</li>}
        </ul>
        <ErrorLine error={del.error} />
      </Card>
      <Card className="grid gap-3.5">
        <h2 className="text-[16px] font-bold">담당자 추가</h2>
        {options.length ? (
          <Field label="콘텐츠 관리자" htmlFor="mg-add">
            <select id="mg-add" className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
              {options.map((m) => <option key={m.id} value={m.id}>{m.nickname} ({m.email})</option>)}
            </select>
          </Field>
        ) : (
          <p className="text-[13px] text-ink-soft">
            더 넣을 수 있는 콘텐츠 관리자가 없어요. <Link href="/managers" className="text-accent">담당자 관리</Link>에서 사람을 먼저 초대하세요.
          </p>
        )}
        <ErrorLine error={add.error} />
        <Button tone="primary" disabled={!pick || add.pending} onClick={() => add.run(() => addStoreManagerAction(storeId, pick), () => { toast('담당자를 추가했어요'); router.refresh() })}>
          {add.pending ? '추가 중…' : '추가'}
        </Button>
        <p className="text-[12.5px] text-ink-soft">담당자는 매장 단위로 정해요. 담당자는 자기 매장만 보고, 그 매장의 콘텐츠를 만들고 올릴 수 있어요.</p>
      </Card>
    </div>
  )
}
