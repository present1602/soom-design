import Link from 'next/link'
import { PLATFORM_INFO } from '@marketing/core/channels'
import type { ContentRow } from '@/lib/data'
import { shortDate } from '@/lib/format'
import { ChannelIcon } from './channel-icon'
import { OriginalButton } from './original-dialog'
import { Pill } from './ui'

const STATUS = {
  generating: ['생성 중', 'accent'],
  ready: ['업로드 전', 'warn'],
  failed: ['생성 실패', 'bad'],
  published: ['발행됨', 'ok'],
} as const

/* 제목·썸네일을 누르면 실제로 올라간 게시물이 새 탭에서 열린다(첫 채널).
   우리가 만든 원본은 "원본 보기"로 본다. 아직 안 올라간 건 생성 화면으로 간다. */
export function ContentTable({ rows, showStore }: { rows: ContentRow[]; showStore?: boolean }) {
  if (!rows.length) return <p className="px-1 py-8 text-center text-ink-soft">콘텐츠가 없어요.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-[12.5px] whitespace-nowrap text-ink-soft [&>th]:border-b [&>th]:border-line [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium">
            <th className="w-[52px]" />
            <th>콘텐츠</th>
            {showStore && <th>고객사 · 매장</th>}
            <th>유형</th>
            <th>올라간 채널</th>
            <th>모델</th>
            <th>담당자</th>
            <th>{rows.some((r) => r.published_at) ? '업로드' : '만든 날'}</th>
            <th />
          </tr>
        </thead>
        <tbody className="[&>tr>td]:border-b [&>tr>td]:border-line [&>tr>td]:px-2.5 [&>tr>td]:py-2.5 [&>tr:last-child>td]:border-b-0">
          {rows.map((r) => {
            const done = r.posts.filter((p) => p.status === 'done' && p.post_url)
            const href = done[0]?.post_url ?? null
            const internal = `/create/${r.store_id}/${r.type}?content=${r.id}`
            const thumb = (
              <span className="block aspect-[9/16] w-10 overflow-hidden rounded-md bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumbUrl && <img src={r.thumbUrl} alt="" className="size-full object-cover" />}
              </span>
            )
            const title = (
              <>
                <b className="font-medium">{r.title || '(제목 없음)'}</b> {href && <span className="text-[12px] text-ink-soft">↗</span>}
              </>
            )
            return (
              <tr key={r.id}>
                <td>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{thumb}</a> : <Link href={internal}>{thumb}</Link>}</td>
                <td className="min-w-[180px]">
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{title}</a> : <Link href={internal} className="hover:text-accent">{title}</Link>}
                  <div className="text-[12px] text-ink-soft">
                    {r.type === 'short' ? `${r.settings.length ?? 10}초 · 9:16` : `${r.settings.size ?? '1:1'} 이미지`}
                    {r.moods.length > 0 && ` · ${r.moods.join(', ')}`}
                    {r.settings.mock && ' · 모의 생성'}
                  </div>
                </td>
                {showStore && (
                  <td className="whitespace-nowrap">
                    <Link href={`/stores/${r.store_id}`} className="hover:text-accent">{r.clientName}</Link> <span className="text-ink-soft">{r.storeName}</span>
                  </td>
                )}
                <td>
                  <Pill tone={r.type === 'short' ? 'accent' : 'info'}>{r.type === 'short' ? 'AI 숏폼' : 'AI 배너'}</Pill>
                  {r.status !== 'published' && (
                    <div className="mt-1">
                      <Pill tone={STATUS[r.status][1]} dot>{STATUS[r.status][0]}</Pill>
                    </div>
                  )}
                </td>
                <td>
                  <span className="inline-flex gap-1">
                    {r.posts.map((p) =>
                      p.status === 'done' ? (
                        <ChannelIcon key={p.id} platform={p.platform} href={p.post_url} />
                      ) : (
                        <ChannelIcon key={p.id} platform={p.platform} off warn={p.status === 'failed' || p.status === 'manual'} title={`${PLATFORM_INFO[p.platform].name} · ${p.status === 'failed' ? '실패' : p.status === 'manual' ? '직접 올리기 대기' : '올리는 중'}`} />
                      ),
                    )}
                    {!r.posts.length && <span className="text-[12px] text-ink-soft">—</span>}
                  </span>
                </td>
                <td className="whitespace-nowrap">{r.modelName ?? '—'}</td>
                <td className="whitespace-nowrap">{r.byName ?? '—'}</td>
                <td className="text-[12.5px] whitespace-nowrap tabular">{shortDate(r.published_at ?? r.created_at)}</td>
                <td className="text-right">
                  <OriginalButton contentId={r.id} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
