'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { VOICE_GENDERS } from '@marketing/core/voice'
import { archiveVoiceAction, renameVoiceAction } from '@/actions/voices'
import { useToast } from '@/components/toast'
import { Button, Card, CardHead, ErrorLine, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'
import { VoiceDesigner, type LibraryVoiceView } from '@/components/voice-designer'

export function VoiceLibrary({ voices, canArchive }: { voices: LibraryVoiceView[]; canArchive: boolean }) {
  const router = useRouter()
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHead title="새 목소리 만들기" sub="설명을 고르면 후보 4개를 만들어요" />
        <VoiceDesigner onSaved={() => router.refresh()} />
      </Card>
      <div className="grid gap-4">
        {VOICE_GENDERS.map((g) => {
          const list = voices.filter((v) => v.gender === g.id)
          return (
            <Card key={g.id}>
              <CardHead title={`${g.label} 목소리`} sub={`${list.length}개`} />
              {!list.length && <p className="text-[12.5px] text-ink-soft">아직 없어요. 왼쪽에서 만들어 보관해 주세요.</p>}
              <div className="grid gap-2">
                {list.map((v) => <Row key={v.id} v={v} canArchive={canArchive} />)}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Row({ v, canArchive }: { v: LibraryVoiceView; canArchive: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [alias, setAlias] = useState(v.alias)
  const act = useAction()
  return (
    <div className="grid gap-1.5 rounded-xl border border-line p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <input aria-label="별칭" className={`${inputCls} min-w-0 flex-1`} value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={30} autoFocus />
        ) : (
          <b className="text-[13.5px]">{v.alias}</b>
        )}
        <div className="ml-auto flex gap-1.5">
          {editing ? (
            <>
              <Button size="sm" tone="ghost" onClick={() => { setEditing(false); setAlias(v.alias); act.setError(null) }}>취소</Button>
              <Button size="sm" tone="primary" disabled={act.pending} onClick={() => act.run(() => renameVoiceAction(v.id, alias), () => { setEditing(false); toast('별칭을 바꿨어요'); router.refresh() })}>저장</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setEditing(true)}>별칭 바꾸기</Button>
              {canArchive && (
                <Button size="sm" tone="ghost" disabled={act.pending} onClick={() => confirm(`"${v.alias}" 목소리를 보관함에서 내릴까요? 이미 이 목소리를 쓰는 모델은 그대로예요.`) && act.run(() => archiveVoiceAction(v.id), () => { toast('보관함에서 내렸어요'); router.refresh() })}>
                  내리기
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <span className="text-[12px] text-ink-soft">{v.description}</span>
      {v.url && <audio src={v.url} controls preload="none" className="h-9 w-full" />}
      <ErrorLine error={act.error} />
    </div>
  )
}
