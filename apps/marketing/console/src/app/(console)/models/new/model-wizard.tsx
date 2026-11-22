'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SHOTS } from '@marketing/core/model-shots'
import { VOICE_ENGINES, VOICE_PRESETS, VOICE_SAMPLE_HINT, voiceGenderOf, type VoiceEngine } from '@marketing/core/voice'
import { createModelAction, requestModelCandidatesAction } from '@/actions/models'
import { AudioUploader } from '@/components/audio-uploader'
import { ImageUploader, type Uploaded } from '@/components/image-uploader'
import { PersonaFields, fromDraft, toDraft } from '@/components/persona-fields'
import { Button, Card, ErrorLine, Field, Note, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'
import { VOICE_TABS, VoiceDesigner, VoiceLibraryPicker, type LibraryVoiceView, type VoiceTab } from '@/components/voice-designer'
import { useJob } from '@/components/use-job'

type Method = 'ai' | 'inspire' | 'photo'

const FACE_N = SHOTS.filter((s) => s.kind === 'face').length
const BODY_N = SHOTS.length - FACE_N

const AGES = ['20대', '30대', '40대', '50대 이상']

export function ModelWizard({ voices: initialVoices, libraryMissing }: { voices: LibraryVoiceView[]; libraryMissing: boolean }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('ai')
  const [gender, setGender] = useState('여성')
  const [age, setAge] = useState('20대')
  const [mood, setMood] = useState('밝고 친근함, 자연스러운 캐주얼')
  const [photos, setPhotos] = useState<Uploaded[]>([])
  const [ref, setRef] = useState<Uploaded[]>([])
  const [makeSheet, setMakeSheet] = useState(true)
  const [consent, setConsent] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [voice, setVoice] = useState('')
  const [voiceTab, setVoiceTab] = useState<VoiceTab>(libraryMissing ? 'preset' : initialVoices.length ? 'library' : 'design')
  const [voices, setVoices] = useState(initialVoices)
  const [libraryId, setLibraryId] = useState<string | null>(null)
  const voiceSource: 'preset' | 'upload' | 'library' = voiceTab === 'upload' ? 'upload' : (voiceTab === 'design' || voiceTab === 'library') && libraryId ? 'library' : 'preset'
  const addVoice = (v: LibraryVoiceView) => setVoices((xs) => (xs.some((x) => x.id === v.id) ? xs.map((x) => (x.id === v.id ? v : x)) : [v, ...xs]))
  const [voiceFile, setVoiceFile] = useState<Uploaded | null>(null)
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('qwen')
  const [voiceText, setVoiceText] = useState('')
  const [persona, setPersona] = useState(toDraft(null))
  const ask = useAction()
  const save = useAction()
  const { job, error: pollError } = useJob(jobId)
  const generating = !!jobId && (!job || job.status === 'queued' || job.status === 'running')
  const candidates = job?.status === 'done' ? job.files : []

  const cover = method === 'photo' ? photos[0]?.path : picked
  const voiceOk = voiceSource !== 'upload' || (!!voiceFile && voiceConsent)
  const canSave = !!cover && !!name.trim() && (method !== 'photo' || consent) && voiceOk
  const pick = (v: Method) => {
    setMethod(v)
    // 방식을 바꾸면 이전 방식의 후보는 버린다(참고 사진 후보가 조건 후보로 섞이지 않게)
    setJobId(null)
    setPicked(null)
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="grid gap-5">
        <section className="grid gap-3">
          <h3 className="font-bold">1. 시작 방식</h3>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {(
              [
                ['ai', '조건으로 만들기', '성별·나이·분위기를 고르면 AI가 후보 얼굴 4개를 만들어요'],
                ['inspire', '사진 참고해 새 인물', '실제 인물 사진 1–5장의 분위기만 따서, 다른 사람으로 바꾼 후보 4개를 만들어요'],
                ['photo', '실제 인물 그대로', '사진 속 인물을 그대로 모델로 등록해요. 초상권 동의가 필요해요'],
              ] as const
            ).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => pick(v)} className={cx('grid gap-1 rounded-xl border-[1.5px] p-3.5 text-left', method === v ? 'border-accent bg-accent-weak' : 'border-line hover:border-accent')}>
                <b>{t}</b>
                <span className="text-[12.5px] text-ink-soft">{d}</span>
              </button>
            ))}
          </div>
        </section>

        {method !== 'photo' ? (
          <section className="grid gap-3">
            <h3 className="font-bold">2. {method === 'inspire' ? '참고 사진 · 조건' : '조건'}</h3>
            {method === 'inspire' && (
              <>
                <ImageUploader value={ref} onChange={(v) => { setRef(v); setJobId(null); setPicked(null) }} max={5} label="분위기를 참고할 인물 사진 1–5장 (얼굴이 잘 보이게). 여러 장이면 공통된 느낌을 따라요" />
                <Note tone="info">사진 속 사람이 아니라 분위기·헤어·스타일 느낌만 참고해서 얼굴이 다른 새 인물을 만들어요. 후보 중 원본 인물과 닮아 보이는 얼굴은 고르지 마세요. 참고 사진은 모델에 저장되지 않아요.</Note>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="성별">
                <Seg value={gender} options={['여성', '남성']} onChange={setGender} />
              </Field>
              <Field label="나이대">
                <Seg value={age} options={AGES} onChange={setAge} />
              </Field>
            </div>
            <Field label="분위기·스타일" htmlFor="m-mood"><input id="m-mood" className={inputCls} value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
            <ErrorLine error={ask.error ?? pollError ?? (job?.status === 'failed' ? `후보를 만들지 못했어요: ${job.error}` : null)} />
            <div>
              <Button
                tone="primary"
                disabled={ask.pending || generating || (method === 'inspire' && !ref.length)}
                onClick={() =>
                  ask.run(() => requestModelCandidatesAction({ gender, ageBand: age, mood, refPaths: method === 'inspire' ? ref.map((r) => r.path) : undefined, persona: fromDraft(persona) }), (r) => {
                    setPicked(null)
                    setJobId(r.jobId)
                  })
                }
              >
                {generating ? '후보 만드는 중…' : candidates.length ? '후보 다시 만들기' : '후보 4개 만들기'}
              </Button>
            </div>
            {method === 'inspire' && !ref.length && <p className="text-[12.5px] text-ink-soft">참고 사진을 먼저 올려 주세요.</p>}
            {generating && <p className="text-[12.5px] text-ink-soft">{job?.retrying ? '한 번 실패해서 다시 시도하고 있어요…' : '보통 20–60초 걸려요. 워커가 꺼져 있으면 시작되지 않아요.'}</p>}
            {candidates.length > 0 && (
              <>
                {job?.mock && <Note tone="warn">모의 생성 모드(AI_MODE=mock)라서 색만 다른 자리 이미지가 나왔어요.</Note>}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {candidates.map((c, i) => (
                    <button key={c.path} type="button" onClick={() => setPicked(c.path)} className={cx('overflow-hidden rounded-xl border-2', picked === c.path ? 'border-accent' : 'border-transparent')} aria-label={`후보 ${i + 1} 고르기`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.url && <img src={c.url} alt="" className="aspect-[3/4] w-full object-cover" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="grid gap-3">
            <h3 className="font-bold">2. 사진</h3>
            <ImageUploader value={photos} onChange={setPhotos} max={5} label="정면이 잘 보이는 사진 1–5장. 첫 장이 대표 이미지예요" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="성별"><Seg value={gender} options={['여성', '남성']} onChange={setGender} /></Field>
              <Field label="나이대"><Seg value={age} options={AGES} onChange={setAge} /></Field>
            </div>
            <Field label="분위기·스타일" htmlFor="m-mood2"><input id="m-mood2" className={inputCls} value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" className="size-4 accent-accent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              사진 속 인물에게 광고 모델 사용 동의를 받았어요
            </label>
          </section>
        )}

        <section className="grid gap-3">
          <h3 className="font-bold">3. 캐릭터 (페르소나, 선택)</h3>
          <p className="-mt-1.5 text-[12.5px] text-ink-soft">실존하지 않지만 특색 있는 인물로 보이게 해요. 후보 얼굴과 콘텐츠의 표정·포즈·스타일링에 반영되고, 얼굴 생김새는 바꾸지 않아요. 후보를 만들기 전에 적으면 후보에도 반영돼요.</p>
          <PersonaFields value={persona} onChange={setPersona} idPrefix="nw" />
        </section>

        <section className="grid gap-3">
          <h3 className="font-bold">4. 이름 · 목소리</h3>
          <Field label="모델 이름" htmlFor="m-name"><input id="m-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 서윤" maxLength={20} /></Field>
          <Field label="목소리 (숏폼 내레이션용)" hint="숏폼을 만들 때 내레이션 대본을 이 목소리로 읽어 영상에 입혀요.">
            <Seg value={VOICE_TABS.find(([t]) => t === voiceTab)![1]} options={VOICE_TABS.map(([, l]) => l)} onChange={(l) => setVoiceTab(VOICE_TABS.find(([, x]) => x === l)![0])} />
          </Field>
          {(voiceTab === 'design' || voiceTab === 'library') && libraryMissing ? (
            <Note tone="warn">목소리 보관함을 쓰려면 Supabase SQL Editor에서 supabase/migrations/0006_voice_library.sql 을 먼저 돌려 주세요.</Note>
          ) : voiceTab === 'design' ? (
            <div className="grid gap-2">
              {libraryId && <Note tone="info">고른 목소리: <b>{voices.find((v) => v.id === libraryId)?.alias}</b> — 다른 후보를 &quot;이 모델에 쓰기&quot;로 누르면 바뀌어요.</Note>}
              <VoiceDesigner defaultGender={voiceGenderOf(gender)} onSaved={addVoice} onUse={(v) => setLibraryId(v.id)} />
            </div>
          ) : voiceTab === 'library' ? (
            <VoiceLibraryPicker voices={voices} value={libraryId} onChange={setLibraryId} defaultGender={voiceGenderOf(gender)} />
          ) : voiceTab === 'preset' ? (
            <select id="m-voice" aria-label="기본 목소리" className={inputCls} value={voice} onChange={(e) => setVoice(e.target.value)}>
              <option value="">나중에 정하기</option>
              {VOICE_PRESETS.map((v) => <option key={v.label}>{v.label}</option>)}
            </select>
          ) : (
            <div className="grid gap-2.5">
              <Field label="목소리 엔진">
                <Seg value={VOICE_ENGINES.find((e) => e.id === voiceEngine)!.label} options={VOICE_ENGINES.map((e) => e.label)} onChange={(l) => setVoiceEngine(VOICE_ENGINES.find((e) => e.label === l)!.id)} />
              </Field>
              <p className="-mt-1 text-[12.5px] text-ink-soft">{VOICE_ENGINES.find((e) => e.id === voiceEngine)!.note}</p>
              <AudioUploader value={voiceFile} onChange={setVoiceFile} label={`녹음 파일 올리기 (MP3 · WAV · M4A). ${voiceEngine === 'qwen' ? '한 사람 목소리만, 잡음 없이 10–20초.' : VOICE_SAMPLE_HINT}`} />
              <Field label={`녹음에서 읽은 문장${voiceEngine === 'qwen' ? ' (권장)' : ' (선택)'}`} htmlFor="m-vtext" hint={voiceEngine === 'qwen' ? '녹음과 글자 하나까지 같게 적으면 목소리가 훨씬 비슷해져요. 비우면 목소리 특징만 따라요.' : 'ElevenLabs 는 없어도 돼요. 나중에 Qwen3-TTS 로 바꿀 때 쓰여요.'}>
                <textarea id="m-vtext" rows={2} className={inputCls} value={voiceText} onChange={(e) => setVoiceText(e.target.value)} placeholder="예: 안녕하세요, 오늘도 좋은 하루 보내세요." maxLength={1000} />
              </Field>
              <label className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" className="size-4 accent-accent" checked={voiceConsent} onChange={(e) => setVoiceConsent(e.target.checked)} />
                녹음한 사람에게 광고 목소리로 쓰는 것에 대한 동의를 받았어요
              </label>
              <p className="text-[12.5px] text-ink-soft">저장하면 AI 목소리 업체(ElevenLabs)에 이 녹음으로 목소리를 등록해요. 1분 안팎 걸리고, 모델 화면에서 결과를 볼 수 있어요.</p>
            </div>
          )}
          {(voiceTab === 'design' || voiceTab === 'library') && !libraryMissing && !libraryId && <p className="text-[12.5px] text-ink-soft">목소리를 고르지 않고 저장하면 목소리 없이 저장돼요. 모델 화면에서 나중에 정할 수 있어요.</p>}
        </section>
        <section className="grid gap-2">
          <h3 className="font-bold">5. 각도 세트</h3>
          <label className="flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={makeSheet} onChange={(e) => setMakeSheet(e.target.checked)} />
            <span>
              저장하면서 같은 얼굴로 <b>얼굴 {FACE_N}장 · 전신 {BODY_N}장</b>을 자동으로 만들기
              <span className="block text-[12.5px] text-ink-soft">정면·좌우 회전·위아래 각도·표정, 전신 앞·뒤·옆·3/4. 콘텐츠마다 각도가 달라도 같은 사람으로 보이게 하는 기준이 돼요. 몇 분 걸리고, 모델 화면에서 한 장씩 채워지는 걸 볼 수 있어요.</span>
            </span>
          </label>
        </section>
        <ErrorLine error={save.error} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.push('/models')}>취소</Button>
          <Button
            tone="primary"
            disabled={!canSave || save.pending}
            onClick={() =>
              save.run(
                () =>
                  createModelAction({
                    name,
                    gender,
                    ageBand: age,
                    mood,
                    voice: voiceTab === 'preset' ? voice : '',
                    voiceSource,
                    voiceLibraryId: voiceSource === 'library' ? libraryId! : undefined,
                    voiceSamplePath: voiceFile?.path,
                    voiceConsent,
                    voiceEngine,
                    voiceSampleText: voiceText,
                    persona: fromDraft(persona),
                    source: method === 'photo' ? 'photo' : 'ai',
                    consent: method === 'photo' && consent,
                    makeSheet,
                    coverPath: cover!,
                    extraPaths: method === 'photo' ? photos.slice(1).map((p) => p.path) : [],
                  }),
                (r) => router.push(`/models/${r.id}`),
              )
            }
          >
            {save.pending ? '저장 중…' : '모델 저장'}
          </Button>
        </div>
        {!canSave && <p className="text-right text-[12.5px] text-ink-soft">{!cover ? (method !== 'photo' ? '후보 중 하나를 골라 주세요.' : '사진을 올려 주세요.') : !name.trim() ? '이름을 넣어 주세요.' : method === 'photo' && !consent ? '초상권 동의를 확인해 주세요.' : !voiceFile ? '목소리 녹음 파일을 올려 주세요. 아니면 기본 목소리를 고르세요.' : '목소리 사용 동의를 확인해 주세요.'}</p>}
      </Card>
      <Card className="grid gap-2.5">
        <h2 className="font-bold">대표 이미지</h2>
        <div className="aspect-[3/4] overflow-hidden rounded-xl bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={method === 'photo' ? photos[0]?.url : candidates.find((c) => c.path === picked)?.url ?? ''} alt="" className="size-full object-cover" />}
        </div>
        <p className="text-[12.5px] text-ink-soft">영상과 배너를 만들 때 이 얼굴을 기준으로 써요. 각도 세트도 이 얼굴을 기준으로 만들어요.</p>
      </Card>
    </div>
  )
}

function Seg({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-soft p-[3px]">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} className={cx('rounded-md px-2.5 py-1 text-[12.5px]', value === o ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
          {o}
        </button>
      ))}
    </div>
  )
}
