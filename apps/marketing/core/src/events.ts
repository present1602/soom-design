/* 매장 이벤트. 대행사가 직접 입력하고, 콘텐츠를 만들 때 하나 골라 AI 에 넘긴다.
   콘텐츠에는 고른 시점의 내용을 그대로 복사해 둔다(나중에 이벤트를 고쳐도 이미 만든 콘텐츠의 기록은 그대로). */

export type StoreEvent = {
  id: string
  store_id: string
  title: string
  starts_on: string | null
  ends_on: string | null
  offer: string
  details: string
  archived: boolean
  created_at: string
  updated_at: string
}

/** 콘텐츠 settings 에 남기는 이벤트 사본 */
export type EventSnapshot = { id: string; title: string; startsOn: string | null; endsOn: string | null; offer: string; details: string }

export const toSnapshot = (e: StoreEvent): EventSnapshot => ({ id: e.id, title: e.title, startsOn: e.starts_on, endsOn: e.ends_on, offer: e.offer, details: e.details })

const md = (d: string) => {
  const [, m, day] = d.split('-')
  return `${Number(m)}월 ${Number(day)}일`
}

/** "11월 1일 – 11월 30일" · 시작만 · 끝만 · 없음 */
export function eventPeriod(e: { startsOn: string | null; endsOn: string | null }) {
  if (e.startsOn && e.endsOn) return e.startsOn === e.endsOn ? md(e.startsOn) : `${md(e.startsOn)} – ${md(e.endsOn)}`
  if (e.startsOn) return `${md(e.startsOn)}부터`
  if (e.endsOn) return `${md(e.endsOn)}까지`
  return ''
}

/** 오늘(YYYY-MM-DD) 기준 상태 */
export function eventState(e: { startsOn: string | null; endsOn: string | null }, today: string): 'upcoming' | 'running' | 'ended' {
  if (e.endsOn && e.endsOn < today) return 'ended'
  if (e.startsOn && e.startsOn > today) return 'upcoming'
  return 'running'
}

/** 프롬프트에 넣을 이벤트 요약 */
export function eventBrief(e: EventSnapshot, max = 500) {
  const period = eventPeriod(e)
  return [`이벤트: ${e.title}`, period && `기간: ${period}`, e.offer && `혜택: ${e.offer}`, e.details && `내용: ${e.details}`].filter(Boolean).join(' · ').slice(0, max)
}
