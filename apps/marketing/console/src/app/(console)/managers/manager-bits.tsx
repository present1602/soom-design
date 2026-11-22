'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { inviteAdminAction, setAdminActiveAction } from '@/actions/admin'
import { Dialog } from '@/components/dialog'
import { useToast } from '@/components/toast'
import { Button, ErrorLine, Field, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

export function InviteButton() {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ email: '', nickname: '', role: 'manager' as 'manager' | 'super', password: '' })
  const { pending, error, setError, run } = useAction()
  const close = () => {
    setOpen(false)
    setError(null)
  }
  return (
    <>
      <Button tone="primary" onClick={() => setOpen(true)}>담당자 추가</Button>
      <Dialog
        open={open}
        onClose={close}
        title="담당자 추가"
        footer={
          <>
            <Button onClick={close}>취소</Button>
            <Button
              tone="primary"
              disabled={pending}
              onClick={() =>
                run(() => inviteAdminAction(f), () => {
                  toast(`${f.nickname}님을 추가했어요`)
                  setF({ email: '', nickname: '', role: 'manager', password: '' })
                  setOpen(false)
                  router.refresh()
                })
              }
            >
              {pending ? '추가 중…' : '추가'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="닉네임" htmlFor="ad-n" hint="콘텐츠 담당자로 보이는 이름"><input id="ad-n" className={inputCls} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} placeholder="예: 지은" /></Field>
          <Field label="이메일" htmlFor="ad-e"><input id="ad-e" type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="권한" htmlFor="ad-r">
            <select id="ad-r" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'manager' | 'super' })}>
              <option value="manager">콘텐츠 관리자 (할당된 매장만)</option>
              <option value="super">슈퍼어드민 (전체)</option>
            </select>
          </Field>
          <Field label="임시 비밀번호 (선택)" htmlFor="ad-p" hint="비우면 구글 로그인으로만 들어와요">
            <input id="ad-p" type="text" autoComplete="off" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="8자 이상" />
          </Field>
        </div>
        <ErrorLine error={error} />
      </Dialog>
    </>
  )
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const { pending, error, run } = useAction()
  return (
    <div className="grid justify-items-start gap-1">
      <Button size="sm" disabled={pending} onClick={() => run(() => setAdminActiveAction(id, !active), () => router.refresh())}>
        {active ? '사용 중 · 끄기' : '꺼짐 · 켜기'}
      </Button>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  )
}
