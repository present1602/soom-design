'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AdminRole } from '@marketing/core/types'
import { cx } from './ui'

type Item = { href: string; label: string; super?: boolean } | { section: string; super?: boolean }

const ITEMS: Item[] = [
  { href: '/clients', label: '고객사 관리' },
  { href: '/managers', label: '담당자 관리', super: true },
  { section: '콘텐츠' },
  { href: '/models', label: '가상 모델' },
  { href: '/voices', label: '목소리 보관함' },
  { href: '/create', label: '콘텐츠 생성' },
  { href: '/contents', label: '콘텐츠 관리' },
  { section: '실험' },
  { href: '/lab/crawl', label: '크롤링 테스트' }, // 크롤링 테스트 — 지울 때 이 줄과 위 '실험' 줄 같이
  { section: '설정', super: true },
  { href: '/settings', label: '생성 옵션', super: true },
]

export function Sidebar({ nickname, role }: { nickname: string; role: AdminRole }) {
  const path = usePathname()
  const on = (href: string) => path === href || path.startsWith(href + '/') || (href === '/clients' && path.startsWith('/stores'))
  const items = ITEMS.filter((i) => !i.super || role === 'super')
  return (
    <nav aria-label="메인 메뉴" className="sticky top-0 z-20 flex gap-0.5 overflow-x-auto border-b border-line bg-card px-4 py-2 md:h-screen md:flex-col md:border-r md:border-b-0 md:px-3 md:py-[18px]">
      <div className="flex shrink-0 items-center gap-2.5 pr-2 font-bold md:px-2.5 md:pt-1 md:pb-4">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-white">M</span>
        <div className="hidden md:block">
          마케팅 콘솔<small className="block text-[11.5px] font-normal text-ink-soft">숏폼 대행 운영</small>
        </div>
      </div>
      {items.map((i) =>
        'section' in i ? (
          <div key={i.section} className="hidden px-2.5 pt-3.5 pb-1 text-[11px] tracking-wider text-ink-soft md:block">
            {i.section}
          </div>
        ) : (
          <Link key={i.href} href={i.href} className={cx('flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] whitespace-nowrap hover:bg-soft', on(i.href) && 'bg-accent-weak font-bold text-accent')}>
            {i.label}
            {i.super && <span className="ml-auto rounded-full bg-info-weak px-1.5 text-[10.5px] text-info">슈퍼</span>}
          </Link>
        ),
      )}
      <div className="hidden flex-1 md:block" />
      <div className="flex shrink-0 items-center gap-2 border-l border-line pl-2.5 md:grid md:border-t md:border-l-0 md:px-1.5 md:pt-3">
        <div className="hidden text-[12.5px] md:block">
          <b>{nickname}</b> <span className="text-ink-soft">· {role === 'super' ? '슈퍼어드민' : '콘텐츠 관리자'}</span>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-md px-2 py-1 text-[12.5px] text-ink-soft hover:bg-soft">로그아웃</button>
        </form>
      </div>
    </nav>
  )
}
