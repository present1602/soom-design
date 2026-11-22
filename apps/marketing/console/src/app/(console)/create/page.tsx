import type { Metadata } from 'next'
import Link from 'next/link'
import { ChannelStrip } from '@/components/channel-icon'
import { Card, PageHead } from '@/components/ui'
import { listClientGroups } from '@/lib/data'
import { shortDate, str } from '@/lib/format'
import { requireStaff } from '@/lib/staff'
import { CreateSteps } from './steps'
import { StoreInfoButton } from './store-info-button'
import { StoreSearch } from './store-search'

export const metadata: Metadata = { title: '콘텐츠 생성' }

export default async function CreatePick({ searchParams }: PageProps<'/create'>) {
  const staff = await requireStaff()
  const q = str((await searchParams).q)
  const groups = (await listClientGroups(staff, q)).filter((g) => g.stores.length)
  return (
    <>
      <PageHead title="콘텐츠 생성" sub="어느 매장·브랜드의 콘텐츠를 만들까요?" />
      <CreateSteps at={1} />
      <Card className="grid gap-4">
        <StoreSearch q={q} />
        {groups.map(({ client, stores }) => (
          <div key={client.id}>
            <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-ink-soft">
              <b className="text-[13.5px] text-ink">{client.name}</b>
              <span className="tabular">{client.code}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
              {stores.map((s) => (
                // 카드 전체가 링크라 "정보" 버튼은 링크 밖에서 카드 위에 겹쳐 둔다(링크 안에 버튼을 넣을 수 없다)
                <div key={s.id} className="relative">
                  <Link href={`/create/${s.id}`} className="grid h-full gap-1.5 rounded-xl border-[1.5px] border-line bg-card p-3.5 pr-14 hover:border-accent">
                    <b>
                      {s.name}
                      {s.kind === 'brand' && <span className="ml-1.5 rounded border border-line px-1.5 text-[11.5px] font-normal text-ink-soft">브랜드</span>}
                    </b>
                    <ChannelStrip channels={s.channels} />
                    <span className="text-[12.5px] text-ink-soft">최근 업로드 {shortDate(s.lastUpload)}</span>
                  </Link>
                  <StoreInfoButton storeId={s.id} storeName={`${client.name} ${s.name}`} className="absolute top-3 right-3" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p className="text-ink-soft">{q ? '찾는 매장이 없어요.' : '콘텐츠를 만들 수 있는 매장이 없어요. 고객사 관리에서 매장을 먼저 등록하거나 할당받아 주세요.'}</p>}
      </Card>
    </>
  )
}
