import type { Metadata } from 'next'
import Link from 'next/link'
import { ChannelStrip } from '@/components/channel-icon'
import { Pager } from '@/components/pager'
import { Card, PageHead, cx } from '@/components/ui'
import { listAdmins, listClientGroups, type ClientGroup } from '@/lib/data'
import { pageOf, shortDate, str } from '@/lib/format'
import { requireStaff } from '@/lib/staff'
import { ClientSearch, NewClientButton, RowLink } from './client-bits'

export const metadata: Metadata = { title: '고객사 관리' }

const PER = 10

/* 한 고객사의 매장들은 페이지가 바뀌어도 떨어지지 않는다.
   mode=client: 고객사 10곳씩 (매장이 많으면 행이 늘어난다)
   mode=row:    10행씩 채우되 묶음을 자르지 않는다 (9행으로 끝나는 페이지가 생긴다) */
function paginate(groups: ClientGroup[], mode: string) {
  const pages: ClientGroup[][] = []
  if (mode === 'row') {
    let cur: ClientGroup[] = []
    let rows = 0
    for (const g of groups) {
      const n = Math.max(1, g.stores.length)
      if (rows && rows + n > PER) {
        pages.push(cur)
        cur = []
        rows = 0
      }
      cur.push(g)
      rows += n
    }
    if (cur.length) pages.push(cur)
  } else {
    for (let i = 0; i < groups.length; i += PER) pages.push(groups.slice(i, i + PER))
  }
  return pages.length ? pages : [[]]
}

export default async function ClientsPage({ searchParams }: PageProps<'/clients'>) {
  const staff = await requireStaff()
  const sp = await searchParams
  const q = str(sp.q)
  const mode = str(sp.mode) === 'row' ? 'row' : 'client'
  const groups = await listClientGroups(staff, q)
  const pages = paginate(groups, mode)
  const page = Math.min(pageOf(sp.page), pages.length)
  const pg = pages[page - 1]
  const rows = pg.reduce((a, g) => a + Math.max(1, g.stores.length), 0)
  const storeCount = groups.reduce((a, g) => a + g.stores.length, 0)
  const managers = staff.role === 'super' ? (await listAdmins()).filter((a) => a.active).map((a) => ({ id: a.id, nickname: a.nickname })) : []

  return (
    <>
      <PageHead
        title="고객사 관리"
        sub={staff.role === 'super' ? `고객사 ${groups.length}곳 · 매장·브랜드 ${storeCount}개` : `내가 담당하는 매장만 보여요 · ${storeCount}개`}
        action={staff.role === 'super' && <NewClientButton managers={managers} />}
      />
      <Card className="p-3">
        <ClientSearch q={q} mode={mode} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12.5px] whitespace-nowrap text-ink-soft [&>th]:border-b [&>th]:border-line [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium">
                <th>고유코드</th>
                <th>고객사명</th>
                <th>대표자</th>
                <th>연락처</th>
                <th>이메일</th>
                <th>매장·브랜드</th>
                <th>채널</th>
                <th>콘텐츠 담당자</th>
                <th>최근 업로드</th>
              </tr>
            </thead>
            {pg.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={9} className="px-2.5 py-8 text-center text-ink-soft">
                    {q ? '검색 결과가 없어요.' : staff.role === 'super' ? '아직 등록한 고객사가 없어요. 오른쪽 위 고객사 등록으로 시작하세요.' : '담당하는 매장이 없어요. 슈퍼어드민에게 매장 할당을 요청해 주세요.'}
                  </td>
                </tr>
              </tbody>
            )}
            {pg.map(({ client, stores }, gi) => {
              const n = Math.max(1, stores.length)
              const cl = cx('align-top bg-card', 'border-b border-line px-2.5 py-2.5')
              const clientCells = (
                <>
                  <td rowSpan={n} className={cx(cl, 'text-[12.5px] whitespace-nowrap text-ink-soft tabular')}>{client.code}</td>
                  <td rowSpan={n} className={cx(cl, 'whitespace-nowrap')}>
                    <b>{client.name}</b>
                    {stores.length > 1 && <div className="text-[12px] text-ink-soft">{stores.length}개 {stores.some((s) => s.kind === 'brand') ? '매장·브랜드' : '매장'}</div>}
                  </td>
                  <td rowSpan={n} className={cx(cl, 'whitespace-nowrap')}>{client.rep_name}</td>
                  <td rowSpan={n} className={cx(cl, 'whitespace-nowrap text-[12.5px] tabular')}>{client.phone}</td>
                  <td rowSpan={n} className={cx(cl, 'text-[12.5px]')}>{client.email || <span className="text-ink-soft">—</span>}</td>
                </>
              )
              const top = gi > 0 ? '[&>tr:first-child>td]:border-t-2 [&>tr:first-child>td]:border-t-line-2' : ''
              return (
                <tbody key={client.id} className={top}>
                  {stores.length === 0 ? (
                    <tr>
                      {clientCells}
                      <td colSpan={4} className="border-b border-line px-2.5 py-2.5 text-ink-soft">매장이 없어요</td>
                    </tr>
                  ) : (
                    stores.map((s, i) => (
                      <RowLink key={s.id} href={`/stores/${s.id}`}>
                        {i === 0 && clientCells}
                        <td className="border-b border-line px-2.5 py-2.5 whitespace-nowrap">
                          <Link href={`/stores/${s.id}`} className="hover:text-accent">{s.name}</Link>
                          {s.kind === 'brand' && <span className="ml-1.5 rounded border border-line px-1.5 text-[11.5px] text-ink-soft">브랜드</span>}
                        </td>
                        <td className="border-b border-line px-2.5 py-2.5"><ChannelStrip channels={s.channels} /></td>
                        <td className="border-b border-line px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{s.managers.map((m) => m.nickname).join(', ') || <span className="text-bad">없음</span>}</td>
                        <td className="border-b border-line px-2.5 py-2.5 text-[12.5px] whitespace-nowrap tabular">{shortDate(s.lastUpload)}</td>
                      </RowLink>
                    ))
                  )}
                </tbody>
              )
            })}
          </table>
        </div>
        <Pager path="/clients" params={{ q, mode }} page={page} pages={pages.length} info={`이 페이지: 고객사 ${pg.length}곳 · ${rows}행`} />
      </Card>
      <p className="text-[12.5px] text-ink-soft">
        {mode === 'client'
          ? '고객사 10곳 단위로 넘겨요. 매장이 많은 고객사가 있으면 한 페이지의 행 수가 늘어나요.'
          : '10행을 넘기면 다음 페이지로 넘기되, 한 고객사의 매장은 나누지 않아요. 그래서 한 페이지가 10행보다 적게 끝날 수 있어요.'}
      </p>
    </>
  )
}
