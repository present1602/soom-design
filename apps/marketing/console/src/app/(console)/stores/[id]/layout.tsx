import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LinkButton, cx } from '@/components/ui'
import { getStore } from '@/lib/data'
import { canSeeStore, requireStaff } from '@/lib/staff'
import { StoreTabs } from './tabs'

/* 매장 상세 공통 머리. "콘텐츠 등록"은 어느 탭에서든 보이게 오른쪽 위에 고정한다 —
   누르면 이 매장이 선택된 채로 콘텐츠 생성으로 간다. */
export default async function StoreLayout({ children, params }: LayoutProps<'/stores/[id]'>) {
  const staff = await requireStaff()
  const { id } = await params
  if (!canSeeStore(staff, id)) notFound()
  const d = await getStore(id)
  if (!d) notFound()
  const sibs = d.siblings.filter((s) => canSeeStore(staff, s.id))
  return (
    <>
      <div>
        <div className="mb-1.5 flex flex-wrap gap-1.5 text-[12.5px] text-ink-soft">
          <Link href="/clients" className="hover:text-accent">고객사 관리</Link> / <span>{d.client.name}</span> / <span>{d.store.name}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-weak text-[18px] font-bold text-accent">{d.client.name.slice(0, 1)}</span>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">
                {d.client.name} <span className="font-medium text-ink-soft">{d.store.name}</span>
              </h1>
              <p className="mt-0.5 text-ink-soft">
                <span className="text-[12.5px] tabular">{d.client.code}</span> · 대표 {d.client.rep_name} · 담당 {d.managers.map((m) => m.nickname).join(', ') || '없음'}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <LinkButton tone="primary" size="lg" href={`/create/${id}`}>＋ 콘텐츠 등록</LinkButton>
          </div>
        </div>
        {sibs.length > 1 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {sibs.map((s) => (
              <Link key={s.id} href={`/stores/${s.id}`} className={cx('rounded-full border px-2.5 py-0.5 text-[12.5px]', s.id === id ? 'border-accent bg-accent-weak font-bold text-accent' : 'border-line bg-card text-ink-soft')}>
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <StoreTabs id={id} isSuper={staff.role === 'super'} />
      {children}
    </>
  )
}
