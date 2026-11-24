'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { InquiryModal } from '@/components/inquiry/inquiry-modal'
import { ExploreLink } from '@/components/explore-gate'
import { DEFAULT_SITE_MENUS, SITE_MENU_ITEMS, type SiteMenus } from '@/lib/site-menu-shape'

/* 사이트 공통 바.

   좌측 메뉴는 두지 않는다 — 홈으로 가는 길은 SOOM 로고가 맡고,
   갈 곳은 모두 우측에 모았다. 메뉴가 더 늘면 로고와 우측 묶음 사이에
   nav 를 넣는다.

   차례는 소개 → 탐색 → FAQ → 의뢰하기 다. 색을 채운 단추는 의뢰 하나뿐이라
   오른쪽 끝에 둔다. */
export function Navbar({ menus }: { menus?: Partial<SiteMenus> | null }) {
  const [inquiry, setInquiry] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  // 메뉴를 펼친 동안에는 스크롤해도 바를 숨기지 않는다 — 펼친 메뉴가 바와 함께 사라진다
  const hidden = useHideOnScroll() && !menuOpen
  // 설정이 전달되지 않거나 일부 항목이 빠져도 기본 메뉴로 표시한다.
  const items = SITE_MENU_ITEMS.map((item) => ({
    ...item,
    ...(menus?.[item.key] ?? DEFAULT_SITE_MENUS[item.key]),
  })).filter(({ visible }) => visible)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    // 넓은 화면으로 바뀌면 햄버거가 사라지므로 펼친 상태도 접는다
    const wide = window.matchMedia('(min-width: 768px)')
    const onWide = () => wide.matches && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      window.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <>
      {/* 좁은 화면에서는 내려 읽는 동안 위로 미끄러져 숨고, 올리면 다시 내려온다(useHideOnScroll) */}
      <header
        className={`sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none ${
          hidden ? 'max-md:-translate-y-full' : ''
        }`}
      >
        <div className="mx-auto flex min-h-14 max-w-[1240px] items-center gap-x-4 px-4 py-2 md:px-8">
          {/* 세리프 영문 로고 + 작은 한글 이름 — 검색어로 쓰이는 '숨디자인'을 화면 글자로도 둔다 */}
          <Link href="/" aria-label="SOOM 홈" className="flex items-baseline gap-2.5 text-ink">
            <span className="font-serif text-[1.6rem] leading-none font-semibold tracking-[0.08em]">SOOM</span>
            <span className="hidden text-[10px] font-medium tracking-[0.14em] text-ink-faint sm:inline">숨디자인</span>
          </Link>

          {/* 좁은 화면 — 메뉴를 로고 아래로 늘어놓지 않고 햄버거 하나로 접는다 */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-menu"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            className="-mr-2 ml-auto grid size-10 place-items-center text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum md:hidden"
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>

          <nav aria-label="주요 메뉴" className="ml-auto hidden min-w-0 items-center justify-end gap-x-8 md:flex">
            {items.map(({ key, href, name }) => {
              const active = isActive(href)
              const className = `inline-flex min-h-10 items-center whitespace-nowrap border-b text-sm transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum ${active ? 'border-plum font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`
              return key === 'explore' ? (
                <ExploreLink key={key} className={className}>{name}</ExploreLink>
              ) : (
                <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={className}>{name}</Link>
              )
            })}

            {/* 마케팅 대행 링크는 옅은 테두리로 다른 메뉴와 구분한다. */}
            <Link
              href="/marketing"
              aria-current={pathname === '/marketing' ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum ${
                pathname === '/marketing' ? 'border-ink/40 font-medium text-ink' : 'border-line text-ink-soft hover:border-ink/30 hover:text-ink'
              }`}
            >
              마케팅 대행
            </Link>

            {/* 가장 하고 싶은 일 — 유일하게 색을 채운 버튼으로 둔다.
                페이지를 옮기지 않고 그 자리에서 폼을 띄운다. */}
            <button
              type="button"
              onClick={() => setInquiry(true)}
              className="ml-2 inline-flex min-h-10 items-center bg-ink px-5 text-[13px] font-semibold text-paper transition hover:bg-plum"
            >
              의뢰하기
            </button>
          </nav>
        </div>

        {/* 좁은 화면의 펼친 메뉴 — 바 바로 아래로 내려온다.
            접어도 지우지 않고 감추기만 한다: 출시 전 '탐색'은 안내 창(ExploreLink)을 띄우는데,
            메뉴를 지우면 그 창도 함께 사라진다. 항목을 누르면 메뉴는 접는다. */}
        <nav
          id="site-mobile-menu"
          aria-label="주요 메뉴"
          hidden={!menuOpen}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a,button')) setMenuOpen(false)
          }}
          className="absolute inset-x-0 top-full border-b border-line bg-paper px-4 pt-2 pb-5 shadow-[0_20px_40px_-30px_rgb(21_23_28/0.5)] md:hidden"
        >
          <ul className="flex flex-col">
            {items.map(({ key, href, name }) => {
              const active = isActive(href)
              const className = `flex min-h-12 w-full items-center border-b border-line text-[15px] ${active ? 'font-semibold text-ink' : 'text-ink-soft'}`
              return (
                <li key={key}>
                  {key === 'explore' ? (
                    <ExploreLink className={className}>{name}</ExploreLink>
                  ) : (
                    <Link href={href} aria-current={active ? 'page' : undefined} className={className}>{name}</Link>
                  )}
                </li>
              )
            })}
            <li>
              <Link
                href="/marketing"
                aria-current={pathname === '/marketing' ? 'page' : undefined}
                className={`flex min-h-12 w-full items-center border-b border-line text-[15px] ${pathname === '/marketing' ? 'font-semibold text-ink' : 'text-ink-soft'}`}
              >
                마케팅 대행
              </Link>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setInquiry(true)}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-ink text-[14px] font-semibold text-paper transition hover:bg-plum"
          >
            의뢰하기
          </button>
        </nav>
      </header>

      {/* 메뉴 바깥을 누르면 접는다. 헤더(backdrop-blur) 안의 fixed 는 헤더에 갇히므로 밖에 둔다 */}
      {menuOpen && <div aria-hidden="true" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 bg-ink/20 md:hidden" />}

      {/* 모달은 헤더 밖에 둔다 — 헤더가 sticky 라 그 안의 fixed 는
          뷰포트가 아니라 헤더를 기준으로 자리잡는다(56px 안에 갇힌다).
          position 이 static 이 아닌 조상은 fixed 의 기준이 된다. */}
      {inquiry && <InquiryModal onClose={() => setInquiry(false)} />}
    </>
  )
}

/* 좁은 화면(md 미만)에서 아래로 읽어 내려가면 숨기고, 위로 올리면 다시 보인다.

   손가락 떨림에 깜빡이지 않게 일정 거리(GAP) 이상 움직였을 때만 바꾸고,
   맨 위 근처에서는 늘 보인다. 숨김 여부는 <html data-nav-hidden> 에도 적어 둔다 —
   네비바 바로 아래 붙는 띠(소개의 의뢰 유형 탭)가 함께 위로 올라붙게(globals.css 의 .follow-nav) */
const GAP = 8
const SHOW_NEAR_TOP = 64

function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 767px)')
    let last = window.scrollY
    let frame = 0
    let current = false
    const set = (v: boolean) => {
      if (v === current) return
      current = v
      setHidden(v)
      if (v) document.documentElement.dataset.navHidden = ''
      else delete document.documentElement.dataset.navHidden
    }
    const update = () => {
      frame = 0
      const y = window.scrollY
      if (!narrow.matches || y < SHOW_NEAR_TOP) {
        set(false)
        last = y
        return
      }
      if (Math.abs(y - last) < GAP) return
      set(y > last)
      last = y
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    narrow.addEventListener('change', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      narrow.removeEventListener('change', onScroll)
      cancelAnimationFrame(frame)
      delete document.documentElement.dataset.navHidden
    }
  }, [])

  return hidden
}
