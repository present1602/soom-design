'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { MAX_PRODUCT_IMAGES, MAX_REFERENCE_IMAGES } from '@marketing/core/storage'
import { SHORT_LENGTHS, type ShortLength, toShortLength } from '@marketing/core/short-length'
import { NARRATION_MAX, narrationLimit } from '@marketing/core/voice'
import type { ContentSettings } from '@marketing/core/types'
import { createContentAction, requestFrameAction } from '@/actions/create'
import { ImageUploader, type Uploaded } from '@/components/image-uploader'
import { Button, Card, ErrorLine, Field, Note, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'
import { useJob } from '@/components/use-job'
import type { StoreEvent } from '@marketing/core/events'
import { eventPeriod } from '@marketing/core/events'
import { ResultPanel, type ChannelOpt, type StoreInfo } from './result-panel'
import { StoreBriefSection, type StoreBriefView } from './store-brief'

export type ModelOpt = { id: string; name: string; gender: string; ageBand: string; mood: string; coverUrl: string | null; voice: string | null }
export type Initial = {
  contentId: string
  modelId: string | null
  prompt: string
  moods: string[]
  settings: ContentSettings
  products: Uploaded[]
  references: Uploaded[]
  firstFrame: Uploaded | null
  thumb: Uploaded | null
}

export function Workspace({ type, store, brief, events: initialEvents, channels, models, moods, isSuper, initial }: { type: 'short' | 'banner'; store: StoreInfo; brief: StoreBriefView; events: StoreEvent[] | null; channels: ChannelOpt[]; models: ModelOpt[]; moods: string[]; isSuper: boolean; initial: Initial | null }) {
  const router = useRouter()
  const path = usePathname()
  const isShort = type === 'short'
  const s = initial?.settings ?? {}
  const [contentId, setContentId] = useState<string | null>(initial?.contentId ?? null)
  const locked = !!contentId
  const [modelId, setModelId] = useState<string | null>(initial?.modelId ?? null)
  const [picked, setPicked] = useState<string[]>(initial?.moods ?? [])
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')
  const [products, setProducts] = useState<Uploaded[]>(initial?.products ?? [])
  const [refs, setRefs] = useState<Uploaded[]>(initial?.references ?? [])
  const [events, setEvents] = useState(initialEvents)
  const [eventId, setEventId] = useState<string | null>(null)
  const event = events?.find((e) => e.id === eventId) ?? null
  // 숏폼
  const [length, setLength] = useState<ShortLength>(toShortLength(s.length))
  const [narration, setNarration] = useState(s.narration ?? '')
  const [ffMode, setFfMode] = useState<'none' | 'upload' | 'ai'>(s.firstFrame ?? 'none')
  const [ffUpload, setFfUpload] = useState<Uploaded[]>(s.firstFrame === 'upload' && initial?.firstFrame ? [initial.firstFrame] : [])
  const [ffJob, setFfJob] = useState<string | null>(null)
  const [thumbMode, setThumbMode] = useState<'ai' | 'auto' | 'upload'>(s.thumbMode ?? 'ai')
  const [thumbUpload, setThumbUpload] = useState<Uploaded[]>(initial?.thumb ? [initial.thumb] : [])
  // 배너
  const [size, setSize] = useState<'1:1' | '4:5' | '9:16'>(s.size ?? '1:1')
  const [variants, setVariants] = useState<2 | 4>(s.variants === 2 ? 2 : 4)
  const [headline, setHeadline] = useState(s.headline ?? '')
  const [subline, setSubline] = useState(s.subline ?? '')
  const [cta, setCta] = useState(s.cta ?? '')

  const frame = useAction()
  const gen = useAction()
  const { job: ff, error: ffPollError } = useJob(ffJob)
  const ffBusy = !!ffJob && (!ff || ff.status === 'queued' || ff.status === 'running')
  const ffDone = ff?.status === 'done' ? ff.files[0] : null
  const ffAi: Uploaded | null = ffDone?.url ? { path: ffDone.path, url: ffDone.url } : s.firstFrame === 'ai' && initial?.firstFrame ? initial.firstFrame : null

  const missing = !modelId ? '가상 모델을 골라 주세요.' : prompt.trim().length < 5 ? '프롬프트를 5자 이상 적어 주세요.' : isShort && ffMode === 'upload' && !ffUpload.length ? '퍼스트 프레임 이미지를 올리거나 "사용 안 함"을 고르세요.' : isShort && ffMode === 'ai' && !ffAi ? '퍼스트 프레임을 먼저 만들거나 "사용 안 함"을 고르세요.' : isShort && thumbMode === 'upload' && !thumbUpload.length ? '썸네일 이미지를 올리거나 다른 방식을 고르세요.' : null

  const submit = () =>
    gen.run(
      () =>
        createContentAction({
          storeId: store.id,
          type,
          modelId: modelId!,
          prompt,
          moods: picked,
          products: products.map((p) => p.path),
          references: refs.map((p) => p.path),
          eventId,
          length,
          narration: isShort ? narration : undefined,
          firstFrame: { mode: ffMode, path: ffMode === 'upload' ? ffUpload[0]?.path : ffMode === 'ai' ? ffAi?.path : undefined },
          thumb: { mode: thumbMode, path: thumbMode === 'upload' ? thumbUpload[0]?.path : undefined },
          size,
          variants,
          headline,
          subline,
          cta,
        }),
      (r) => {
        setContentId(r.contentId)
        router.replace(`${path}?content=${r.contentId}`, { scroll: false })
      },
    )

  const startOver = () => router.push(path)

  const sec = 'grid gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0'
  const h3 = "font-bold before:[counter-increment:sec] before:content-[counter(sec)'._']"
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <Card className="grid gap-4 [counter-reset:sec]">
        {locked && (
          <Note tone="accent">
            이 콘텐츠를 만들 때 넣은 값이에요. 같은 값으로 다시 만들려면 오른쪽 <b>다시 생성</b>, 다른 걸 만들려면{' '}
            <button type="button" className="font-bold underline" onClick={startOver}>새로 만들기</button>를 누르세요.
          </Note>
        )}
        <fieldset disabled={locked} className="grid gap-4 disabled:opacity-80">
          <StoreBriefSection sec={sec} h3={h3} store={brief} events={events} onEvents={setEvents} eventId={eventId} onPick={setEventId} locked={locked} lockedEvent={s.event ?? null} />
          <section className={sec}>
            <div className="flex items-center gap-2">
              <h3 className={h3}>가상 모델</h3>
              <Link href="/models" className="ml-auto text-[12.5px] text-accent">모델 목록</Link>
            </div>
            {models.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
                {models.map((m) => (
                  <button key={m.id} type="button" onClick={() => setModelId(m.id)} aria-pressed={modelId === m.id} className={cx('grid gap-1 rounded-xl border-2 p-1.5 pb-2.5 text-left', modelId === m.id ? 'border-accent bg-accent-weak' : 'border-line bg-card hover:border-accent')}>
                    <div className="aspect-[3/4] overflow-hidden rounded-lg bg-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.coverUrl && <img src={m.coverUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <b className="px-1 pt-0.5 text-[14px]">{m.name}</b>
                    <span className="px-1 text-[11.5px] leading-snug text-ink-soft">{m.gender} · {m.ageBand} · {m.mood}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Note tone="warn">가상 모델이 없어요. <Link href="/models/new" className="font-bold underline">모델 만들기</Link>에서 먼저 만들어 주세요.</Note>
            )}
          </section>

          {isShort && (
            <section className={sec}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={h3}>분위기</h3>
                <span className="text-[12.5px] text-ink-soft">여러 개 고를 수 있어요. 프롬프트에 함께 들어가요</span>
                {isSuper && <Link href="/settings" className="ml-auto text-[12.5px] text-accent">옵션 관리</Link>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {moods.map((m) => {
                  const on = picked.includes(m)
                  return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== m) : [...picked, m])} className={cx('rounded-full border-[1.5px] px-3.5 py-1.5 text-[13.5px]', on ? 'border-accent bg-accent font-bold text-white' : 'border-line bg-card hover:border-accent')}>
                      {m}
                    </button>
                  )
                })}
                {!moods.length && <span className="text-[12.5px] text-ink-soft">켜진 분위기 옵션이 없어요.</span>}
              </div>
            </section>
          )}

          <section className={sec}>
            <h3 className={h3}>프롬프트</h3>
            <textarea
              id="ws-prompt"
              rows={4}
              className={inputCls}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isShort ? '예: 아침 햇살이 드는 매장에서 모델이 갓 구운 밤식빵을 들고 반으로 갈라 보여 준다. 카메라가 천천히 다가간다.' : '예: 크리스마스 분위기의 매장 앞, 모델이 케이크 상자를 들고 웃는다. 빨강·초록 포인트.'}
              aria-label="프롬프트"
            />
            <p className="text-[12.5px] text-ink-soft">매장 소개·브랜드 톤(고객사·매장 정보 탭)도 함께 AI에 넘어가요.</p>
          </section>

          <section className={sec}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={h3}>제품 이미지 (선택)</h3>
              <span className="text-[12.5px] text-ink-soft">여러 각도로 올리면 제품 모양이 더 일정하게 나와요</span>
              <span className="ml-auto text-[12px] tabular text-ink-soft">{products.length}/{MAX_PRODUCT_IMAGES}</span>
            </div>
            <ImageUploader value={products} onChange={setProducts} max={MAX_PRODUCT_IMAGES} label={`제품 사진을 올려 주세요 (최대 ${MAX_PRODUCT_IMAGES}장)`} disabled={locked} />
          </section>

          <section className={sec}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={h3}>참고 이미지 (선택)</h3>
              <span className="text-[12.5px] text-ink-soft">분위기·구도·색감 참고</span>
              <span className="ml-auto text-[12px] tabular text-ink-soft">{refs.length}/{MAX_REFERENCE_IMAGES}</span>
            </div>
            <ImageUploader value={refs} onChange={setRefs} max={MAX_REFERENCE_IMAGES} label="참고 이미지를 올려 주세요" disabled={locked} />
          </section>

          {isShort ? (
            <>
              <section className={sec}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={h3}>퍼스트 프레임 (선택)</h3>
                  <span className="text-[12.5px] text-ink-soft">첫 장면을 정해 두면 원하는 구도로 시작해요</span>
                </div>
                <Seg value={ffMode} onChange={setFfMode} options={[['none', '사용 안 함'], ['upload', '직접 올리기'], ['ai', 'AI로 만들기']]} />
                {ffMode === 'none' && <p className="text-[12.5px] text-ink-soft">제품 이미지가 있으면 모델과 제품을 합성해 첫 장면을 만들고, 없으면 모델 사진으로 시작해요.</p>}
                {ffMode === 'upload' && <ImageUploader value={ffUpload} onChange={setFfUpload} max={1} square={false} label="첫 장면 이미지 1장 (9:16 권장)" disabled={locked} />}
                {ffMode === 'ai' && (
                  <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                    <div className="grid aspect-[9/16] place-items-center overflow-hidden rounded-xl border border-line bg-soft text-[12px] text-ink-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {ffBusy ? '만드는 중…' : ffAi ? <img src={ffAi.url} alt="합성한 첫 장면" className="size-full object-cover" /> : '아직 없음'}
                    </div>
                    <div className="grid gap-2">
                      <p className="text-[12.5px] text-ink-soft">고른 가상 모델과 제품 이미지를 합성해서 첫 장면을 만들어요.</p>
                      {(!modelId || !products.length) && <p className="text-[12.5px] text-warn">모델과 제품 이미지를 먼저 넣어 주세요.</p>}
                      {ff?.mock && ffAi && <p className="text-[12.5px] text-warn">모의 생성이라 사진을 겹쳐 놓은 자리 이미지예요.</p>}
                      <ErrorLine error={frame.error ?? ffPollError ?? (ff?.status === 'failed' ? `첫 장면을 만들지 못했어요: ${ff.error}` : null)} />
                      <Button size="sm" className="justify-self-start" disabled={!modelId || !products.length || ffBusy || frame.pending} onClick={() => frame.run(() => requestFrameAction({ storeId: store.id, modelId: modelId!, productPaths: products.map((p) => p.path), prompt, moods: picked }), (r) => setFfJob(r.jobId))}>
                        {ffBusy ? '만드는 중…' : ffAi ? '다시 만들기' : '모델 + 제품으로 만들기'}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
              <section className={sec}>
                <h3 className={h3}>길이 · 썸네일</h3>
                <Field label="길이"><Seg value={String(length)} onChange={(v) => setLength(toShortLength(Number(v)))} options={SHORT_LENGTHS.map((n) => [String(n), `${n}초`] as [string, string])} /></Field>
                <Field label="썸네일">
                  <Seg value={thumbMode} onChange={setThumbMode} options={[['ai', 'AI 추천에서 고르기'], ['auto', '자동 (첫 장면)'], ['upload', '직접 올리기']]} />
                </Field>
                {thumbMode === 'upload' ? (
                  <ImageUploader value={thumbUpload} onChange={setThumbUpload} max={1} square={false} label="썸네일 이미지 (9:16)" disabled={locked} />
                ) : (
                  <p className="text-[12.5px] text-ink-soft">{thumbMode === 'ai' ? '영상이 나오면 장면 중 4개를 추천해요. 그중 하나를 골라요.' : '영상 앞부분 장면을 그대로 써요.'}</p>
                )}
              </section>
              <NarrationField sec={sec} h3={h3} value={narration} onChange={setNarration} length={length} model={models.find((m) => m.id === modelId) ?? null} disabled={locked} />
            </>
          ) : (
            <>
              <section className={sec}>
                <h3 className={h3}>크기 · 장수</h3>
                <Field label="크기"><Seg value={size} onChange={setSize} options={[['1:1', '1:1 피드'], ['4:5', '4:5 피드'], ['9:16', '9:16 스토리']]} /></Field>
                <Field label="한 번에 만들 시안"><Seg value={String(variants)} onChange={(v) => setVariants(v === '2' ? 2 : 4)} options={[['2', '2장'], ['4', '4장']]} /></Field>
              </section>
              <section className={sec}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={h3}>광고 문구 (선택)</h3>
                  {event && (
                    <Button size="sm" className="ml-auto" onClick={() => { setHeadline(event.title.slice(0, 40)); setSubline([event.offer, eventPeriod({ startsOn: event.starts_on, endsOn: event.ends_on })].filter(Boolean).join(' · ').slice(0, 60)) }}>
                      이벤트 내용으로 채우기
                    </Button>
                  )}
                </div>
                <Field label="헤드라인" htmlFor="b-h"><input id="b-h" className={inputCls} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="예: 겨울에만 굽는 밤식빵" maxLength={40} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="보조 문구" htmlFor="b-s"><input id="b-s" className={inputCls} value={subline} onChange={(e) => setSubline(e.target.value)} placeholder="예: 성수점 매일 오전 8시" maxLength={60} /></Field>
                  <Field label="버튼 문구" htmlFor="b-c"><input id="b-c" className={inputCls} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="예: 지금 예약" maxLength={16} /></Field>
                </div>
                <p className="text-[12.5px] text-ink-soft">비워 두면 글자 없이 이미지만 만들어요. AI가 그린 글자는 틀릴 수 있어 결과를 꼭 확인해 주세요.</p>
              </section>
            </>
          )}
        </fieldset>

        {!locked && (
          <div className="grid gap-2 border-t border-line pt-4">
            <ErrorLine error={gen.error} />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {missing && <span className="text-[12.5px] text-ink-soft">{missing}</span>}
              <Button tone="primary" size="lg" disabled={!!missing || gen.pending || ffBusy} onClick={submit}>
                {gen.pending ? '요청 중…' : isShort ? '숏폼 생성' : '배너 생성'}
              </Button>
            </div>
          </div>
        )}
      </Card>
      <div className="grid gap-4 xl:sticky xl:top-4">
        <ResultPanel key={contentId ?? 'none'} contentId={contentId} type={type} store={store} channels={channels} prompt={prompt} />
      </div>
    </div>
  )
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 justify-self-start rounded-lg bg-soft p-[3px]" role="radiogroup">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cx('rounded-md px-3 py-1.5 text-[13px]', value === v ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
          {l}
        </button>
      ))}
    </div>
  )
}

