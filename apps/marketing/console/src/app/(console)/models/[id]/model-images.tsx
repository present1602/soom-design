'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { EDIT_SUGGESTIONS, SHOT_LABELS, SHOTS } from '@marketing/core/model-shots'
import { addModelImagesAction, applyShotEditAction, discardShotEditAction, removeModelImageAction, requestModelSheetAction, requestShotEditAction, setModelCoverAction } from '@/actions/models'
import { Dialog } from '@/components/dialog'
import { ImageUploader, type Uploaded } from '@/components/image-uploader'
import { useToast } from '@/components/toast'
import { Button, ErrorLine, Field, inputCls, Note } from '@/components/ui'
import { useAction } from '@/components/use-action'

type Img = { id: string; label: string; url: string | null }
type Sheet = { running: boolean; error: string | null; failed: { label: string; error: string }[] }
/** 크게 보기 — id 가 없으면 지금 대표 이미지 */
type Viewing = { id: string | null; label: string; url: string }
/** 이미지 한 장의 고르지 않은 수정 작업 (page.tsx 가 jobs 에서 읽는다) */
export type ShotEdit = {
  status: 'queued' | 'running' | 'done' | 'failed'
  error: string | null
  mode: 'edit' | 'fresh'
  instruction: string
  /** 이어서 고친 경우 그 기준 수정본 */
  base: string | null
  drafts: { path: string; url: string | null }[]
}
const editing = (e?: ShotEdit) => e?.status === 'queued' || e?.status === 'running'

