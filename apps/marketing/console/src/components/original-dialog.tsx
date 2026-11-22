'use client'

import { useState } from 'react'
import { PLATFORM_INFO } from '@marketing/core/channels'
import type { ContentView } from '@/app/api/contents/[id]/route'
import { ChannelIcon } from './channel-icon'
import { Dialog } from './dialog'
import { Button, ErrorLine, btn } from './ui'

/** 우리가 만든 원본(영상·배너·프롬프트·첨부)을 보는 창. 열 때 서명 링크를 받아 온다. */
export function OriginalButton({ contentId }: { contentId: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<ContentView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const show = async () => {
    setOpen(true)
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/contents/${contentId}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? '불러오지 못했어요')
      setView(j as ContentView)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }

  const main = view?.videoUrl ?? view?.variants.find((v) => v.selected)?.url ?? null
  return (
    <>
      <Button size="sm" onClick={show}>원본 보기</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="원본 보기" wide footer={main && <a className={btn()} href={main} target="_blank" rel="noopener noreferrer" download>원본 파일 열기</a>}>
        {loading && <p className="text-ink-soft">불러오는 중…</p>}
        <ErrorLine error={error} />
        {view && (
          <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-xl bg-soft">
              {view.videoUrl ? (
                <video src={view.videoUrl} poster={view.thumbUrl ?? undefined} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
              ) : main ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={main} alt="결과 이미지" className="w-full" />
              ) : (
                <p className="p-4 text-[12.5px] text-ink-soft">결과 파일이 아직 없어요.</p>
              )}
            </div>
            <div className="grid content-start gap-3 text-[13.5px]">
              <div>
                <h3 className="font-bold">{view.content.title || '(제목 없음)'}</h3>
                <p className="text-[12.5px] text-ink-soft">
                  {view.clientName} {view.storeName} · {view.content.type === 'short' ? 'AI 숏폼' : 'AI 배너'}
                  {view.content.settings.mock && ' · 모의 생성'}
                </p>
              </div>
              <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-soft">모델</dt>
                <dd>{view.modelName ?? '—'}</dd>
                <dt className="text-ink-soft">분위기</dt>
                <dd>{view.content.moods.join(', ') || '—'}</dd>
                <dt className="text-ink-soft">프롬프트</dt>
                <dd className="whitespace-pre-wrap">{view.content.prompt}</dd>
                <dt className="text-ink-soft">제품 이미지</dt>
                <dd>{view.products.length}장</dd>
              </dl>
              {view.products.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {view.products.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="제품" className="size-14 rounded-md border border-line object-cover" />
                  ))}
                </div>
              )}
              <div>
                <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">올라간 곳</div>
                {view.posts.length ? (
                  <ul className="grid gap-1.5">
                    {view.posts.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <ChannelIcon platform={p.platform} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">
                          {p.post_url ?? (p.status === 'failed' ? `실패: ${p.error}` : p.status === 'manual' ? '직접 올리기 대기' : '올리는 중')}
                        </span>
                        {p.post_url && <a className={btn({ size: 'sm' })} href={p.post_url} target="_blank" rel="noopener noreferrer">{PLATFORM_INFO[p.platform].name}에서 열기 ↗</a>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-ink-soft">아직 올리지 않았어요.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
