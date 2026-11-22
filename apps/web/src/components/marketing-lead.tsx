'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Consent, Dialog, Done, Field, inputCls } from './inquiry/form-bits'
import { LEAD_URL_FIELDS, MARKETING_INDUSTRIES, normalizeUrl } from '@/lib/marketing-lead'

/* 마케팅 페이지의 '출시 소식 받기' — 버튼을 누르면 문의 폼이 열리고 /api/marketing-lead 로 보낸다.
   className: 색만 바꾼다(모양·크기는 AboutInquiryButton 과 같다) */
export function MarketingLeadButton({ className, children }: { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex min-h-12 items-center justify-center gap-4 border px-6 py-3 text-sm font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum ${className ?? 'border-ink bg-ink text-paper'}`}
      >
        {children ?? '출시 소식 받기'}
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
      </button>
      {open && <MarketingLeadModal onClose={() => setOpen(false)} />}
    </>
  )
}

function MarketingLeadModal({ onClose }: { onClose: () => void }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  /* 주소 칸별로 잘못 적었는지 — 누르기 전에 칸 옆에 알리고 보내기를 막는다 */
  const [urls, setUrls] = useState<Record<string, string>>({})
  /* 같은 접수를 두 번 저장하지 않게 — 렌더 중이 아니라 처음 보낼 때 만든다 */
  const submitKey = useRef<string | null>(null)

  const badUrls = LEAD_URL_FIELDS.filter((f) => normalizeUrl(urls[f.name] ?? '') === false).map((f) => f.name)

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending || badUrls.length) return
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
          title="신청이 접수되었습니다"
          body="출시되면 입력하신 연락처로 가장 먼저 알려 드리고, 업종에 어울리는 AI 모델도 추천해 드릴게요."
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
            <Field label="회사명" req>
              <input required name="company" maxLength={100} autoComplete="organization" className={inputCls} placeholder="가게·회사 이름" />
            </Field>
            <Field label="담당자명" req>
              <input required name="contactName" maxLength={100} autoComplete="name" className={inputCls} placeholder="홍길동" />
            </Field>
            <Field label="연락처" req>
              <input required name="phone" type="tel" maxLength={40} autoComplete="tel" inputMode="tel" className={inputCls} placeholder="010-0000-0000" />
            </Field>
            <Field label="업종" req>
              <select required name="industry" defaultValue="" className={`${inputCls} invalid:text-neutral-400`}>
                <option value="" disabled>
                  업종을 골라 주세요
                </option>
                {MARKETING_INDUSTRIES.map((i) => (
                  <option key={i} value={i} className="text-neutral-900">
                    {i}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="소재지" req>
                <input required name="region" maxLength={50} autoComplete="off" className={inputCls} placeholder="시, 군, 구까지만 입력해주세요 (예: 서울 강남구)" />
              </Field>
            </div>
          </div>

          <div className="mt-10 border-t border-neutral-200 pt-6">
            <p className="text-sm font-semibold">추가 입력 사항</p>
            <p className="mt-1 text-xs text-neutral-500">운영 중인 채널을 알려 주시면 더 잘 맞는 AI 모델을 추천해 드릴 수 있어요.</p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              {LEAD_URL_FIELDS.map((f) => {
                const bad = badUrls.includes(f.name)
                return (
                  <Field key={f.name} label={f.label}>
                    <input
                      name={f.name}
                      inputMode="url"
                      autoComplete="url"
                      maxLength={500}
                      value={urls[f.name] ?? ''}
                      onChange={(e) => setUrls((u) => ({ ...u, [f.name]: e.target.value }))}
                      aria-invalid={bad}
                      className={`${inputCls} ${bad ? 'border-red-500 focus:border-red-600' : ''}`}
                      placeholder={f.placeholder}
                    />
                    {bad && <span className="mt-1 block text-xs text-red-600">주소 형식을 확인해 주세요.</span>}
                  </Field>
                )
              })}
            </div>
          </div>

          <Consent />

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending || badUrls.length > 0}
            className="mt-6 w-full rounded-lg bg-neutral-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#C93A0C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? '보내는 중…' : '출시 소식 신청하기'}
          </button>
        </form>
      )}
    </Dialog>
  )
}