export function ModelImages({ modelId, cover, images, sheet, edits }: { modelId: string; cover: string | null; images: Img[]; sheet: Sheet; edits: Record<string, ShotEdit> }) {
  const router = useRouter()
  const toast = useToast()
  const [adding, setAdding] = useState<Uploaded[]>([])
  const [label, setLabel] = useState('의상')
  const add = useAction()
  const del = useAction()
  const start = useAction()
  const cov = useAction()
  // 크게 보기 — 이미지 id(대표는 'cover')로 기억한다. 새로고침으로 목록이 바뀌어도 같은 이미지를 가리킨다
  const [viewKey, setViewKey] = useState<string | null>(null)
  const open = (key: string) => {
    cov.setError(null)
    setViewKey(key)
  }

  // 각도 세트·수정본을 만드는 동안 몇 초마다 새로 그려 진행 상황을 보여 준다
  const polling = sheet.running || Object.values(edits).some((e) => editing(e))
  useEffect(() => {
    if (!polling) return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [polling, router])

  const byLabel = new Map(images.filter((i) => SHOT_LABELS.has(i.label)).map((i) => [i.label, i]))
  const own = images.filter((i) => !SHOT_LABELS.has(i.label))
  const done = SHOTS.filter((s) => byLabel.has(s.label)).length
  const missing = SHOTS.length - done
  const busy = sheet.running || start.pending
  const failedBy = new Map(sheet.failed.map((f) => [f.label, f.error]))

  // 크게 보기에서 ‹ › 로 넘기는 순서 — 화면에 보이는 순서 그대로: 대표 → 얼굴 → 전신 → 추가 이미지 (없는 컷은 건너뛴다)
  const shotsOf = (kind: 'face' | 'body') =>
    SHOTS.filter((s) => s.kind === kind)
      .map((s) => byLabel.get(s.label))
      .filter((i): i is Img & { url: string } => !!i?.url)
      .map((i) => ({ id: i.id, label: i.label, url: i.url }))
  const gallery: Viewing[] = [
    ...(cover ? [{ id: null, label: '대표', url: cover }] : []),
    ...shotsOf('face'),
    ...shotsOf('body'),
    ...own.filter((i): i is Img & { url: string } => !!i.url).map((i) => ({ id: i.id, label: i.label, url: i.url })),
  ]
  const at = viewKey === null ? -1 : gallery.findIndex((g) => (g.id ?? 'cover') === viewKey)
  const viewing = at >= 0 ? gallery[at] : null
  const prev = at > 0 ? gallery[at - 1] : null
  const next = at >= 0 && at < gallery.length - 1 ? gallery[at + 1] : null
  const go = (g: Viewing | null) => g && !cov.pending && open(g.id ?? 'cover')

  // 키보드 ← → 로도 넘긴다
  const goRef = useRef({ prev, next, go })
  useEffect(() => {
    goRef.current = { prev, next, go }
  })
  const viewerOpen = !!viewing
  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => {
      // 고칠 내용을 적는 중에는 글자 사이를 움직이는 키다
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.key === 'ArrowLeft') goRef.current.go(goRef.current.prev)
      if (e.key === 'ArrowRight') goRef.current.go(goRef.current.next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerOpen])

  const tile = (s: (typeof SHOTS)[number]) => {
    const img = byLabel.get(s.label)
    return (
      <Tile key={s.label} label={s.label} url={img?.url ?? null} onOpen={img?.url ? () => open(img.id) : undefined} edit={img ? edits[img.id] : undefined}>
        {img ? (
          <TileActions
            disabled={busy || del.pending}
            onReshoot={() => open(img.id)}
            onRemove={() => del.run(() => removeModelImageAction(modelId, img.id), () => router.refresh())}
            label={s.label}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-[11.5px] text-ink-soft">
            {sheet.running ? '만드는 중…' : failedBy.has(s.label) ? '실패' : '없음'}
          </span>
        )}
      </Tile>
    )
  }

  return (
    <div className="grid gap-5">
      {/* 각도 세트 상태 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-soft p-3.5">
        <div className="grid gap-0.5">
          <b className="text-[13.5px]">각도 세트 {done}/{SHOTS.length}</b>
          <span className="text-[12.5px] text-ink-soft">
            {sheet.running ? '만들고 있어요. 한 장씩 채워져요 (보통 몇 분, 워커가 꺼져 있으면 시작되지 않아요).' : missing ? `빠진 컷 ${missing}장을 대표 얼굴 기준으로 만들 수 있어요.` : '다 갖췄어요. 다른 사람처럼 보이는 컷은 ↻ 로 다시 뽑으세요.'}
          </span>
        </div>
        {!sheet.running && missing > 0 && (
          <Button className="ml-auto" tone="primary" disabled={busy} onClick={() => start.run(() => requestModelSheetAction(modelId), () => { toast('각도 세트를 만들기 시작했어요'); router.refresh() })}>
            {start.pending ? '시작하는 중…' : done ? `빠진 ${missing}장 채우기` : '각도 세트 만들기'}
          </Button>
        )}
      </div>
      <ErrorLine error={start.error ?? del.error} />
      {!sheet.running && <ErrorLine error={sheet.error ? `각도 세트를 다 만들지 못했어요: ${sheet.error}` : null} />}
      {sheet.failed.length > 0 && !sheet.running && (
        <Note tone="warn">
          {sheet.failed.length}장은 만들지 못했어요 ({sheet.failed.map((f) => f.label).join(', ')}). 이유: {sheet.failed[0].error}
        </Note>
      )}

      <section className="grid gap-2">
        <h3 className="text-[13.5px] font-bold">얼굴</h3>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          <Tile label="대표" url={cover} strong onOpen={cover ? () => open('cover') : undefined} />
          {SHOTS.filter((s) => s.kind === 'face').map(tile)}
        </div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-[13.5px] font-bold">전신</h3>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">{SHOTS.filter((s) => s.kind === 'body').map(tile)}</div>
      </section>
      {own.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-[13.5px] font-bold">추가 이미지</h3>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {own.map((i) => (
              <Tile key={i.id} label={i.label} url={i.url} onOpen={i.url ? () => open(i.id) : undefined} edit={edits[i.id]}>
                <TileActions disabled={del.pending} label={i.label} onRemove={() => del.run(() => removeModelImageAction(modelId, i.id), () => router.refresh())} />
              </Tile>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 rounded-xl bg-soft p-3.5">
        <b className="text-[13.5px]">의상·소품 이미지 추가</b>
        <Field label="이름" htmlFor="mi-label"><input id="mi-label" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 앞치마, 정장" /></Field>
        <ImageUploader value={adding} onChange={setAdding} max={6} label="이미지를 올려 주세요" />
        <ErrorLine error={add.error} />
        <div className="flex justify-end">
          <Button
            tone="primary"
            disabled={!adding.length || add.pending}
            onClick={() => {
              if (SHOT_LABELS.has(label.trim())) return add.setError('각도 세트 컷 이름과 겹쳐요. 다른 이름을 써 주세요.')
              add.run(() => addModelImagesAction(modelId, adding.map((a) => a.path), label), () => { setAdding([]); toast('이미지를 추가했어요'); router.refresh() })
            }}
          >
            {add.pending ? '저장 중…' : `${adding.length}장 추가`}
          </Button>
        </div>
      </div>
      <Dialog
        open={!!viewing}
        onClose={() => setViewKey(null)}
        title={
          viewing && (
            <>
              {viewing.label} <span className="ml-1 text-[12.5px] font-normal text-ink-soft tabular-nums">{at + 1} / {gallery.length}</span>
            </>
          )
        }
        wide
        footer={
          viewing?.id ? (
            <>
              <ErrorLine error={cov.error} />
              <Button
                tone="primary"
                disabled={cov.pending || busy}
                onClick={() => {
                  const id = viewing.id!
                  cov.run(() => setModelCoverAction(modelId, id), () => {
                    setViewKey(null)
                    toast('대표 이미지를 바꿨어요')
                    router.refresh()
                  })
                }}
              >
                {cov.pending ? '바꾸는 중…' : '대표 이미지로 설정'}
              </Button>
            </>
          ) : (
            <span className="text-[12.5px] text-ink-soft">지금 대표 이미지예요</span>
          )
        }
      >
        {viewing && (
          <div className="grid gap-3">
            {viewing.id && edits[viewing.id]?.status === 'done' && edits[viewing.id].drafts.length ? (
              // 수정본이 있으면 지금 사진과 나란히 보여 주고 고르게 한다
              <Compare key={`cmp-${viewing.id}`} modelId={modelId} imageId={viewing.id} label={viewing.label} current={viewing.url} edit={edits[viewing.id]} />
            ) : (
              <div className="relative grid place-items-center rounded-xl bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewing.url} alt={viewing.label} className="max-h-[52vh] w-auto max-w-full object-contain" />
                <NavButton side="left" target={prev} disabled={cov.pending} onClick={() => go(prev)} />
                <NavButton side="right" target={next} disabled={cov.pending} onClick={() => go(next)} />
              </div>
            )}
            {viewing.id && (
              <EditPanel key={`edit-${viewing.id}`} modelId={modelId} imageId={viewing.id} isShot={SHOT_LABELS.has(viewing.label)} edit={edits[viewing.id]} />
            )}
            {viewing.id && (
              <p className="text-[12px] leading-relaxed text-ink-soft">
                {busy
                  ? '각도 세트를 만드는 중에는 대표를 바꿀 수 없어요. 끝난 뒤 다시 눌러 주세요.'
                  : '대표로 바꾸면 지금 대표는 "이전 대표"로 남아요. 이미 만든 각도 세트는 예전 대표 얼굴 기준이에요.'}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}

/* ───────── 컷 수정 ───────── */

/** 고칠 내용을 적고 수정본 2장을 만든다. 이어서 고칠 수정본을 골랐으면 그 사진을 바탕으로 고친다. */
function EditPanel({ modelId, imageId, isShot, edit }: { modelId: string; imageId: string; isShot: boolean; edit?: ShotEdit }) {
  const router = useRouter()
  const req = useAction()
  const [text, setText] = useState('')
  const running = editing(edit)
  const hasDrafts = edit?.status === 'done' && edit.drafts.length > 0
  const ask = (mode: 'edit' | 'fresh', basePath?: string) =>
    req.run(() => requestShotEditAction(modelId, imageId, { mode, instruction: mode === 'edit' ? text : undefined, basePath }), () => router.refresh())

  if (running) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-soft p-3.5 text-[13px]">
        <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        <span>
          {edit!.mode === 'fresh' ? '처음부터 다시 그린 수정본' : `"${edit!.instruction}"`} 2장을 만들고 있어요. 보통 1분 안팎이에요. 창을 닫아도 계속 만들어요.
        </span>
      </div>
    )
  }
  return (
    <div className="grid gap-2.5 rounded-xl bg-soft p-3.5">
      <label htmlFor="edit-text" className="text-[13px] font-bold">
        {hasDrafts ? '수정본이 다 마음에 안 들면 지금 사진에서 다시 고치기' : '이 사진 고치기'}
      </label>
      <textarea
        id="edit-text"
        className={`${inputCls} min-h-[64px] resize-y py-2`}
        value={text}
        maxLength={300}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 얼굴만 조금 더 작게, 나머지는 그대로"
      />
      <div className="flex flex-wrap gap-1.5">
        {EDIT_SUGGESTIONS.map((t) => (
          <button key={t} type="button" onClick={() => setText((v) => (v.trim() ? `${v.trim()}, ${t}` : t))} className="rounded-full border border-line bg-card px-2.5 py-0.5 text-[12px] text-ink-soft hover:border-accent hover:text-accent">
            + {t}
          </button>
        ))}
      </div>
      {edit?.status === 'failed' && <ErrorLine error={`수정본을 만들지 못했어요: ${edit.error ?? '알 수 없는 오류'}`} />}
      <ErrorLine error={req.error} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isShot && (
          <Button disabled={req.pending} onClick={() => ask('fresh')} title="고칠 내용 없이 이 각도를 처음부터 다시 그려요">
            처음부터 다시 그리기
          </Button>
        )}
        <Button tone="primary" disabled={req.pending || !text.trim()} onClick={() => ask('edit')}>
          {req.pending ? '요청하는 중…' : '수정본 2장 만들기'}
        </Button>
      </div>
      <p className="text-[11.5px] text-ink-soft">지금 사진은 고를 때까지 그대로예요. 만든 수정본을 나란히 보고 골라 교체해요.</p>
      {hasDrafts && <ContinueHint />}
    </div>
  )
}

