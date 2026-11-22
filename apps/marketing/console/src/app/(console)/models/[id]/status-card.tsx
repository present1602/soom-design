'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MODEL_STATUS_LABEL, MODEL_STATUS_TONE as STATUS_TONE, type ModelStatus } from '@marketing/core/types'
import { setModelStatusAction } from '@/actions/models'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine, Pill } from '@/components/ui'
import { useAction } from '@/components/use-action'


const ABOUT: Record<ModelStatus, string> = {
  draft: '아직 콘텐츠 생성에서 고를 수 없어요. 각도 세트·목소리를 다듬은 뒤 공개해 주세요.',
  published: '콘텐츠 생성에서 고를 수 있어요.',
  hidden: '새 콘텐츠에서 고를 수 없어요. 이 모델로 이미 만든 콘텐츠는 그대로예요.',
}

/** 대기 → 공개, 공개 → 숨김, 숨김 → 공개. 바꾸기는 슈퍼어드민만 */
const NEXT: Record<ModelStatus, { to: ModelStatus; label: string; confirm?: string; tone: 'primary' | 'danger' | 'default' }> = {
  draft: { to: 'published', label: '공개하기', tone: 'primary' },
  published: { to: 'hidden', label: '숨기기', confirm: '숨기면 새 콘텐츠에서 고를 수 없어요. 이미 만든 콘텐츠는 그대로예요.', tone: 'danger' },
  hidden: { to: 'published', label: '다시 공개', tone: 'default' },
}

export function StatusCard({ modelId, status, canChange, used }: { modelId: string; status: ModelStatus; canChange: boolean; used: number }) {
  const router = useRouter()
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const act = useAction()
  const next = NEXT[status]
  const go = () => act.run(() => setModelStatusAction(modelId, next.to), () => { setAsking(false); toast(`${MODEL_STATUS_LABEL[next.to]} 상태로 바꿨어요`); router.refresh() })
  return (
    <Card className="grid gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold">상태</h2>
        <Pill tone={STATUS_TONE[status]} dot>{MODEL_STATUS_LABEL[status]}</Pill>
        {canChange && !asking && (
          <Button size="sm" tone={next.tone} className="ml-auto" disabled={act.pending} onClick={() => (next.confirm ? setAsking(true) : go())}>
            {act.pending ? '바꾸는 중…' : next.label}
          </Button>
        )}
      </div>
      <p className="text-[12.5px] text-ink-soft">{ABOUT[status]}{status === 'hidden' && used > 0 ? ` (이 모델로 만든 콘텐츠 ${used}편)` : ''}</p>
      {asking && (
        <div className="grid gap-2 rounded-lg bg-soft p-2.5">
          <p className="text-[12.5px]">{next.confirm}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" tone="ghost" onClick={() => { setAsking(false); act.setError(null) }}>취소</Button>
            <Button size="sm" tone="danger" disabled={act.pending} onClick={go}>{act.pending ? '바꾸는 중…' : '숨기기'}</Button>
          </div>
        </div>
      )}
      {!canChange && <p className="text-[12px] text-ink-soft">상태는 슈퍼어드민이 바꿔요.</p>}
      <ErrorLine error={act.error} />
    </Card>
  )
}
