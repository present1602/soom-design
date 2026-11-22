import { ContentTable } from '@/components/content-table'
import { Pager } from '@/components/pager'
import { Card, cx } from '@/components/ui'
import Link from 'next/link'
import { listContents } from '@/lib/data'
import { pageOf, str } from '@/lib/format'
import { requireStaff } from '@/lib/staff'

export default async function StoreContents({ params, searchParams }: PageProps<'/stores/[id]/contents'>) {
  await requireStaff()
  const { id } = await params
  const sp = await searchParams
  const scope = str(sp.scope) === 'all' ? 'all' : 'published'
  const page = pageOf(sp.page)
  const { rows, total } = await listContents({ storeIds: [id], scope }, page)
  const pages = Math.max(1, Math.ceil(total / 10))
  return (
    <>
      <Card className="px-3 pt-2 pb-3.5">
        <div className="flex gap-1 px-1 pt-1 pb-2 text-[12.5px]">
          {[
            ['published', '올라간 것'],
            ['all', '만든 것 전체'],
          ].map(([v, l]) => (
            <Link key={v} href={`/stores/${id}/contents${v === 'all' ? '?scope=all' : ''}`} className={cx('rounded-md px-2.5 py-1', scope === v ? 'bg-ink text-white' : 'text-ink-soft hover:bg-soft')}>
              {l}
            </Link>
          ))}
        </div>
        <ContentTable rows={rows} />
        <Pager path={`/stores/${id}/contents`} params={{ scope: scope === 'all' ? 'all' : '' }} page={page} pages={pages} info={`전체 ${total}건 · 최신순`} />
      </Card>
      <p className="text-[12.5px] text-ink-soft">제목이나 썸네일을 누르면 실제로 올라간 게시물이 새 탭에서 열려요. 우리가 만든 원본은 <b>원본 보기</b>로 확인해요.</p>
    </>
  )
}
