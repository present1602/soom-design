'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { isEmptyPersona, type Persona } from '@marketing/core/persona'
import { updateModelPersonaAction } from '@/actions/models'
import { PersonaFields, fromDraft, toDraft } from '@/components/persona-fields'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine } from '@/components/ui'
import { useAction } from '@/components/use-action'

/** 페르소나 보기 · 고치기. 콘텐츠를 만들 때 표정·포즈·스타일링에 반영된다. */
export function PersonaCard({ modelId, persona }: { modelId: string; persona: Persona | null }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(toDraft(persona))
  const save = useAction()
  const p = persona ?? {}
  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold">캐릭터</h2>
        {!editing && <Button size="sm" className="ml-auto" onClick={() => { setDraft(toDraft(persona)); setEditing(true) }}>{isEmptyPersona(persona) ? '설정하기' : '고치기'}</Button>}
      </div>
      {!editing &&
        (isEmptyPersona(persona) ? (
          <p className="text-[13px] text-ink-soft">직업·MBTI·성격·취미·말투를 정하면 콘텐츠마다 이 인물다운 표정과 분위기로 나와요.</p>
        ) : (
          <div className="grid gap-2 text-[13.5px]">
            {(p.role || p.mbti) && (
              <p>
                <b>{p.role}</b>
                {p.mbti && <span className="ml-1.5 rounded bg-accent-weak px-1.5 py-0.5 text-[12px] font-bold text-accent">{p.mbti}</span>}
              </p>
            )}
            {[...(p.traits ?? []), ...(p.hobbies ?? [])].length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(p.traits ?? []).map((t) => <span key={`t-${t}`} className="rounded-full bg-soft px-2 py-0.5 text-[12px]">{t}</span>)}
                {(p.hobbies ?? []).map((h) => <span key={`h-${h}`} className="rounded-full border border-line px-2 py-0.5 text-[12px] text-ink-soft">#{h}</span>)}
              </div>
            )}
            {p.speech && <p className="text-ink-soft">말투: {p.speech}</p>}
            {p.bio && <p className="whitespace-pre-line text-ink-soft">{p.bio}</p>}
          </div>
        ))}
      {editing && (
        <>
          <PersonaFields value={draft} onChange={setDraft} idPrefix="pc" />
          <ErrorLine error={save.error} />
          <div className="flex justify-end gap-2">
            <Button tone="ghost" onClick={() => { setEditing(false); save.setError(null) }}>취소</Button>
            <Button tone="primary" disabled={save.pending} onClick={() => save.run(() => updateModelPersonaAction(modelId, fromDraft(draft)), () => { setEditing(false); toast('캐릭터를 저장했어요'); router.refresh() })}>
              {save.pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
