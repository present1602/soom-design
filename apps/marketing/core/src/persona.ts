/* 가상 모델 페르소나 — 실존하지 않지만 특색 있는 인물로 보이게 하는 설정.
   예: 아이돌 가수 · ENFP · 운동을 좋아함 · 처음 보는 사람과도 금방 친해짐.
   AI 프롬프트(후보 얼굴, 첫 장면, 배너, 영상)에 "분위기 참고"로 들어가 표정·포즈·스타일링에 반영된다.
   얼굴 생김새는 바꾸지 않는다(각도 세트·기준 이미지가 정한다). */

export type Persona = {
  /** 직업·캐릭터 (예: 아이돌 가수, 필라테스 강사) */
  role?: string
  mbti?: string
  /** 성격 키워드 (예: 밝음, 친근함, 장난기) */
  traits?: string[]
  /** 취미·관심사 */
  hobbies?: string[]
  /** 말투 (예: 반말 섞인 친근한 말투, 또박또박한 존댓말) */
  speech?: string
  /** 자유 소개 — 배경 이야기, 좋아하는 것, 쓰지 않는 표현 등 */
  bio?: string
}

export const MBTIS = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'] as const

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const list = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、\n]/) : [])
    .map((x) => str(x, 30))
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 12)

/** 화면에서 온 값을 정리한다. 빈 칸은 뺀다. */
export function cleanPersona(raw: unknown): Persona {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mbti = str(r.mbti, 4).toUpperCase()
  const p: Persona = {
    role: str(r.role, 60) || undefined,
    mbti: (MBTIS as readonly string[]).includes(mbti) ? mbti : undefined,
    traits: list(r.traits),
    hobbies: list(r.hobbies),
    speech: str(r.speech, 120) || undefined,
    bio: str(r.bio, 600) || undefined,
  }
  if (!p.traits?.length) delete p.traits
  if (!p.hobbies?.length) delete p.hobbies
  for (const k of Object.keys(p) as (keyof Persona)[]) if (p[k] === undefined) delete p[k]
  return p
}

export const isEmptyPersona = (p: Persona | null | undefined) => !p || Object.keys(p).length === 0

/** 프롬프트용 한 줄 요약. max 글자 안으로 중요한 것부터 */
export function personaBrief(p: Persona | null | undefined, max = 300) {
  if (isEmptyPersona(p)) return ''
  const parts = [
    p!.role,
    p!.mbti && `MBTI ${p!.mbti}`,
    p!.traits?.length && `성격: ${p!.traits.join(', ')}`,
    p!.hobbies?.length && `취미: ${p!.hobbies.join(', ')}`,
    p!.speech && `말투: ${p!.speech}`,
    p!.bio,
  ].filter(Boolean) as string[]
  let out = ''
  for (const s of parts) {
    const next = out ? `${out} · ${s}` : s
    if (next.length > max) break
    out = next
  }
  return out
}
