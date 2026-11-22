import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PLATFORMS, supports } from '@marketing/core/channels'
import { ChannelIcon } from '@/components/channel-icon'
import { PageHead, cx } from '@/components/ui'
import { getStore } from '@/lib/data'
import { canSeeStore, requireStaff } from '@/lib/staff'
import { CreateSteps } from '../steps'
import { PickedStore } from './picked-store'

export default async function CreateType({ params }: PageProps<'/create/[storeId]'>) {
  const staff = await requireStaff()
  const { storeId } = await params
  if (!canSeeStore(staff, storeId)) notFound()
  const d = await getStore(storeId)
  if (!d) notFound()
  const card = 'grid content-start gap-2.5 rounded-xl border-[1.5px] border-line bg-card p-5 text-left'
  const icons = (type: 'short' | 'banner') => (
    <span className="inline-flex gap-1">
      {PLATFORMS.filter((p) => supports(p, type)).map((p) => <ChannelIcon key={p} platform={p} off={!d.channels.some((c) => c.platform === p)} />)}
    </span>
  )
  return (
    <>
      <PageHead title="콘텐츠 생성" crumb={<><Link href="/create">콘텐츠 생성</Link> / {d.client.name} {d.store.name}</>} />
      <CreateSteps at={2} />
      <PickedStore name={`${d.client.name} ${d.store.name}`} code={d.client.code} channels={d.channels} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        <Link href={`/create/${storeId}/short`} className={cx(card, 'hover:border-accent')}>
          <b className="text-[16px]">AI 숏폼</b>
          <span className="text-[12.5px] text-ink-soft">가상 모델과 제품 이미지로 9:16 세로 영상을 만들어요. 인스타 릴스·유튜브 쇼츠·스레드·카카오</span>
          {icons('short')}
        </Link>
        <Link href={`/create/${storeId}/banner`} className={cx(card, 'hover:border-accent')}>
          <b className="text-[16px]">AI 배너광고</b>
          <span className="text-[12.5px] text-ink-soft">모델과 제품을 합성한 광고 이미지를 여러 장 만들고 하나를 골라요. 문구를 얹을 수 있어요</span>
          {icons('banner')}
        </Link>
        <div className={cx(card, 'relative cursor-not-allowed opacity-55')} aria-disabled="true">
          <span className="absolute top-3 right-3 rounded-full bg-soft px-2.5 text-[12px] text-ink-soft">준비 중</span>
          <b className="text-[16px]">AI 포스팅</b>
          <span className="text-[12.5px] text-ink-soft">글과 AI 광고 이미지를 조합하고 순서를 바꿔 게시물을 만들어요. 스레드 등에 써요</span>
        </div>
      </div>
    </>
  )
}
