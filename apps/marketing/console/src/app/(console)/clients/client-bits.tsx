'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClientAction } from '@/actions/clients'
import { Dialog } from '@/components/dialog'
import { Button, ErrorLine, Field, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

/** 행 아무 곳이나 누르면 매장 상세로. 안의 링크·버튼은 그대로 동작한다. */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <tr
      className="cursor-pointer hover:[&>td:not([rowspan])]:bg-soft"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return
        router.push(href)
      }}
    >
      {children}
    </tr>
  )
}

export function ClientSearch({ q, mode }: { q: string; mode: string }) {
  const router = useRouter()
  const [v, setV] = useState(q)
  const go = (next: { q?: string; mode?: string }) => {
    const sp = new URLSearchParams()
    const nq = next.q ?? v
    const nm = next.mode ?? mode
    if (nq) sp.set('q', nq)
    if (nm !== 'client') sp.set('mode', nm)
    router.push(`/clients${sp.size ? `?${sp}` : ''}`)
  }
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <form
        className="min-w-[200px] flex-1"
        onSubmit={(e) => {
          e.preventDefault()
          go({ q: v.trim() })
        }}
      >
        <input className={inputCls} value={v} onChange={(e) => setV(e.target.value)} placeholder="고객사명, 코드, 대표자, 연락처, 매장명 검색 후 Enter" aria-label="고객사 검색" />
      </form>
      <div className="inline-flex rounded-lg bg-soft p-[3px]" role="group" aria-label="페이징 기준">
        {[
          ['client', '고객사 10곳씩'],
          ['row', '10행씩 (묶음 유지)'],
        ].map(([m, l]) => (
          <button key={m} type="button" onClick={() => go({ mode: m })} className={cx('rounded-md px-2.5 py-1 text-[12.5px]', mode === m ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function NewClientButton({ managers }: { managers: { id: string; nickname: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', rep: '', phone: '', email: '', storeName: '본점', kind: 'store' as 'store' | 'brand', managerId: managers[0]?.id ?? '' })
  const { pending, error, setError, run } = useAction()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const close = () => {
    setOpen(false)
    setError(null)
  }
  return (
    <>
      <Button tone="primary" onClick={() => setOpen(true)}>
        고객사 등록
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="고객사 등록"
        footer={
          <>
            <Button onClick={close}>취소</Button>
            <Button tone="primary" disabled={pending} onClick={() => run(() => createClientAction(f), (r) => router.push(`/stores/${r.storeId}/channels?new=1`))}>
              {pending ? '등록 중…' : '등록'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5">
          <p className="text-[12.5px] text-ink-soft">고유코드(CL-0000)는 저장할 때 자동으로 붙어요.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="고객사명" htmlFor="nc-name"><input id="nc-name" className={inputCls} value={f.name} onChange={set('name')} placeholder="예: 바다횟집" /></Field>
            <Field label="대표자" htmlFor="nc-rep"><input id="nc-rep" className={inputCls} value={f.rep} onChange={set('rep')} /></Field>
            <Field label="연락처" htmlFor="nc-phone"><input id="nc-phone" className={inputCls} value={f.phone} onChange={set('phone')} placeholder="010-0000-0000" inputMode="tel" /></Field>
            <Field label="이메일 (선택)" htmlFor="nc-email"><input id="nc-email" className={inputCls} value={f.email} onChange={set('email')} type="email" /></Field>
            <Field label="첫 매장·브랜드 이름" htmlFor="nc-store"><input id="nc-store" className={inputCls} value={f.storeName} onChange={set('storeName')} /></Field>
            <Field label="구분" htmlFor="nc-kind">
              <select id="nc-kind" className={inputCls} value={f.kind} onChange={set('kind')}>
                <option value="store">매장</option>
                <option value="brand">브랜드</option>
              </select>
            </Field>
            <Field label="콘텐츠 담당자" htmlFor="nc-mgr" hint={managers.length ? undefined : '담당자 관리에서 사람을 먼저 추가해 주세요.'}>
              <select id="nc-mgr" className={inputCls} value={f.managerId} onChange={set('managerId')}>
                <option value="">나중에 정하기</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.nickname}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[12.5px] text-ink-soft">매장이 여러 개면 등록한 뒤 매장 정보 탭에서 추가해요.</p>
          <ErrorLine error={error} />
        </div>
      </Dialog>
    </>
  )
}

