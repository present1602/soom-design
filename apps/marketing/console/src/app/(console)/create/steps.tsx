import { cx } from '@/components/ui'

export function CreateSteps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {['매장·브랜드 선택', '콘텐츠 유형', '생성 · 업로드'].map((t, i) => {
        const n = i + 1
        return (
          <span key={t} className={cx('flex items-center gap-1.5 rounded-full border bg-card py-1 pr-2.5 pl-1.5 text-[13px]', n === at ? 'border-accent font-bold text-accent' : 'border-line text-ink-soft')}>
            <i className={cx('grid size-5 place-items-center rounded-full text-[11.5px] not-italic', n === at ? 'bg-accent text-white' : n < at ? 'bg-ok-weak text-ok' : 'bg-soft')}>{n < at ? '✓' : n}</i>
            {t}
          </span>
        )
      })}
    </div>
  )
}
