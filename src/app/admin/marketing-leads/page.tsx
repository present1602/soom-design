import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { dateTime } from '@/lib/format-date'
import { LEAD_URL_FIELDS } from '@/lib/marketing-lead'

export const metadata: Metadata = {
  title: '마케팅 문의',
  robots: { index: false, follow: false },
}

export const instant = false

type MarketingLead = {
  id: string
  created_at: string
  company: string
  contact_name: string | null
  phone: string
  region: string
  industry: string
  message?: string | null
  mailed: boolean
  /* 접수 확인 알림톡 결과(0039) — 그 전 DB 에서는 undefined */
  alimtalk?: 'sent' | 'failed' | 'skipped' | null
  alimtalk_error?: string | null
} & Record<(typeof LEAD_URL_FIELDS)[number]['column'], string | null>

const PAGE_SIZE = 50
const PATH = '/admin/marketing-leads'
const fields = 'id, created_at, company, contact_name, phone, region, industry, mailed, homepage_url, naver_place_url, instagram_url, youtube_url'

async function listLeads(page: number) {
  const db = supabaseAdmin
  if (!db) return { rows: [], problem: 'Supabase가 설정되지 않아 문의를 조회할 수 없습니다.' }

  const start = (page - 1) * PAGE_SIZE
  const query = (includeMessage: boolean, includeAlimtalk: boolean) => db
    .from('marketing_leads')
    .select(fields + (includeMessage ? ', message' : '') + (includeAlimtalk ? ', alimtalk, alimtalk_error' : ''))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + PAGE_SIZE)
    .overrideTypes<MarketingLead[], { merge: false }>()

  const missingColumn = (code?: string) => code === '42703' || code === 'PGRST204'
  /* 알림톡 결과 칸(0039)부터 붙여 보고, 없으면 빼고 다시 묻는다 */
  let result = await query(true, true)
  if (missingColumn(result.error?.code)) result = await query(true, false)
  const missingMessage = missingColumn(result.error?.code)
  if (missingMessage) result = await query(false, false)

  if (result.error) {
    const missingTable = result.error.code === '42P01' || result.error.code === 'PGRST205'
    return {
      rows: [],
      problem: missingTable
        ? '0036_marketing_leads.sql과 0037_marketing_inquiries.sql을 실행해 주세요.'
        : '문의 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  return {
    rows: result.data ?? [],
    problem: missingMessage ? '새 문의를 받으려면 0037_marketing_inquiries.sql을 실행해 주세요.' : null,
  }
}

const pageLink = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100'

export default async function AdminMarketingLeadsPage({ searchParams }: PageProps<'/admin/marketing-leads'>) {
  if (!(await getAdminUser())) redirect('/admin/login')

  const params = await searchParams
  const requested = Number(params.page ?? 1)
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000 ? requested : 1
  const { rows, problem } = await listLeads(page)

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">마케팅 문의</h1>
        <p className="mt-1 text-sm text-neutral-500">마케팅 페이지에서 접수한 문의와 이메일 알림 상태입니다.</p>
      </header>
      {problem && <p role="alert" className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{problem}</p>}
      {rows.length > 0 ? (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {rows.slice(0, PAGE_SIZE).map((lead) => (
            <li key={lead.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-semibold break-all">{lead.company}</h2>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                  <time dateTime={lead.created_at} className="text-neutral-500">{dateTime(lead.created_at)}</time>
                  <span className={lead.mailed ? 'text-emerald-700' : 'text-amber-700'}>
                    {lead.mailed ? '이메일 발송 완료' : '이메일 미발송'}
                  </span>
                  {lead.alimtalk === 'sent' && <span className="text-emerald-700">알림톡 발송</span>}
                  {lead.alimtalk === 'failed' && (
                    <span title={lead.alimtalk_error ?? undefined} className="text-red-700">알림톡 실패</span>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <LeadField label="연락처" value={lead.phone} />
                <LeadField label="지역" value={lead.region} />
                <LeadField label="업종" value={lead.industry} />
                {lead.contact_name && <LeadField label="담당자명" value={lead.contact_name} />}
                {LEAD_URL_FIELDS.map(({ column, label }) => {
                  const url = lead[column]
                  return url ? <LeadField key={column} label={label} value={url} /> : null
                })}
                <LeadField label="문의내용" value={lead.message || '미입력'} className="sm:col-span-3" />
              </dl>
            </li>
          ))}
        </ul>
      ) : !problem && (
        <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
          {page > 1 ? '이 페이지에 문의가 없습니다.' : '아직 접수된 마케팅 문의가 없습니다.'}
        </p>
      )}
      {(page > 1 || rows.length > PAGE_SIZE) && (
        <nav aria-label="마케팅 문의 페이지" className="mt-4 flex gap-2">
          {page > 1 && <Link href={`${PATH}?page=${page - 1}`} className={pageLink}>이전</Link>}
          {rows.length > PAGE_SIZE && <Link href={`${PATH}?page=${page + 1}`} className={pageLink}>다음</Link>}
        </nav>
      )}
    </main>
  )
}

function LeadField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}
