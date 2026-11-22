import { NextResponse } from 'next/server'
import { sendAdminMail } from '@/lib/admin-mail'
import { allowedEmails } from '@/lib/admin-auth'
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase-admin'
import { LEAD_URL_FIELDS, MARKETING_INDUSTRIES, normalizeUrl } from '@/lib/marketing-lead'

/* 마케팅 대행 "출시 소식 받기" 접수 (0036_marketing_leads.sql).

   로그인 없이 누구나 보낸다 — 들어온 값을 하나도 믿지 않고 여기서 다시 본다.
   /api/inquiry 와 같은 순서: DB 에 남기고 → 메일. 메일이 실패해도 접수는 성공이다. */

const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()

    /* 봇만 채우는 숨은 칸 — 조용히 성공으로 */
    if (String(form.get('company_website') ?? '').trim()) return NextResponse.json({ ok: true })

    const get = (k: string) => String(form.get(k) ?? '').trim()
    const company = get('company')
    const contactName = get('contactName')
    const phone = get('phone')
    const industry = get('industry')
    const region = get('region')
    const submitKey = get('submitKey').slice(0, 64)

    if (!company || !contactName || !phone || !industry || !region) {
      return bad('회사명, 담당자명, 연락처, 업종, 소재지는 필수입니다.')
    }
    if (!(MARKETING_INDUSTRIES as readonly string[]).includes(industry)) {
      return bad('업종을 목록에서 골라 주세요.')
    }
    /* 연락처 형식은 묶지 않는다(/api/inquiry 와 같은 방침) — 숫자가 있는지만 */
    if (!/\d/.test(phone)) return bad('연락처를 확인해 주세요.')
    if (company.length > 100 || contactName.length > 100 || phone.length > 40 || region.length > 50) {
      return bad('입력이 너무 깁니다. 줄여서 다시 보내 주세요.')
    }

    const urls: Record<string, string | null> = {}
    for (const f of LEAD_URL_FIELDS) {
      const v = normalizeUrl(get(f.name))
      if (v === false) return bad(`${f.label} 주소를 확인해 주세요.`)
      urls[f.column] = v
    }

    if (!supabaseConfigured || !supabaseAdmin) {
      console.error('[marketing-lead] Supabase 미설정 — 접수 내용:', { company, contactName, phone, industry, region })
      return bad('서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503)
    }
    const db = supabaseAdmin

    if (submitKey) {
      const { data: dup } = await db.from('marketing_leads').select('id').eq('submit_key', submitKey).maybeSingle()
      if (dup) return NextResponse.json({ ok: true, duplicate: true })
    }

    const { data: row, error } = await db
      .from('marketing_leads')
      .insert({
        company,
        contact_name: contactName,
        phone,
        industry,
        region,
        ...urls,
        submit_key: submitKey || null,
      })
      .select('id')
      .single()

    if (error || !row) {
      /* 표가 없으면(0036 전) 접수를 잃는다 — 로그에 내용과 돌릴 파일을 남긴다 */
      const missing = error?.code === '42P01' || error?.code === 'PGRST205'
      console.error(
        missing ? '[marketing-lead] marketing_leads 표가 없습니다. 0036_marketing_leads.sql 을 실행해 주세요.' : '[marketing-lead] 저장 실패:',
        error?.message,
        { company, contactName, phone, industry, region, ...urls },
      )
      return bad('접수하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    const to = allowedEmails()
    if (process.env.RESEND_API_KEY && to.length > 0) {
      try {
        const rows: [string, string][] = [
          ['회사명', company],
          ['담당자', contactName],
          ['연락처', phone],
          ['업종', industry],
          ['소재지', region],
          ...LEAD_URL_FIELDS.map((f): [string, string] => [f.label, urls[f.column] ?? '-']),
        ]
        await sendAdminMail({
          from: `soom 마케팅 <${FROM}>`,
          to,
          subject: `[마케팅 출시 소식] ${company} · ${industry} · ${region}`,
          html: `<table style="border-collapse:collapse;font-size:14px">${rows
            .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
            .join('')}</table><p style="color:#999;font-size:12px">접수 ID ${row.id}</p>`,
        })
        await db.from('marketing_leads').update({ mailed: true }).eq('id', row.id)
      } catch (mailErr) {
        console.error('[marketing-lead] 메일 전송 실패 (접수는 저장됨):', row.id, mailErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[marketing-lead] 처리 실패:', e)
    return bad('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}