/** 숏폼 내레이션 대본. 모델 목소리로 읽어 영상에 입힌다(화면 밖 목소리). */
function NarrationField({ sec, h3, value, onChange, length, model, disabled }: { sec: string; h3: string; value: string; onChange: (v: string) => void; length: ShortLength; model: ModelOpt | null; disabled: boolean }) {
  const limit = narrationLimit(length)
  const over = value.trim().length > limit
  return (
    <section className={sec}>
      <h3 className={h3}>내레이션 (선택)</h3>
      <textarea
        aria-label="내레이션 대본"
        rows={3}
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, NARRATION_MAX))}
        placeholder={`예: 이번 주말만, 시그니처 라떼 천 원 할인! 홍대점에서 만나요.`}
        disabled={disabled || !model?.voice}
      />
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        {model && !model.voice ? (
          <span className="text-warn">
            {model.name}에 목소리가 없어요. <Link href={`/models/${model.id}`} className="font-bold underline">모델 화면</Link>에서 목소리를 정하면 쓸 수 있어요.
          </span>
        ) : (
          <span className="text-ink-soft">{model ? `${model.name} 목소리(${model.voice})로 읽어 영상에 입혀요.` : '가상 모델을 고르면 그 목소리로 읽어요.'} 비우면 소리 없이 만들어요.</span>
        )}
        <span className={over ? 'ml-auto font-bold text-warn tabular' : 'ml-auto text-ink-soft tabular'}>
          {value.trim().length}/{limit}자{over ? ` · ${length}초 영상에는 길어서 뒤가 잘려요` : ''}
        </span>
      </div>
    </section>
  )
}
