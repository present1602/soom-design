'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Consent, Dialog, Done, Field, inputCls } from './inquiry/form-bits'
import { MARKETING_MESSAGE_MAX } from '@/lib/marketing-lead'
import { useIndustries } from './inquiry/use-industries'

export function MarketingLeadButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex min-h-12 items-center justify-center gap-4 border px-6 py-3 text-sm font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum ${className ?? 'border-ink bg-ink text-paper'}`}
      >
        문의하기
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
      </button>
      {open && <MarketingLeadModal onClose={() => setOpen(false)} />}
    </>
  )
}

function MarketingLeadModal({ onClose }: { onClose: () => void }) {
  const industries = useIndustries()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  /* 같은 접수를 두 번 저장하지 않게 — 렌더 중이 아니라 처음 보낼 때 만든다 */
  const submitKey = useRef<string | null>(null)

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    try {
      const body = new FormData(e.currentTarget)
      submitKey.current ??= crypto.randomUUID()
      body.set('submitKey', submitKey.current)
      const res = await fetch('/api/marketing-lead', { method: 'POST', body })
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setDone(true)
    } catch {
      setError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog eyebrow="MARKETING" title="문의하기" onClose={onClose}>
      {done ? (
        <Done
          title="문의가 접수되었습니다"
          body="문의 내용을 확인하고 입력하신 연락처로 안내해 드리겠습니다."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={send} className="px-6 py-7 md:px-10 md:py-8">
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] size-0 opacity-0"
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="회사명(성함)" req>
              <input required name="company" maxLength={100} className={inputCls} placeholder="회사명 또는 성함" />
            </Field>
            <Field label="연락처" req>
              <input required name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputCls} placeholder="010-0000-0000" />
            </Field>
            <Field label="지역" req>
              <input required name="region" maxLength={50} className={inputCls} placeholder="시, 군, 구까지만 적어주셔도 됩니다." />
            </Field>
            <Field label="업종" req>
              <select required name="industry" defaultValue="" className={`${inputCls} invalid:text-neutral-400`}>
                <option value="" disabled>
                  업종을 골라 주세요
                </option>
                {industries.map((i) => (
                  <option key={i} value={i} className="text-neutral-900">
                    {i}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-6">
            <Field label="문의내용">
              <textarea name="message" rows={3} maxLength={MARKETING_MESSAGE_MAX} className={inputCls} placeholder="궁금한 점이나 진행하고 싶은 내용을 적어 주세요." />
            </Field>
          </div>

          <Consent />

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-6 w-full rounded-lg bg-neutral-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#C93A0C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? '보내는 중…' : '문의 보내기'}
          </button>
        </form>
      )}
    </Dialog>
  )
}
