'use client'

import { useState } from 'react'
import { MAX_VOICE_TONES, VOICE_AGES, VOICE_GENDERS, VOICE_PITCHES, VOICE_SPEEDS, VOICE_TONES, describeVoice, type VoiceDesignInput, type VoiceGender } from '@marketing/core/voice'
import { requestVoiceDesignAction, saveVoiceAction } from '@/actions/voices'
import { Button, ErrorLine, Field, Note, Pill, cx, inputCls } from './ui'
import { useAction } from './use-action'
import { useJob } from './use-job'

/** 모델 목소리 고르는 방법 (모델 만들기 · 모델 화면의 목소리 카드) */
export type VoiceTab = 'design' | 'library' | 'preset' | 'upload'
export const VOICE_TABS: [VoiceTab, string][] = [
  ['design', 'AI로 만들기'],
  ['library', '보관함에서 고르기'],
  ['preset', '기본 목소리'],
  ['upload', '녹음 파일'],
]

/** 보관함 목소리 한 개 (화면용) */
export type LibraryVoiceView = { id: string; alias: string; gender: VoiceGender; description: string; url: string | null }

/* 목소리 만들기: 설명 칩을 고르면 AI(Qwen3-TTS VoiceDesign)가 후보 4개를 만든다.
   후보마다 들어 보고 별칭을 붙여 "보관" → 목소리 보관함(voices). onUse 가 있으면 "이 모델에 쓰기"도 보인다(보관 + 선택). */
export function VoiceDesigner({ defaultGender = 'female', onSaved, onUse }: { defaultGender?: VoiceGender; onSaved?: (v: LibraryVoiceView) => void; onUse?: (v: LibraryVoiceView) => void }) {
  const [d, setD] = useState<VoiceDesignInput>({ gender: defaultGender, age: '20대', pitch: '보통 톤', tones: ['밝은'], speed: '보통 속도', extra: '' })
  const [jobId, setJobId] = useState<string | null>(null)
  const ask = useAction()
  const { job, error: pollError } = useJob(jobId)
  const generating = !!jobId && (!job || job.status === 'queued' || job.status === 'running')
  const candidates = job?.status === 'done' ? job.files : []
  // 만들 때의 설명 — 후보의 기본 별칭
  const [madeWith, setMadeWith] = useState('')
  const set = (p: Partial<VoiceDesignInput>) => setD((x) => ({ ...x, ...p }))
  const toggleTone = (t: string) => set({ tones: d.tones.includes(t) ? d.tones.filter((x) => x !== t) : d.tones.length >= MAX_VOICE_TONES ? d.tones : [...d.tones, t] })

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="성별"><Chips options={VOICE_GENDERS.map((g) => g.label)} value={[VOICE_GENDERS.find((g) => g.id === d.gender)!.label]} onPick={(l) => set({ gender: VOICE_GENDERS.find((g) => g.label === l)!.id })} /></Field>
        <Field label="나이대"><Chips options={VOICE_AGES.map((a) => a.label)} value={[d.age]} onPick={(age) => set({ age })} /></Field>
        <Field label="음높이"><Chips options={VOICE_PITCHES.map((a) => a.label)} value={[d.pitch]} onPick={(pitch) => set({ pitch })} /></Field>
        <Field label="말 속도"><Chips options={VOICE_SPEEDS.map((a) => a.label)} value={[d.speed]} onPick={(speed) => set({ speed })} /></Field>
      </div>
      <Field label={`분위기 (최대 ${MAX_VOICE_TONES}개)`}><Chips options={VOICE_TONES.map((a) => a.label)} value={d.tones} onPick={toggleTone} /></Field>
      <Field label="추가 설명 (선택)" htmlFor="vd-extra" hint="예: 라디오 DJ 같은 느낌, 살짝 웃으면서 말함. 영어로 옮겨서 AI에 넘겨요.">
        <input id="vd-extra" className={inputCls} value={d.extra} onChange={(e) => set({ extra: e.target.value })} maxLength={200} placeholder="칩으로 부족한 느낌을 한 줄로" />
      </Field>
      <ErrorLine error={ask.error ?? pollError ?? (job?.status === 'failed' ? `후보를 만들지 못했어요: ${job.error}` : null)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          disabled={ask.pending || generating}
          onClick={() => ask.run(() => requestVoiceDesignAction(d), (r) => { setMadeWith(describeVoice(d)); setJobId(r.jobId) })}
        >
          {generating ? '목소리 만드는 중…' : candidates.length ? '후보 다시 만들기' : '후보 4개 만들기'}
        </Button>
        <span className="text-[12.5px] text-ink-soft">{describeVoice(d)}</span>
      </div>
      {generating && <p className="text-[12.5px] text-ink-soft">{job?.retrying ? '한 번 실패해서 다시 시도하고 있어요…' : '후보 하나에 10초 안팎, 4개면 1분쯤 걸려요(처음 한 번은 모델을 올리느라 2분쯤 더). 워커와 음성 서버가 켜져 있어야 해요.'}</p>}
      {candidates.length > 0 && (
        <div className="grid gap-2">
          {job?.mock && <Note tone="warn">모의 생성 모드(AI_MODE=mock)라서 삐 소리만 나와요.</Note>}
          <p className="text-[12.5px] text-ink-soft">같은 설명이어도 후보마다 목소리가 달라요. 마음에 드는 건 별칭을 붙여 보관해 두면 다른 모델에서도 고를 수 있어요.</p>
          {candidates.map((c, i) => (
            <Candidate key={c.path} n={i + 1} jobId={jobId!} path={c.path} url={c.url} defaultAlias={madeWith} onSaved={onSaved} onUse={onUse} />
          ))}
        </div>
      )}
    </div>
  )
}

