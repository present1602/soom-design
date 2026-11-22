'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from '@/components/ui'

export function StoreTabs({ id, isSuper }: { id: string; isSuper: boolean }) {
  const path = usePathname()
  const tabs = [
    ['', '대시보드'],
    ['/contents', '콘텐츠'],
    ['/channels', '채널 관리'],
    ['/info', '고객사·매장 정보'],
    ['/sources', '자료 수집'],
    ...(isSuper ? [['/managers', '콘텐츠 담당자']] : []),
  ]
  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-line">
      {tabs.map(([seg, label]) => {
        const href = `/stores/${id}${seg}`
        const on = path === href
        return (
          <Link key={seg} href={href} className={cx('-mb-px border-b-2 px-3.5 py-2.5 whitespace-nowrap', on ? 'border-ink font-bold' : 'border-transparent text-ink-soft hover:text-ink')}>
            {label}
            {seg === '/managers' && <span className="ml-1.5 rounded-full bg-info-weak px-1.5 text-[10.5px] text-info">슈퍼</span>}
          </Link>
        )
      })}
    </div>
  )
}
