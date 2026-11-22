/* 숏폼 길이. Runway 는 한 번에 5초·10초만 만들 수 있어서,
   15·30초는 앞 구간의 마지막 장면에서 다음 구간을 이어 만들어 붙인다. */

export const SHORT_LENGTHS = [5, 10, 15, 30] as const
export type ShortLength = (typeof SHORT_LENGTHS)[number]

export const isShortLength = (v: unknown): v is ShortLength => SHORT_LENGTHS.includes(v as ShortLength)

/** 저장된 값을 안전하게 읽는다 (없거나 이상하면 10초) */
export const toShortLength = (v: unknown): ShortLength => (isShortLength(v) ? v : 10)

/** AI 로 만들 구간들 (각 5 또는 10초) */
export function segmentsOf(len: ShortLength): (5 | 10)[] {
  if (len === 5) return [5]
  if (len === 10) return [10]
  if (len === 15) return [10, 5]
  return [10, 10, 10]
}
