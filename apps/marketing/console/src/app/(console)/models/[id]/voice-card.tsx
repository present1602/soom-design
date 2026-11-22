'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { VOICE_ENGINES, VOICE_PRESETS, VOICE_SAMPLE_HINT, type VoiceEngine, type VoiceGender } from '@marketing/core/voice'
import { retryVoiceCloneAction, updateModelVoiceAction } from '@/actions/models'
import { AudioUploader } from '@/components/audio-uploader'
import type { Uploaded } from '@/components/image-uploader'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine, Note, Pill, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'
import { VOICE_TABS, VoiceDesigner, VoiceLibraryPicker, type LibraryVoiceView, type VoiceTab } from '@/components/voice-designer'

export type VoiceState = {
  source: 'preset' | 'upload' | 'library'
  /** preset 이면 기본 목소리 이름, library 면 별칭 */
  preset: string
  libraryId: string | null
  sampleUrl: string | null
  samplePath: string | null
  engine: VoiceEngine
  sampleText: string
  /** upload 일 때: ready = 업체 등록 끝, pending = 등록 중, failed = voice_error */
  status: 'ready' | 'pending' | 'failed' | 'none'
  error: string | null
  mock: boolean
}

export function VoiceCard({ modelId, v, voices: initialVoices, libraryMissing, gender }: { modelId: string; v: VoiceState; voices: LibraryVoiceView[]; libraryMissing: boolean; gender: VoiceGender }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<VoiceTab>(v.source)
  const [voices, setVoices] = useState(initialVoices)
  const [libraryId, setLibraryId] = useState<string | null>(v.libraryId)
  const addVoice = (x: LibraryVoiceView) => setVoices((xs) => (xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [x, ...xs]))
  const source: 'preset' | 'upload' | 'library' = tab === 'design' || tab === 'library' ? 'library' : tab
  const [preset, setPreset] = useState(v.source === 'preset' ? v.preset : '')
  const [file, setFile] = useState<Uploaded | null>(null)
  const [consent, setConsent] = useState(false)
  const [engine, setEngine] = useState<VoiceEngine>(v.engine)
  const [text, setText] = useState(v.sampleText)
  // 녹음은 그대로 두고 엔진·문장만 바꿀 수 있다
  const reuse = v.source === 'upload' && !!v.samplePath && !file
  const save = useAction()
  const retry = useAction()

  // 등록하는 동안 몇 초마다 새로 그린다
  useEffect(() => {
    if (v.status !== 'pending') return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [v.status, router])

  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold">목소리</h2>
        {v.source === 'upload' && v.status === 'ready' && <Pill tone="ok" dot>등록됨{v.mock ? ' (모의)' : ''}</Pill>}
        {v.source === 'upload' && v.status === 'pending' && <Pill tone="accent" dot>등록 중…</Pill>}
        {v.source === 'upload' && v.status === 'failed' && <Pill tone="bad" dot>등록 실패</Pill>}
        {!editing && <Button size="sm" className="ml-auto" onClick={() => setEditing(true)}>바꾸기</Button>}
      </div>

      {!editing && (
        <>
          <p className="text-[13.5px]">{v.source === 'library' ? <>보관함 목소리 · <b>{v.preset}</b></> : v.source === 'upload' ? `녹음 목소리 · ${VOICE_ENGINES.find((e) => e.id === v.engine)?.label ?? v.engine}` : v.preset || <span className="text-ink-soft">아직 정하지 않았어요 — 내레이션을 넣으려면 골라 주세요</span>}</p>
          {v.sampleUrl && <audio src={v.sampleUrl} controls className="h-10 w-full" />}
          {v.status === 'failed' && (
            <>
              <ErrorLine error={v.error} />
              <ErrorLine error={retry.error} />
              <Button size="sm" className="justify-self-start" disabled={retry.pending} onClick={() => retry.run(() => retryVoiceCloneAction(modelId), () => { toast('목소리 등록을 다시 시작했어요'); router.refresh() })}>
                {retry.pending ? '시작하는 중…' : '다시 등록'}
              </Button>
            </>
          )}
        </>
      )}

      {editing && (
        <div className="grid gap-2.5">
          <div className="inline-flex flex-wrap justify-self-start gap-0.5 rounded-lg bg-soft p-[3px]">
            {VOICE_TABS.map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cx('rounded-md px-2.5 py-1 text-[12.5px]', tab === t ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
                {label}
              </button>
            ))}
          </div>
          {source === 'library' && libraryMissing ? (
            <Note tone="warn">목소리 보관함을 쓰려면 Supabase SQL Editor에서 supabase/migrations/0006_voice_library.sql 을 먼저 돌려 주세요.</Note>
          ) : tab === 'design' ? (
            <div className="grid gap-2">
              {libraryId && libraryId !== v.libraryId && <Note tone="info">고른 목소리: <b>{voices.find((x) => x.id === libraryId)?.alias}</b> — 아래 저장을 눌러야 바뀌어요.</Note>}
              <VoiceDesigner defaultGender={gender} onSaved={addVoice} onUse={(x) => setLibraryId(x.id)} />
            </div>
          ) : tab === 'library' ? (
            <VoiceLibraryPicker voices={voices} value={libraryId} onChange={setLibraryId} defaultGender={gender} />
          ) : source === 'preset' ? (
            <select aria-label="기본 목소리" className={inputCls} value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="">골라 주세요</option>
              {VOICE_PRESETS.map((p) => <option key={p.label}>{p.label}</option>)}
            </select>
          ) : (
            <>
              <div className="inline-flex justify-self-start rounded-lg bg-soft p-[3px]">
                {VOICE_ENGINES.map((e) => (
                  <button key={e.id} type="button" onClick={() => setEngine(e.id)} className={cx('rounded-md px-2.5 py-1 text-[12.5px]', engine === e.id ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
                    {e.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-ink-soft">{VOICE_ENGINES.find((e) => e.id === engine)!.note}</p>
              {v.source === 'upload' && v.samplePath && !file && <p className="text-[12.5px]">지금 녹음을 그대로 써요. 새 녹음으로 바꾸려면 아래에 올려 주세요.</p>}
              <AudioUploader value={file} onChange={setFile} label={`새 녹음 파일 올리기. ${engine === 'qwen' ? '한 사람 목소리만, 잡음 없이 10–20초.' : VOICE_SAMPLE_HINT}`} />
              <textarea aria-label="녹음에서 읽은 문장" rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder={engine === 'qwen' ? '녹음에서 읽은 문장 (권장 — 글자 하나까지 같게)' : '녹음에서 읽은 문장 (선택)'} maxLength={1000} />
              {!reuse && (
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="size-4 accent-accent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  녹음한 사람에게 광고 목소리 사용 동의를 받았어요
                </label>
              )}
            </>
          )}
          <ErrorLine error={save.error} />
          <div className="flex justify-end gap-2">
            <Button tone="ghost" onClick={() => { setEditing(false); save.setError(null) }}>취소</Button>
            <Button
              tone="primary"
              disabled={save.pending || (source === 'library' ? !libraryId || libraryMissing : source === 'preset' ? !preset : !(reuse || (file && consent)))}
              onClick={() =>
                save.run(
                  () =>
                    updateModelVoiceAction(
                      modelId,
                      source === 'library' ? { voiceSource: 'library', voiceLibraryId: libraryId! } : source === 'preset' ? { voiceSource: 'preset', voice: preset } : { voiceSource: 'upload', voiceSamplePath: file?.path ?? v.samplePath ?? undefined, voiceConsent: reuse || consent, voiceEngine: engine, voiceSampleText: text },
                    ),
                  () => { setEditing(false); setFile(null); toast(source === 'upload' ? '목소리 등록을 시작했어요' : '목소리를 바꿨어요'); router.refresh() },
                )
              }
            >
              {save.pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
