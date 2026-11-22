/* 날짜는 한국 시간으로 짧게. 서버·브라우저 어느 쪽에서 불러도 같은 글자가 나오게 시간대를 고정한다. */
const fmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

export function pageOf(raw: string | string[] | undefined) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function str(raw: string | string[] | undefined) {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''
}
