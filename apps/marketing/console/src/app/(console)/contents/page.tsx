import type { Metadata } from 'next'
import { ContentTable } from '@/components/content-table'
import { Pager } from '@/components/pager'
import { Card, LinkButton, PageHead } from '@/components/ui'
import { listClientGroups, listContents } from '@/lib/data'
import { pageOf, str } from '@/lib/format'
import { requireStaff } from '@/lib/staff'
import { ContentFilters } from './filters'

export const metadata: Metadata = { title: '콘텐츠 관리' }

export default async function ContentsPage({ searchParams }: PageProps<'/contents'>) {
  const staff = await requireStaff()
  const sp = await searchParams
  const f = { q: str(sp.q), client: str(sp.client), type: str(sp.type), ch: str(sp.ch), scope: str(sp.scope) === 'all' ? 'all' : 'published' } as const
  const page = pageOf(sp.page)
  const [{ rows, total }, groups] = await Promise.all([
    listContents({ storeIds: staff.storeIds, q: f.q, clientId: f.client || undefined, type: f.type || undefined, platform: f.ch || undefined, scope: f.scope }, page),
    listClientGroups(staff, ''),
  ])
  const pages = Math.max(1, Math.ceil(total / 10))
  return (
    <>
      <PageHead title="콘텐츠 관리" sub="모든 고객사의 콘텐츠를 모아 봐요. 고객사별로는 매장 상세의 콘텐츠 탭에서 볼 수 있어요" action={<LinkButton tone="primary" href="/create">콘텐츠 생성</LinkButton>} />
      <Card className="px-3 pt-3 pb-3.5">
        <ContentFilters value={f} clients={groups.filter((g) => g.stores.length).map((g) => ({ id: g.client.id, name: g.client.name }))} />
        <ContentTable rows={rows} showStore />
        <Pager path="/contents" params={{ q: f.q, client: f.client, type: f.type, ch: f.ch, scope: f.scope === 'all' ? 'all' : '' }} page={Math.min(page, pages)} pages={pages} info={`${total}건 · 최신순`} />
      </Card>
    </>
  )
}
