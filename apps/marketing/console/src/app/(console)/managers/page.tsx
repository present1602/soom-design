import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, PageHead, Pill } from '@/components/ui'
import { listAdmins } from '@/lib/data'
import { requireSuper } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { ActiveToggle, InviteButton } from './manager-bits'

export const metadata: Metadata = { title: '담당자 관리' }

export default async function ManagersPage() {
  const me = await requireSuper()
  const admins = await listAdmins()
  const { data } = await db().from('store_managers').select('admin_id, stores(id, name, clients(name))')
  const by = new Map<string, { id: string; label: string }[]>()
  for (const r of (data ?? []) as unknown as { admin_id: string; stores: { id: string; name: string; clients: { name: string } | null } | null }[]) {
    if (!r.stores) continue
    const list = by.get(r.admin_id) ?? []
    list.push({ id: r.stores.id, label: `${r.stores.clients?.name ?? ''} ${r.stores.name}` })
    by.set(r.admin_id, list)
  }
  return (
    <>
      <PageHead title="담당자 관리" sub="콘텐츠 관리자 계정과 맡은 매장" action={<InviteButton />} />
      <Card className="px-3 py-2">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12.5px] whitespace-nowrap text-ink-soft [&>th]:border-b [&>th]:border-line [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium">
                <th>닉네임</th>
                <th>이메일</th>
                <th>권한</th>
                <th>담당 매장</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-line [&>tr>td]:px-2.5 [&>tr>td]:py-2.5 [&>tr:last-child>td]:border-b-0">
              {admins.map((a) => (
                <tr key={a.id} className={a.active ? '' : 'opacity-55'}>
                  <td className="font-bold whitespace-nowrap">{a.nickname}</td>
                  <td className="text-[12.5px]">{a.email}</td>
                  <td>{a.role === 'super' ? <Pill tone="info">슈퍼어드민</Pill> : <Pill>콘텐츠 관리자</Pill>}</td>
                  <td>
                    {a.role === 'super' ? (
                      <span className="text-[12.5px] text-ink-soft">전체</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(by.get(a.id) ?? []).map((s) => (
                          <Link key={s.id} href={`/stores/${s.id}/managers`} className="rounded-md border border-line px-2 text-[12px] text-ink-soft hover:border-accent hover:text-accent">
                            {s.label}
                          </Link>
                        ))}
                        {!by.get(a.id)?.length && <span className="text-[12.5px] text-warn">아직 맡은 매장이 없어요</span>}
                      </div>
                    )}
                  </td>
                  <td>{a.id === me.id ? <span className="text-[12.5px] text-ink-soft">나</span> : <ActiveToggle id={a.id} active={a.active} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[12.5px] text-ink-soft">매장에 담당자를 넣거나 빼려면 매장 이름을 눌러 <b>콘텐츠 담당자</b> 탭으로 가세요. 끈 계정은 로그인해도 콘솔에 들어오지 못해요.</p>
    </>
  )
}
