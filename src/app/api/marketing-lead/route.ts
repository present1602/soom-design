import { NextResponse } from 'next/server'
import { sendAdminMail } from '@/lib/admin-mail'
import { allowedEmails } from '@/lib/admin-auth'
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase-admin'
import { LEAD_URL_FIELDS, MARKETING_MESSAGE_MAX, normalizeUrl } from '@/lib/marketing-lead'
import { INDUSTRY_NAME_MAX } from '@/lib/industries'
import { recordAlimtalk, sendAlimtalk } from '@/lib/alimtalk'

/* 마케팅 문의는 DB에 저장한 뒤 알림 메일을 보낸다. */

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

    const get = (k: string) => {
      const value = form.get(k)
      return typeof value === 'string' ? value.trim() : ''
    }
    const company = get('company')
    const contactName = get('contactName')
    const phone = get('phone')
    const industry = get('industry')
    const region = get('region')
    const message = get('message').replace(/\r\n/g, '\n')
    const submitKey = get('submitKey').slice(0, 64)

    if (!company || !phone || !region || !industry) {
      return bad('회사명(성함), 연락처, 지역, 업종을 입력해 주세요.')
    }
    /* 목록은 어드민에서 바뀐다 — 열어 둔 폼이 예전 목록이어도 받도록 길이만 본다 */
    if (industry.length > INDUSTRY_NAME_MAX) {
      return bad('업종을 목록에서 골라 주세요.')
    }
    /* 연락처 형식은 묶지 않는다(/api/inquiry 와 같은 방침) — 숫자가 있는지만 */
    if (!/\d/.test(phone)) return bad('연락처를 확인해 주세요.')
    if (company.length > 100 || contactName.length > 100 || phone.length > 40 || region.length > 50) {
      return bad('입력이 너무 깁니다. 줄여서 다시 보내 주세요.')
    }
    if (message.length > MARKETING_MESSAGE_MAX) {
      return bad(`문의내용은 ${MARKETING_MESSAGE_MAX.toLocaleString('ko-KR')}자 이내로 적어 주세요.`)
    }

    /* 배포 전에 열린 폼에서 보낸 담당자명과 채널 주소도 접수한다. */
    const urls: Record<string, string | null> = {}
    for (const f of LEAD_URL_FIELDS) {
      const v = normalizeUrl(get(f.name))
      if (v === false) return bad(`${f.label} 주소를 확인해 주세요.`)
      urls[f.column] = v
    }

    if (!supabaseConfigured || !supabaseAdmin) {
      console.error('[marketing-lead] Supabase 미설정')
      return bad('서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503)
    }
    const db = supabaseAdmin

    const { data: row, error } = await db
      .from('marketing_leads')
      .insert({
        company,
        contact_name: contactName || null,
        phone,
        industry,
        region,
        message: message || null,
        ...urls,
        submit_key: submitKey || null,
      })
      .select('id')
      .single()

    if (error || !row) {
      if (error?.code === '23505' && submitKey) return NextResponse.json({ ok: true, duplicate: true })
      const missingTable = error?.code === '42P01' || error?.code === 'PGRST205'
      const missingMessage = error?.code === '42703' || error?.code === 'PGRST204' || error?.code === '23502'
      if (missingTable || missingMessage) {
        console.error('[marketing-lead] 접수 DB 설정 필요:', missingTable ? '0036_marketing_leads.sql, 0037_marketing_inquiries.sql' : '0037_marketing_inquiries.sql')
        return bad('문의 접수가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503)
      }
      console.error('[marketing-lead] 저장 실패:', error?.code)
      return bad('접수하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    const to = allowedEmails()
    if (process.env.RESEND_API_KEY && to.length > 0) {
      try {
        const rows: [string, string][] = [
          ['회사명(성함)', company],
          ['연락처', phone],
          ['지역', region],
          ['업종', industry],
          ['문의내용', message || '미입력'],
        ]
        if (contactName) rows.push(['담당자명', contactName])
        for (const { column, label } of LEAD_URL_FIELDS) {
          const url = urls[column]
          if (url) rows.push([label, url])
        }
        await sendAdminMail({
          from: `soom 마케팅 <${FROM}>`,
          to,
          subject: `[마케팅 문의] ${company.replace(/\s+/g, ' ')} · ${industry} · ${region.replace(/\s+/g, ' ')}`,
          html: `<table style="border-collapse:collapse;font-size:14px">${rows
            .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${k}</td><td style="padding:4px 0;white-space:pre-wrap;overflow-wrap:anywhere">${esc(v)}</td></tr>`)
            .join('')}</table><p style="color:#999;font-size:12px">접수 ID ${row.id}</p>`,
        })
        const { error: statusError } = await db.from('marketing_leads').update({ mailed: true }).eq('id', row.id)
        if (statusError) console.error('[marketing-lead] 메일 발송 상태 저장 실패:', row.id, statusError.code)
      } catch (mailErr) {
        console.error('[marketing-lead] 메일 전송 실패 (접수는 저장됨):', row.id, mailErr)
      }
    } else {
      console.warn('[marketing-lead] 메일 미설정 — 접수만 저장됨:', row.id)
    }

    /* 고객에게 접수 확인 알림톡 — 실패해도 접수는 성공이다(결과는 alimtalk 칸, 0039) */
    const talk = await sendAlimtalk('marketingLead', phone, { 이름: contactName || company, 업종: industry, 지역: region })
    if (talk.status === 'failed') console.error('[marketing-lead] 알림톡 실패 (접수는 저장됨):', row.id, talk.error)
    await recordAlimtalk('marketing_leads', row.id, talk)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[marketing-lead] 처리 실패:', e)
    return bad('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}