function ContinueHint() {
  return <p className="text-[11.5px] text-ink-soft">수정본 하나를 바탕으로 더 고치려면 위에서 그 수정본의 &quot;이어서 고치기&quot;를 눌러요.</p>
}

/** 지금 사진과 수정본을 나란히 — 하나 골라 교체하거나, 그걸 바탕으로 이어서 고치거나, 모두 버린다 */
function Compare({ modelId, imageId, label, current, edit }: { modelId: string; imageId: string; label: string; current: string; edit: ShotEdit }) {
  const router = useRouter()
  const toast = useToast()
  const act = useAction()
  const [cont, setCont] = useState<{ path: string; n: number } | null>(null)
  const [text, setText] = useState('')
  const cell = 'grid content-start gap-1.5'
  const pic = 'aspect-[2/3] w-full rounded-lg bg-soft object-contain'
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2.5">
        <figure className={cell}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={`${label} 지금`} className={pic} />
          <figcaption className="text-center text-[12px] font-bold">지금</figcaption>
        </figure>
        {edit.drafts.map((d, i) => (
          <figure key={d.path} className={cell}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.url ? <img src={d.url} alt={`${label} 수정본 ${i + 1}`} className={pic} /> : <div className={pic} />}
            <figcaption className="text-center text-[12px] text-ink-soft">수정본 {i + 1}</figcaption>
            <Button
              tone="primary"
              size="sm"
              disabled={act.pending}
              onClick={() => act.run(() => applyShotEditAction(modelId, imageId, d.path), () => { toast(`${label}을(를) 수정본 ${i + 1}로 바꿨어요`); router.refresh() })}
            >
              이걸로 교체
            </Button>
            <Button size="sm" disabled={act.pending} onClick={() => setCont({ path: d.path, n: i + 1 })}>
              이어서 고치기
            </Button>
          </figure>
        ))}
      </div>
      <p className="text-[12px] text-ink-soft">{edit.mode === 'fresh' ? '처음부터 다시 그린 수정본이에요.' : `고친 내용: ${edit.instruction}`}</p>
      {cont && (
        <div className="grid gap-2 rounded-xl border border-accent p-3">
          <label htmlFor="cont-text" className="text-[13px] font-bold">수정본 {cont.n}을 바탕으로 더 고치기</label>
          <textarea id="cont-text" className={`${inputCls} min-h-[56px] resize-y py-2`} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="예: 조금만 더 작게" />
          <div className="flex justify-end gap-2">
            <Button size="sm" tone="ghost" onClick={() => setCont(null)}>취소</Button>
            <Button
              size="sm"
              tone="primary"
              disabled={act.pending || !text.trim()}
              onClick={() => act.run(() => requestShotEditAction(modelId, imageId, { mode: 'edit', instruction: text, basePath: cont.path }), () => router.refresh())}
            >
              이어서 2장 만들기
            </Button>
          </div>
        </div>
      )}
      <ErrorLine error={act.error} />
      <div className="flex justify-end">
        <Button size="sm" tone="ghost" disabled={act.pending} onClick={() => act.run(() => discardShotEditAction(modelId, imageId), () => { toast('수정본을 버렸어요'); router.refresh() })}>
          수정본 모두 버리기
        </Button>
      </div>
    </div>
  )
}

