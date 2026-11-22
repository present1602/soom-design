import { PLATFORM_INFO, PLATFORMS, type Platform } from '@marketing/core/channels'
import type { StoreChannel } from '@marketing/core/types'
import { cx } from './ui'

const BG: Record<Platform, string> = {
  instagram: 'bg-[linear-gradient(135deg,#f2a03d,#d8317e_55%,#7a3bd1)] text-white',
  youtube: 'bg-[#e5312a] text-white',
  threads: 'bg-[#1a1a1a] text-white',
  kakao: 'bg-[#f4d500] text-[#2b2400]',
}

/** 플랫폼 아이콘. href 를 주면 새 탭으로 그 게시물을 연다. off = 미등록(흐리게), warn = 연결 문제(주황 점). */
export function ChannelIcon({ platform, href, off, warn, size = 22, title }: { platform: Platform; href?: string | null; off?: boolean; warn?: boolean; size?: number; title?: string }) {
  const info = PLATFORM_INFO[platform]
  const cls = cx(
    'relative inline-grid shrink-0 place-items-center rounded-md font-semibold tracking-tight',
    BG[platform],
    off && 'opacity-30 grayscale',
    href && 'transition hover:-translate-y-px',
  )
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  const body = (
    <>
      {info.short}
      {warn && <i className="absolute -top-1 -right-1 size-2 rounded-full border-2 border-card bg-warn" />}
    </>
  )
  const label = title ?? `${info.name}${off ? ' 미등록' : ''}`
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style} title={`${info.name}에서 보기`} aria-label={`${info.name}에서 보기`}>
      {body}
    </a>
  ) : (
    <span className={cls} style={style} title={label} aria-label={label}>
      {body}
    </span>
  )
}

/** 매장의 채널 네 칸 (등록 안 된 건 흐리게) */
export function ChannelStrip({ channels }: { channels: Pick<StoreChannel, 'platform' | 'status' | 'handle'>[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {PLATFORMS.map((p) => {
        const c = channels.find((x) => x.platform === p)
        return <ChannelIcon key={p} platform={p} off={!c} warn={c?.status === 'expired' || c?.status === 'pending'} title={c ? `${PLATFORM_INFO[p].name} · ${c.handle}${c.status === 'pending' ? ' (허용 대기)' : c.status === 'expired' ? ' (연결 만료)' : ''}` : undefined} />
      })}
    </span>
  )
}

export const CHANNEL_STATUS: Record<StoreChannel['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' }> = {
  connected: { label: '연결됨', tone: 'ok' },
  manager: { label: '매니저 초대됨', tone: 'ok' },
  pending: { label: '허용 대기', tone: 'info' },
  expired: { label: '연결 만료', tone: 'bad' },
}
