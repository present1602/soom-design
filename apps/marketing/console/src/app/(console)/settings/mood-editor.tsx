'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addMoodAction, deleteMoodAction, reorderMoodsAction, setMoodActiveAction } from '@/actions/admin'
import { useToast } from '@/components/toast'
import { Button, Card, CardHead, ErrorLine, Field, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

type Mood = { id: string; label: string; active: boolean }

export function MoodEditor({ moods }: { moods: Mood[] }) {
  const router = useRouter()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const act = useAction()
  const add = useAction()
  const done = (msg?: string) => {
    if (msg) toast(msg)
    router.refresh()
  }
  const move = (i: number, d: -1 | 1) => {
    const ids = moods.map((m) => m.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    act.run(() => reorderMoodsAction(ids), () => done())
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHead title="숏폼 분위기" sub={`${moods.filter((m) => m.active).length}개 사용 중`} />
        <ul className="grid">
          {moods.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2.5 first:border-t-0">
              <span className={cx('rounded-full border-[1.5px] px-3.5 py-1 text-[13.5px]', m.active ? 'border-accent bg-accent font-bold text-white' : 'border-line text-ink-soft')}>{m.label}</span>
              <span className="min-w-0 flex-1 text-[12.5px] text-ink-soft">{m.active ? '생성 화면에 보여요' : '숨김'}</span>
              <Button size="sm" tone="ghost" disabled={i === 0 || act.pending} onClick={() => move(i, -1)} aria-label={`${m.label} 위로`}>↑</Button>
              <Button size="sm" tone="ghost" disabled={i === moods.length - 1 || act.pending} onClick={() => move(i, 1)} aria-label={`${m.label} 아래로`}>↓</Button>
              <Button size="sm" disabled={act.pending} onClick={() => act.run(() => setMoodActiveAction(m.id, !m.active), () => done(m.active ? `‘${m.label}’를 숨겼어요` : `‘${m.label}’를 다시 보여요`))}>
                {m.active ? '숨기기' : '보이기'}
              </Button>
              {confirm === m.id ? (
                <>
                  <Button size="sm" tone="danger" disabled={act.pending} onClick={() => act.run(() => deleteMoodAction(m.id), () => { setConfirm(null); done(`‘${m.label}’를 삭제했어요`) })}>정말 삭제</Button>
                  <Button size="sm" tone="ghost" onClick={() => setConfirm(null)}>취소</Button>
                </>
              ) : (
                <Button size="sm" tone="danger" onClick={() => setConfirm(m.id)}>삭제</Button>
              )}
            </li>
          ))}
          {!moods.length && <li className="py-3 text-ink-soft">분위기가 없어요. 오른쪽에서 추가하세요.</li>}
        </ul>
        <ErrorLine error={act.error} />
      </Card>
      <Card className="grid gap-3.5">
        <h2 className="text-[16px] font-bold">분위기 추가</h2>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            add.run(() => addMoodAction(label), () => {
              done(`‘${label.trim()}’를 추가했어요`)
              setLabel('')
            })
          }}
        >
          <Field label="단어" htmlFor="mood-new"><input id="mood-new" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 빈티지한" maxLength={12} /></Field>
          <ErrorLine error={add.error} />
          <Button type="submit" tone="primary" disabled={!label.trim() || add.pending}>{add.pending ? '추가 중…' : '추가'}</Button>
        </form>
        <p className="text-[12.5px] text-ink-soft">숨긴 분위기는 새 콘텐츠에서 고를 수 없지만, 이미 만든 콘텐츠의 기록에는 남아요. 순서는 생성 화면에 보이는 순서예요.</p>
      </Card>
    </div>
  )
}
