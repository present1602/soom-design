'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PLATFORM_INFO, supports, type Platform } from '@marketing/core/channels'
import type { ChannelStatus, ContentPost } from '@marketing/core/types'
import type { AssetView, ContentView } from '@/app/api/contents/[id]/route'
import { markManualPostedAction, publishContentAction, regenerateAction, selectAssetAction } from '@/actions/create'
import { CHANNEL_STATUS, ChannelIcon } from '@/components/channel-icon'
import { Dialog } from '@/components/dialog'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine, Field, LinkButton, Note, Pill, btn, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

export type StoreInfo = { id: string; name: string; address: string; hours: string }
export type ChannelOpt = { id: string; platform: Platform; handle: string; status: ChannelStatus; profileUrl: string }

function defaultCaption(platform: Platform, title: string, store: StoreInfo) {
  const tag = `#${store.name.replace(/\s/g, '')}`
  if (platform === 'youtube') return `${title} | ${store.name} #shorts`.slice(0, 100)
  if (platform === 'threads') return [title, [store.address, store.hours].filter(Boolean).join(' · ')].filter(Boolean).join('\n')
  return [title, store.address && `📍 ${store.address}`, store.hours && `⏰ ${store.hours}`, tag].filter(Boolean).join('\n')
}

export function ResultPanel({ contentId, type, store, channels, prompt }: { contentId: string | null; type: 'short' | 'banner'; store: StoreInfo; channels: ChannelOpt[]; prompt: string }) {
  const isShort = type === 'short'
  const toast = useToast()
  const [view, setView] = useState<ContentView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [caps, setCaps] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [manual, setManual] = useState<ContentPost | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const pick = useAction()
  const pub = useAction()
  const regen = useAction()
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    if (!contentId) return null
    try {
      const res = await fetch(`/api/contents/${contentId}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? '불러오지 못했어요')
      setView(j as ContentView)
      setLoadError(null)
      return j as ContentView
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '불러오지 못했어요')
      return null
    }
  }, [contentId])

  // 만드는 중이거나 올리는 중이면 2.5초마다 다시 묻는다
  useEffect(() => {
    if (!contentId) return
    let stop = false
    const loop = async () => {
      const v = await load()
      if (stop) return
      const busy = !v || v.content.status === 'generating' || v.posts.some((p) => p.status === 'queued' || p.status === 'uploading')
      setNow(Date.now())
      if (busy) timer.current = window.setTimeout(loop, 2500)
    }
    loop()
    return () => {
      stop = true
      window.clearTimeout(timer.current)
    }
  }, [contentId, load])

  const kick = () => {
    window.clearTimeout(timer.current)
    const loop = async () => {
      const v = await load()
      setNow(Date.now())
      if (!v || v.content.status === 'generating' || v.posts.some((p) => p.status === 'queued' || p.status === 'uploading')) timer.current = window.setTimeout(loop, 2500)
    }
    loop()
  }

  if (!contentId) {
    return (
      <Card>
        <h2 className="mb-3 text-[16px] font-bold">결과</h2>
        <div className="grid justify-items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-2 px-5 py-9 text-center text-ink-soft">
          <b className="text-ink">아직 만든 {isShort ? '영상' : '배너'}이 없어요</b>
          <span className="text-[12.5px]">왼쪽에서 모델·프롬프트·제품 이미지를 넣고 생성하면 여기에 나와요. 그다음 이 매장에 등록된 채널을 골라 바로 올릴 수 있어요.</span>
        </div>
      </Card>
    )
  }
  if (!view) {
    return (
      <Card>
        <p className="text-ink-soft">불러오는 중…</p>
        <ErrorLine error={loadError} />
      </Card>
    )
  }

  const c = view.content
  if (c.status === 'generating') {
    const since = view.job ? Math.max(0, Math.round((now - new Date(view.job.createdAt).getTime()) / 1000)) : 0
    const waiting = view.job?.status === 'queued' && (view.job.attempts ?? 0) === 0
    return (
      <Card className="grid gap-3">
        <h2 className="text-[16px] font-bold">만들고 있어요</h2>
        <div className="h-2 overflow-hidden rounded-full bg-soft">
          <i className="block h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
        <p className="text-[13px]">
          {waiting ? '차례를 기다리는 중' : view.job?.status === 'queued' ? '한 번 실패해서 곧 다시 시도해요' : isShort ? '첫 장면 → 영상 → 9:16 인코딩 → 썸네일 후보' : '모델 + 제품 합성 → 시안 만들기'} · <span className="tabular">{since}초</span>
        </p>
        {view.job?.status === 'queued' && view.job.error && <p className="text-[12.5px] text-warn">지난 시도 실패: {view.job.error}</p>}
        {waiting && since > 20 && <Note tone="warn">20초 넘게 시작되지 않았어요. 워커(apps/marketing/worker)가 켜져 있는지 확인해 주세요.</Note>}
        <p className="text-[12.5px] text-ink-soft">실제 AI 생성은 {isShort ? '영상 한 편에 2–6분' : '30초–1분'} 걸려요. 다른 화면으로 가도 계속 만들고, 콘텐츠 관리의 “만든 것 전체”에서 다시 열 수 있어요.</p>
      </Card>
    )
  }
  if (c.status === 'failed') {
    return (
      <Card className="grid gap-3">
        <h2 className="text-[16px] font-bold">생성에 실패했어요</h2>
        <ErrorLine error={c.error ?? '알 수 없는 이유로 실패했어요.'} />
        <ErrorLine error={regen.error} />
        <div className="flex justify-end">
          <Button tone="primary" disabled={regen.pending} onClick={() => regen.run(() => regenerateAction(c.id), kick)}>같은 값으로 다시 생성</Button>
        </div>
      </Card>
    )
  }

  // ───── 결과 (ready / published) ─────
  const choose = (a: AssetView) => pick.run(() => selectAssetAction(c.id, a.id), kick)
  const usable = channels.filter((ch) => supports(ch.platform, type))
  const postOf = (chId: string) => view.posts.find((p) => p.channel_id === chId)
  const selectable = (ch: ChannelOpt) => {
    const p = postOf(ch.id)
    return !p || p.status === 'failed'
  }
  const chosen = usable.filter((ch) => selectable(ch) && (sel[ch.id] ?? ch.status !== 'pending'))
  const mainUrl = view.videoUrl ?? view.variants.find((v) => v.selected)?.url ?? null
  const anyPosting = view.posts.some((p) => p.status === 'queued' || p.status === 'uploading')
  const captionOf = (ch: ChannelOpt) => caps[ch.id] ?? defaultCaption(ch.platform, c.title || prompt, store)

  return (
    <>
      <Card className="grid gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[16px] font-bold">결과</h2>
          <Pill tone="ok" dot>{c.status === 'published' ? '발행됨' : '완료'}</Pill>
          {c.settings.mock && <Pill tone="warn">모의 생성</Pill>}
          {c.settings.narrated && <span title={c.settings.narration}><Pill tone="accent">내레이션 포함</Pill></span>}
          {c.settings.event && <span title={[c.settings.event.offer, c.settings.event.details].filter(Boolean).join(' · ')}><Pill tone="accent">이벤트: {c.settings.event.title}</Pill></span>}
          {c.settings.siteFeed?.source === 'live' && <Pill tone="info">{c.settings.siteFeed.via === 'homepage' ? '홈페이지 글 반영' : `홈페이지 자료 ${c.settings.siteFeed.items}개 반영`}</Pill>}
          {c.settings.siteFeed?.source === 'cache' && <span title={c.settings.siteFeed.error}><Pill tone="warn">홈페이지: 지난 자료로 대신함</Pill></span>}
          {c.settings.siteFeed?.source === 'none' && c.settings.siteFeed.error && <span title={c.settings.siteFeed.error}><Pill tone="bad">홈페이지 못 읽음</Pill></span>}
          <Button size="sm" className="ml-auto" onClick={() => setPreview(true)}>미리보기</Button>
        </div>
        {isShort ? (
          <>
            <div className="grid gap-3.5 sm:grid-cols-[200px_1fr]">
              {/* key 로 서명 링크가 바뀌어도 재생 위치를 잃지 않게 콘텐츠 id 기준으로 둔다 */}
              <video key={c.id} src={view.videoUrl ?? undefined} poster={view.thumbUrl ?? undefined} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black object-contain" />
              <div className="grid content-start gap-2 text-[13px]">
                <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 [&>dt]:text-ink-soft">
                  <dt>모델</dt>
                  <dd>{view.modelName ?? '—'}</dd>
                  <dt>분위기</dt>
                  <dd>{c.moods.join(', ') || '—'}</dd>
                  <dt>길이</dt>
                  <dd>{c.settings.length ?? 10}초 · 1080×1920</dd>
                  <dt>첫 장면</dt>
                  <dd>{{ none: 'AI가 정함', upload: '직접 올림', ai: 'AI 합성' }[c.settings.firstFrame ?? 'none']}</dd>
                  <dt>제품 이미지</dt>
                  <dd>{view.products.length}장</dd>
                </dl>
                {c.status !== 'published' && <Button size="sm" className="justify-self-start" disabled={regen.pending} onClick={() => regen.run(() => regenerateAction(c.id), kick)}>다시 생성</Button>}
                <ErrorLine error={regen.error} />
              </div>
            </div>
            <div className="grid gap-2 border-t border-line pt-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">썸네일</h3>
                <span className="text-[12.5px] text-ink-soft">{c.settings.thumbMode === 'upload' ? '직접 올린 이미지를 써요. 추천 중에서 골라도 돼요' : 'AI 추천 4개 중 하나를 고르세요'}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {view.uploadedThumb && <ThumbPick a={view.uploadedThumb} label="직접 올림" onPick={choose} disabled={pick.pending} />}
                {view.thumbCandidates.slice(0, view.uploadedThumb ? 3 : 4).map((a, i) => (
                  <ThumbPick key={a.id} a={a} label={i === 0 ? 'AI 추천' : undefined} onPick={choose} disabled={pick.pending} />
                ))}
              </div>
              <ErrorLine error={pick.error} />
            </div>
          </>
        ) : (
          <>
            <div className={cx('grid gap-2', view.variants.length > 1 && 'grid-cols-2')}>
              {view.variants.map((v, i) => (
                <button key={v.id} type="button" onClick={() => choose(v)} disabled={pick.pending || v.selected} aria-pressed={v.selected} className={cx('overflow-hidden rounded-xl border-2', v.selected ? 'border-accent' : 'border-transparent hover:border-line-2')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.url && <img src={v.url} alt={`시안 ${i + 1}`} className="w-full" />}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-ink-soft">
                {c.settings.size} · 모델 {view.modelName} · 고른 시안 {view.variants.findIndex((v) => v.selected) + 1}
              </span>
              {c.status !== 'published' && <Button size="sm" disabled={regen.pending} onClick={() => regen.run(() => regenerateAction(c.id), kick)}>다시 생성</Button>}
            </div>
            <ErrorLine error={pick.error ?? regen.error} />
          </>
        )}
      </Card>

      <Card className="grid gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold">업로드할 채널</h2>
          <Link href={`/stores/${store.id}/channels`} className="ml-auto text-[12.5px] text-accent">채널 관리</Link>
        </div>
        {channels.length === 0 && <Note tone="warn">이 매장에 등록된 채널이 없어요. 채널 관리에서 먼저 등록해 주세요.</Note>}
        {channels.map((ch) => {
          const ok = supports(ch.platform, type)
          const p = postOf(ch.id)
          const on = ok && chosen.some((x) => x.id === ch.id)
          return (
            <div key={ch.id} className={cx('grid gap-2.5 rounded-xl border p-3', on ? 'border-accent' : 'border-line', !ok && 'opacity-55')}>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-accent" checked={on} disabled={!ok || !selectable(ch) || anyPosting} onChange={(e) => setSel({ ...sel, [ch.id]: e.target.checked })} />
                  <ChannelIcon platform={ch.platform} size={24} />
                  <b>{PLATFORM_INFO[ch.platform].name}</b>
                </label>
                <span className="text-[12.5px] text-ink-soft">{ch.handle}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {!ok ? (
                    <Pill>{isShort ? '영상 미지원' : '이미지 미지원'}</Pill>
                  ) : p?.status === 'done' ? (
                    p.post_url && <a className={btn({ tone: 'primary', size: 'sm' })} href={p.post_url} target="_blank" rel="noopener noreferrer">게시물 보기 ↗</a>
                  ) : p?.status === 'manual' ? (
                    <Button size="sm" tone="primary" onClick={() => setManual(p)}>직접 올리기</Button>
                  ) : p?.status === 'queued' || p?.status === 'uploading' ? (
                    <Pill tone="accent" dot>올리는 중…</Pill>
                  ) : p?.status === 'failed' ? (
                    <Pill tone="bad" dot>실패</Pill>
                  ) : PLATFORM_INFO[ch.platform].api ? (
                    <Pill tone="accent">자동 업로드</Pill>
                  ) : (
                    <Pill tone="warn">직원이 직접</Pill>
                  )}
                </div>
              </div>
              {on && (
                <textarea
                  className={cx(inputCls, 'text-[13px]')}
                  rows={ch.platform === 'youtube' ? 1 : 3}
                  value={captionOf(ch)}
                  onChange={(e) => setCaps({ ...caps, [ch.id]: e.target.value })}
                  aria-label={`${PLATFORM_INFO[ch.platform].name} ${ch.platform === 'youtube' ? '제목' : '캡션'}`}
                />
              )}
              {on && ch.status === 'pending' && PLATFORM_INFO[ch.platform].api && <p className="text-[12.5px] text-warn">고객이 아직 연결을 허용하지 않은 채널이에요. 실제 업로드 모드에서는 실패해요.</p>}
              {on && ch.status === 'expired' && <p className="text-[12.5px] text-warn">연결이 만료된 채널이에요. 실제 업로드 모드에서는 실패해요.</p>}
              {p?.status === 'failed' && <p className="text-[12.5px] text-bad">{p.error}</p>}
              {!on && ok && ch.status !== 'connected' && ch.status !== 'manager' && !p && <span className="text-[12px] text-ink-soft">{CHANNEL_STATUS[ch.status].label}</span>}
            </div>
          )
        })}
        <ErrorLine error={pub.error} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {c.status === 'published' && <LinkButton href="/contents">콘텐츠 관리에서 보기</LinkButton>}
          <Button onClick={() => setPreview(true)} disabled={!chosen.length}>채널별 미리보기</Button>
          <Button
            tone="primary"
            size="lg"
            disabled={!chosen.length || pub.pending || anyPosting}
            onClick={() =>
              pub.run(() => publishContentAction(c.id, chosen.map((ch) => ({ channelId: ch.id, caption: captionOf(ch) }))), () => {
                toast(chosen.some((ch) => !PLATFORM_INFO[ch.platform].api) ? '업로드를 시작했어요. 카카오는 직접 올리기로 마무리해 주세요' : '업로드를 시작했어요')
                setSel({})
                kick()
              })
            }
          >
            {pub.pending || anyPosting ? '올리는 중…' : `선택한 ${chosen.length}곳에 업로드`}
          </Button>
        </div>
      </Card>

      <PreviewDialog open={preview} onClose={() => setPreview(false)} isShort={isShort} mainUrl={mainUrl} posterUrl={view.thumbUrl} channels={chosen.length ? chosen : usable} captionOf={captionOf} />
      {manual && <ManualDialog post={manual} channel={channels.find((x) => x.id === manual.channel_id)} isShort={isShort} mainUrl={mainUrl} onClose={() => setManual(null)} onDone={() => { setManual(null); toast('카카오 업로드를 완료로 표시했어요'); kick() }} />}
    </>
  )
}

function ThumbPick({ a, label, onPick, disabled }: { a: AssetView; label?: string; onPick: (a: AssetView) => void; disabled: boolean }) {
  return (
    <button type="button" onClick={() => onPick(a)} disabled={disabled || a.selected} aria-pressed={a.selected} className={cx('relative overflow-hidden rounded-lg border-2', a.selected ? 'border-accent' : 'border-transparent hover:border-line-2')}>
      {label && <span className="absolute top-1 left-1 rounded-full bg-accent-weak px-1.5 text-[10.5px] font-bold text-accent">{label}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.url && <img src={a.url} alt="" className="aspect-[9/16] w-full object-cover" />}
    </button>
  )
}

function PreviewDialog({ open, onClose, isShort, mainUrl, posterUrl, channels, captionOf }: { open: boolean; onClose: () => void; isShort: boolean; mainUrl: string | null; posterUrl: string | null; channels: ChannelOpt[]; captionOf: (c: ChannelOpt) => string }) {
  const [tab, setTab] = useState<string | null>(null)
  const cur = channels.find((c) => c.id === tab) ?? channels[0]
  return (
    <Dialog open={open} onClose={onClose} title="업로드 전 미리보기" wide>
      {!cur ? (
        <p className="text-ink-soft">미리 볼 채널이 없어요.</p>
      ) : (
        <>
          <div className="flex gap-0.5 overflow-x-auto border-b border-line">
            {channels.map((c) => (
              <button key={c.id} type="button" onClick={() => setTab(c.id)} className={cx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 whitespace-nowrap', c.id === cur.id ? 'border-ink font-bold' : 'border-transparent text-ink-soft')}>
                <ChannelIcon platform={c.platform} size={18} /> {PLATFORM_INFO[c.platform].name}
              </button>
            ))}
          </div>
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-2 p-2.5 text-[13px] font-bold">
              <ChannelIcon platform={cur.platform} size={22} /> {cur.handle}
            </div>
            {isShort ? (
              <video src={mainUrl ?? undefined} poster={posterUrl ?? undefined} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              mainUrl && <img src={mainUrl} alt="배너" className="w-full" />
            )}
            <p className="p-2.5 text-[12.5px] whitespace-pre-line">{captionOf(cur)}</p>
          </div>
          <p className="text-center text-[12px] text-ink-soft">실제 화면과 글자 줄바꿈·잘림은 조금 다를 수 있어요.</p>
        </>
      )}
    </Dialog>
  )
}

function ManualDialog({ post, channel, isShort, mainUrl, onClose, onDone }: { post: ContentPost; channel?: ChannelOpt; isShort: boolean; mainUrl: string | null; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const { pending, error, run } = useAction()
  const capRef = useRef<HTMLTextAreaElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.caption)
      setCopied(true)
    } catch {
      capRef.current?.select()
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="카카오 직접 올리기"
      footer={
        <>
          <Button onClick={onClose}>나중에</Button>
          <Button tone="primary" disabled={pending || !url.trim()} onClick={() => run(() => markManualPostedAction(post.id, url), onDone)}>
            {pending ? '저장 중…' : '완료로 표시'}
          </Button>
        </>
      }
    >
      <ol className="grid gap-3.5 text-[13.5px]">
        <li className="grid gap-1.5">
          <b>1. 파일 받기</b>
          {mainUrl ? <a className={cx(btn({ size: 'sm' }), 'justify-self-start')} href={mainUrl} target="_blank" rel="noopener noreferrer" download>{isShort ? '영상 (.mp4)' : '이미지 (.png)'} 열기</a> : <span className="text-bad">파일이 없어요</span>}
        </li>
        <li className="grid gap-1.5">
          <b>2. 설명 복사</b>
          <textarea ref={capRef} readOnly rows={3} className={cx(inputCls, 'text-[12.5px]')} value={post.caption} aria-label="설명" />
          <Button size="sm" className="justify-self-start" onClick={copy}>{copied ? '복사했어요' : '복사'}</Button>
        </li>
        <li className="grid gap-1.5">
          <b>3. {isShort ? '숏폼 스튜디오' : '톡채널 관리자센터'}에서 올리기</b>
          <span className="text-[12.5px] text-ink-soft">매니저로 초대받은 회사 공용 카카오계정으로 로그인해요{channel ? ` (${channel.handle})` : ''}.</span>
          <a className={cx(btn({ size: 'sm' }), 'justify-self-start')} href={isShort ? 'https://shortform-studio.kakao.com' : 'https://center-pf.kakao.com'} target="_blank" rel="noopener noreferrer">열기 ↗</a>
        </li>
        <li className="grid gap-1.5">
          <Field label="4. 올린 게시물 주소" htmlFor="kk-url">
            <input id="kk-url" className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://pf.kakao.com/…" inputMode="url" />
          </Field>
        </li>
      </ol>
      <ErrorLine error={error} />
    </Dialog>
  )
}
