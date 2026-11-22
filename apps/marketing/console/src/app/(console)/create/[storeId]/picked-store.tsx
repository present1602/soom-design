import type { StoreChannel } from '@marketing/core/types'
import { ChannelStrip } from '@/components/channel-icon'
import { LinkButton } from '@/components/ui'

export function PickedStore({ name, code, channels }: { name: string; code: string; channels: StoreChannel[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <span className="text-[12.5px] text-ink-soft">선택한 매장</span>
      <b>{name}</b>
      <span className="text-[12.5px] text-ink-soft tabular">{code}</span>
      <ChannelStrip channels={channels} />
      <LinkButton size="sm" href="/create" className="ml-auto">매장 바꾸기</LinkButton>
    </div>
  )
}
