import 'server-only'
import { SolapiMessageService } from 'solapi'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* 카카오 알림톡(Solapi) — 문의를 보낸 고객에게 "접수됐다"고 알린다.

   알림톡은 카카오가 검수한 템플릿 문구 그대로만 나간다. 아래 TEMPLATES 의
   body 는 Solapi 콘솔에 등록한 문구와 **글자 하나까지 같아야** 하고, 다르면
   발송이 거절된다. 문구를 고치려면 콘솔에서 새 템플릿을 검수받고 →
   여기 body 와 환경변수의 템플릿 ID 를 같이 바꾼다.

   환경변수(.env.local · Vercel)
   - SOLAPI_API_KEY, SOLAPI_API_SECRET  Solapi 콘솔 > 개발/연동 > API Key
   - SOLAPI_PF_ID                       Solapi 콘솔 > 카카오 채널 연동 후 나오는 채널 ID(pfId)
   - SOLAPI_TEMPLATE_INQUIRY            의뢰 접수 템플릿 ID
   - SOLAPI_TEMPLATE_MARKETING_LEAD     마케팅 문의 접수 템플릿 ID
   - SOLAPI_SENDER                      (선택) 등록된 문자 발신번호. 있으면 카톡을 못 받는
                                        사람에게 같은 내용을 문자로 대신 보낸다

   하나라도 비어 있으면 보내지 않고 'skipped' 로 남긴다 — 개발 환경에서
   문의 폼이 그대로 돌게. 접수 자체는 알림톡과 상관없이 성공이다. */

export const TEMPLATES = {
  inquiry: {
    env: 'SOLAPI_TEMPLATE_INQUIRY',
    body: [
      '[숨디자인] 의뢰 접수 안내',
      '',
      '#{이름}님, 의뢰가 정상적으로 접수되었습니다.',
      '',
      '■ 의뢰 분야: #{분야}',
      '',
      '담당자가 내용을 확인한 뒤 남겨 주신 연락처로 연락드리겠습니다.',
    ].join('\n'),
  },
  marketingLead: {
    env: 'SOLAPI_TEMPLATE_MARKETING_LEAD',
    body: [
      '[숨디자인] 마케팅 문의 접수 안내',
      '',
      '#{이름}님, 마케팅 문의가 정상적으로 접수되었습니다.',
      '',
      '■ 업종: #{업종}',
      '■ 지역: #{지역}',
      '',
      '담당자가 내용을 확인한 뒤 남겨 주신 연락처로 연락드리겠습니다.',
    ].join('\n'),
  },
} as const

export type AlimtalkKind = keyof typeof TEMPLATES
export type AlimtalkStatus = 'sent' | 'failed' | 'skipped'
export type AlimtalkResult = { status: AlimtalkStatus; error: string | null }

/* 템플릿 변수 하나에 넣을 수 있는 길이 — 카카오 제한은 변수당 수백 자지만
   이름·업종 칸이라 짧게 자른다. 줄바꿈은 템플릿 모양을 깨므로 한 줄로 */
const VAR_MAX = 40

/* 받는 번호를 01012345678 꼴로 — 휴대폰이 아니면 null.
   문의 폼은 번호 모양을 묶지 않으므로(02-…, +82 10-…, 내선) 여기서 거른다 */
export function mobileOf(phone: string): string | null {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('82')) d = '0' + d.slice(2).replace(/^0/, '')
  return /^01[016789]\d{7,8}$/.test(d) ? d : null
}

let service: SolapiMessageService | null = null

export async function sendAlimtalk(
  kind: AlimtalkKind,
  phone: string,
  vars: Record<string, string>,
): Promise<AlimtalkResult> {
  const { SOLAPI_API_KEY: key, SOLAPI_API_SECRET: secret, SOLAPI_PF_ID: pfId } = process.env
  const templateId = process.env[TEMPLATES[kind].env]
  if (!key || !secret || !pfId || !templateId) {
    return { status: 'skipped', error: '알림톡 설정 없음' }
  }

  const to = mobileOf(phone)
  if (!to) return { status: 'skipped', error: '휴대폰 번호가 아님' }

  const from = process.env.SOLAPI_SENDER?.replace(/\D/g, '') || undefined
  const variables = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [`#{${k}}`, (v.replace(/\s+/g, ' ').trim() || '-').slice(0, VAR_MAX)]),
  )

  try {
    service ??= new SolapiMessageService(key, secret)
    const res = await service.send({
      to,
      ...(from ? { from } : {}),
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        /* 발신번호가 없으면 문자로 대신 보낼 수 없다 — 대체 발송을 끈다 */
        disableSms: !from,
      },
    })
    /* 접수만 확인된다 — 실제 도착 여부는 Solapi 콘솔 발송 내역에서 본다 */
    const failed = res.failedMessageList[0]
    if (failed) return { status: 'failed', error: `${failed.statusCode} ${failed.statusMessage}`.slice(0, 300) }
    return { status: 'sent', error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'failed', error: msg.slice(0, 300) }
  }
}

/* 접수 행에 발송 결과를 남긴다 — 0039 전 DB 에는 칸이 없어 실패하지만
   접수는 이미 저장됐으므로 로그만 남기고 넘어간다 */
export async function recordAlimtalk(table: 'inquiries' | 'marketing_leads', id: string, r: AlimtalkResult) {
  if (!supabaseAdmin) return
  const { error } = await supabaseAdmin.from(table).update({ alimtalk: r.status, alimtalk_error: r.error }).eq('id', id)
  if (error) {
    console.warn(`[alimtalk] ${table} 발송 결과 저장 실패 — 0039_alimtalk_status.sql 을 실행해 주세요:`, error.message)
  }
}
