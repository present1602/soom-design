import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

const BTN = {
  base: 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
  size: { sm: 'px-2.5 py-1 text-[12.5px]', md: 'px-3.5 py-[7px] text-[13.5px]', lg: 'px-4 py-2.5 text-[14.5px]' },
  tone: {
    default: 'border-line bg-card text-ink hover:bg-soft',
    primary: 'border-accent bg-accent text-white hover:brightness-110',
    ghost: 'border-transparent bg-transparent text-ink hover:bg-soft',
    danger: 'border-transparent bg-transparent text-bad hover:bg-bad-weak',
  },
}
type BtnStyle = { tone?: keyof typeof BTN.tone; size?: keyof typeof BTN.size }
export const btn = ({ tone = 'default', size = 'md' }: BtnStyle = {}) => cx(BTN.base, BTN.size[size], BTN.tone[tone])

export function Button({ tone, size, className, ...p }: ComponentProps<'button'> & BtnStyle) {
  return <button type="button" {...p} className={cx(btn({ tone, size }), className)} />
}
export function LinkButton({ tone, size, className, ...p }: ComponentProps<typeof Link> & BtnStyle) {
  return <Link {...p} className={cx(btn({ tone, size }), className)} />
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx('min-w-0 rounded-xl border border-line bg-card p-[18px]', className)} />
}

export function CardHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <h2 className="text-[16px] font-bold">{title}</h2>
      {sub && <span className="text-[12.5px] text-ink-soft">{sub}</span>}
      {action && <div className="ml-auto flex items-center gap-1.5">{action}</div>}
    </div>
  )
}

const PILL = {
  neutral: 'bg-soft text-ink-soft',
  ok: 'bg-ok-weak text-ok',
  warn: 'bg-warn-weak text-warn',
  bad: 'bg-bad-weak text-bad',
  accent: 'bg-accent-weak text-accent',
  info: 'bg-info-weak text-info',
}
export function Pill({ tone = 'neutral', dot, children }: { tone?: keyof typeof PILL; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-px text-[12px] font-medium', PILL[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function PageHead({ title, sub, crumb, action }: { title: ReactNode; sub?: ReactNode; crumb?: ReactNode; action?: ReactNode }) {
  return (
    <div>
      {crumb && <div className="mb-1.5 flex flex-wrap gap-1.5 text-[12.5px] text-ink-soft [&_a:hover]:text-accent">{crumb}</div>}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
          {sub && <div className="mt-1 text-ink-soft">{sub}</div>}
        </div>
        {action && <div className="ml-auto flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

export const inputCls =
  'w-full rounded-lg border border-line bg-card px-2.5 py-2 outline-none focus:border-accent focus:ring-3 focus:ring-accent-weak disabled:bg-soft'

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12.5px] text-bad">{error}</p> : hint ? <p className="text-[12.5px] text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export function Note({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'accent' | 'info' | 'bad'; children: ReactNode }) {
  const t = { neutral: 'bg-soft text-ink-soft', warn: 'bg-warn-weak text-warn', accent: 'bg-accent-weak text-accent', info: 'bg-info-weak text-info', bad: 'bg-bad-weak text-bad' }[tone]
  return <div className={cx('rounded-lg px-3 py-2.5 text-[13px]', t)}>{children}</div>
}

export { ErrorLine } from './error-line'

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-2 px-5 py-9 text-center text-ink-soft">
      <b className="text-ink">{title}</b>
      {children && <div className="text-[12.5px]">{children}</div>}
    </div>
  )
}