function Tile({ label, url, strong, onOpen, edit, children }: { label: string; url: string | null; strong?: boolean; onOpen?: () => void; edit?: ShotEdit; children?: React.ReactNode }) {
  return (
    <figure className="grid gap-1">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-soft">
        {/* 누르면 크게 보기. 위쪽 ↻ · ✕ 는 이 버튼 위에 따로 떠 있다 */}
        {url && onOpen ? (
          <button type="button" onClick={onOpen} className="block size-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent" aria-label={`${label} 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover transition hover:opacity-90" />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          url && <img src={url} alt={label} className="size-full object-cover" />
        )}
        {children}
        {edit && (editing(edit) || edit.drafts.length > 0 || edit.status === 'failed') && (
          <span className={`pointer-events-none absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white ${edit.status === 'failed' ? 'bg-bad' : 'bg-accent'}`}>
            {editing(edit) ? '수정 중…' : edit.status === 'failed' ? '수정 실패' : '수정본 있음'}
          </span>
        )}
      </div>
      <figcaption className={strong ? 'text-center text-[12px] font-bold' : 'text-center text-[12px] text-ink-soft'}>{label}</figcaption>
    </figure>
  )
}

/** 크게 보기의 ‹ › — 처음·끝에서는 흐리게 두고 누르지 못하게 한다 */
function NavButton({ side, target, disabled, onClick }: { side: 'left' | 'right'; target: Viewing | null; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!target || disabled}
      aria-label={target ? `${side === 'left' ? '이전' : '다음'}: ${target.label}` : side === 'left' ? '처음 이미지예요' : '마지막 이미지예요'}
      title={target?.label}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[22px] leading-none text-white transition hover:bg-black/65 disabled:opacity-0 ${side === 'left' ? 'left-2.5' : 'right-2.5'}`}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}

function TileActions({ label, disabled, onReshoot, onRemove }: { label: string; disabled: boolean; onReshoot?: () => void; onRemove: () => void }) {
  const cls = 'grid size-6 place-items-center rounded-full bg-black/55 text-[11px] text-white disabled:opacity-40'
  return (
    <div className="absolute top-1.5 right-1.5 flex gap-1">
      {onReshoot && (
        <button type="button" className={cls} disabled={disabled} aria-label={`${label} 고치기·다시 뽑기`} title="고치기·다시 뽑기" onClick={onReshoot}>
          ↻
        </button>
      )}
      <button type="button" className={cls} disabled={disabled} aria-label={`${label} 이미지 지우기`} title="지우기" onClick={onRemove}>
        ✕
      </button>
    </div>
  )
}