function Candidate({ n, jobId, path, url, defaultAlias, onSaved, onUse }: { n: number; jobId: string; path: string; url: string | null; defaultAlias: string; onSaved?: (v: LibraryVoiceView) => void; onUse?: (v: LibraryVoiceView) => void }) {
  const [alias, setAlias] = useState('')
  const [saved, setSaved] = useState<LibraryVoiceView | null>(null)
  const save = useAction()
  const run = (use: boolean) =>
    save.run(() => saveVoiceAction({ jobId, path, alias: alias.trim() || defaultAlias }), (r) => {
      setSaved(r.voice)
      onSaved?.(r.voice)
      if (use) onUse?.(r.voice)
    })
  return (
    <div className={cx('grid gap-2 rounded-xl border p-3', saved ? 'border-accent bg-accent-weak' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="w-16 shrink-0">voice{n}</b>
        {url && <audio src={url} controls className="h-9 min-w-0 flex-1" />}
        {saved && <Pill tone="ok" dot>보관함에 있음</Pill>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={`voice${n} 별칭`} className={cx(inputCls, 'min-w-0 flex-1')} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder={`별칭 (비우면 "${defaultAlias}")`} maxLength={30} />
        <Button size="sm" disabled={save.pending} onClick={() => run(false)}>{save.pending ? '보관 중…' : saved ? '별칭 고치기' : '보관'}</Button>
        {onUse && <Button size="sm" tone="primary" disabled={save.pending} onClick={() => run(true)}>이 모델에 쓰기</Button>}
      </div>
      <ErrorLine error={save.error} />
    </div>
  )
}

function Chips({ options, value, onPick }: { options: string[]; value: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onPick(o)} aria-pressed={value.includes(o)} className={cx('rounded-full border px-2.5 py-0.5 text-[12.5px]', value.includes(o) ? 'border-accent bg-accent-weak font-bold text-accent' : 'border-line text-ink-soft hover:border-accent')}>
          {o}
        </button>
      ))}
    </div>
  )
}

/* 보관함에서 하나 고르기 (모델 목소리). 성별로 나눠 보이고, 들어 보고 고른다. */
export function VoiceLibraryPicker({ voices, value, onChange, defaultGender }: { voices: LibraryVoiceView[]; value: string | null; onChange: (id: string) => void; defaultGender: VoiceGender }) {
  const [gender, setGender] = useState<VoiceGender>(defaultGender)
  const list = voices.filter((v) => v.gender === gender)
  return (
    <div className="grid gap-2">
      <Chips options={VOICE_GENDERS.map((g) => `${g.label} ${voices.filter((v) => v.gender === g.id).length}`)} value={[`${VOICE_GENDERS.find((g) => g.id === gender)!.label} ${voices.filter((v) => v.gender === gender).length}`]} onPick={(l) => setGender(l.startsWith('남성') ? 'male' : 'female')} />
      {!list.length && <p className="text-[12.5px] text-ink-soft">보관한 {gender === 'male' ? '남성' : '여성'} 목소리가 없어요. &quot;AI로 만들기&quot;에서 만들어 보관해 주세요.</p>}
      <div className="grid max-h-[360px] gap-1.5 overflow-y-auto">
        {list.map((v) => (
          <label key={v.id} className={cx('grid cursor-pointer gap-1.5 rounded-xl border p-2.5', value === v.id ? 'border-accent bg-accent-weak' : 'border-line hover:border-accent')}>
            <span className="flex items-center gap-2">
              <input type="radio" name="library-voice" className="size-4 accent-accent" checked={value === v.id} onChange={() => onChange(v.id)} />
              <b className="text-[13.5px]">{v.alias}</b>
              <span className="truncate text-[12px] text-ink-soft">{v.description}</span>
            </span>
            {v.url && <audio src={v.url} controls preload="none" className="h-9 w-full" />}
          </label>
        ))}
      </div>
    </div>
  )
}
