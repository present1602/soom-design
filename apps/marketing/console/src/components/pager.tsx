import Link from 'next/link'
import { cx } from './ui'

/** 주소의 ?page= 를 바꾸는 페이지 넘김. 다른 검색 조건은 그대로 둔다. */
export function Pager({ path, params, page, pages, info }: { path: string; params: Record<string, string>; page: number; pages: number; info?: string }) {
  const href = (p: number) => {
    const sp = new URLSearchParams({ ...params, page: String(p) })
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k)
    return `${path}?${sp.toString()}`
  }
  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-card px-2 text-[13px] tabular'
  // 많으면 앞뒤 2쪽만 보인다
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 pt-3">
      {pages > 1 && (
        <>
          {page > 1 ? <Link className={btn} href={href(page - 1)} aria-label="이전 페이지">‹</Link> : <span className={cx(btn, 'opacity-40')}>‹</span>}
          {nums.map((n, i) => (
            <span key={n} className="contents">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-soft">…</span>}
              <Link className={cx(btn, n === page && 'border-ink bg-ink text-white')} href={href(n)} aria-current={n === page ? 'page' : undefined}>
                {n}
              </Link>
            </span>
          ))}
          {page < pages ? <Link className={btn} href={href(page + 1)} aria-label="다음 페이지">›</Link> : <span className={cx(btn, 'opacity-40')}>›</span>}
        </>
      )}
      {info && <span className="ml-2.5 text-[12.5px] text-ink-soft">{info}</span>}
    </div>
  )
}
