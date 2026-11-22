/* 가상 모델 목소리 · 숏폼 내레이션.
   - preset: 업체(ElevenLabs) 기본 목소리 중 하나. 화면에는 "맑은 여성" 같은 이름만 보인다.
   - upload: 직원이 올린 녹음 파일로 업체에 목소리를 등록(보이스 클로닝)하고 받은 voice_id 를 모델에 둔다.
     실제 사람 목소리라 녹음한 사람의 광고 사용 동의를 받아야 저장된다.
   내레이션은 화면 밖 목소리(보이스오버)로 영상에 입힌다. 입 모양 맞추기(립싱크)는 하지 않는다. */

export type VoicePreset = { label: string; gender: 'female' | 'male'; hint: string }

export const VOICE_PRESETS: VoicePreset[] = [
  { label: '맑은 여성', gender: 'female', hint: 'young bright clear' },
  { label: '또렷한 여성', gender: 'female', hint: 'confident professional' },
  { label: '부드러운 여성', gender: 'female', hint: 'soft warm calm' },
  { label: '중저음 남성', gender: 'male', hint: 'deep calm' },
  { label: '밝은 남성', gender: 'male', hint: 'young friendly' },
  { label: '굵은 남성', gender: 'male', hint: 'strong deep' },
]

/** 녹음 목소리를 읽을 엔진. 모델마다 고른다(core/src/ai/voice 의 업체 이름과 같다). 기본 목소리는 ElevenLabs 로 읽는다. */
export const VOICE_ENGINES = [
  { id: 'qwen', label: 'Qwen3-TTS', note: '무료 · 자체 GPU 서버. 녹음에서 읽은 문장을 함께 적으면 훨씬 비슷해져요. 녹음은 10–20초가 알맞아요.' },
  { id: 'elevenlabs', label: 'ElevenLabs', note: '유료(Starter 이상) · 업체에 목소리를 등록해요. 녹음은 1–3분이 알맞아요.' },
] as const
export type VoiceEngine = (typeof VOICE_ENGINES)[number]['id']
export const isVoiceEngine = (v: unknown): v is VoiceEngine => VOICE_ENGINES.some((e) => e.id === v)

export const isVoicePreset = (v: unknown): v is string => typeof v === 'string' && VOICE_PRESETS.some((p) => p.label === v)

/** 녹음 파일 안내: 업체 권장은 잡음 없는 한 사람 목소리 1–3분 */
export const VOICE_SAMPLE_HINT = '한 사람 목소리만, 잡음 없이 1–3분. 평소 광고에서 쓸 말투로 읽은 녹음이 좋아요.'

/* ───────── 목소리 만들기 (보관함, 0006_voice_library.sql) ─────────
   설명을 고르면 Qwen3-TTS VoiceDesign 이 후보 목소리를 만든다. 이 모델은 영어(·중국어) 설명만 제대로 알아듣고
   한국어 설명은 거의 무시한다(2026-11-22 시험: "60대 할아버지"가 여성 음역으로 나옴). 그래서 칩은 영어로 바꿔 넘기고,
   직접 적은 추가 설명은 워커가 영어로 옮겨 붙인다(core/src/ai/translate.ts). */

export type VoiceGender = 'female' | 'male'
export const VOICE_GENDERS: { id: VoiceGender; label: string }[] = [
  { id: 'female', label: '여성' },
  { id: 'male', label: '남성' },
]
export const isVoiceGender = (v: unknown): v is VoiceGender => v === 'female' || v === 'male'
/** 모델 성별('여성'·'남성') → 목소리 성별 */
export const voiceGenderOf = (modelGender: string): VoiceGender => (modelGender === '남성' ? 'male' : 'female')

type Opt = { label: string; en: string }
export const VOICE_AGES: Opt[] = [
  { label: '10대', en: 'a teenager' },
  { label: '20대', en: 'in their 20s' },
  { label: '30대', en: 'in their 30s' },
  { label: '40대', en: 'in their 40s' },
  { label: '50대 이상', en: 'in their late 50s or 60s' },
]
export const VOICE_PITCHES: Opt[] = [
  { label: '높은 톤', en: 'a high-pitched voice' },
  { label: '보통 톤', en: 'a medium-pitched voice' },
  { label: '중저음', en: 'a low, deep voice' },
]
export const VOICE_TONES: Opt[] = [
  { label: '따뜻한', en: 'warm' },
  { label: '밝은', en: 'bright' },
  { label: '맑은', en: 'clear' },
  { label: '부드러운', en: 'soft and gentle' },
  { label: '차분한', en: 'calm' },
  { label: '활기찬', en: 'energetic and lively' },
  { label: '신뢰감 있는', en: 'trustworthy and confident' },
  { label: '귀여운', en: 'cute' },
  { label: '허스키한', en: 'husky and slightly raspy' },
  { label: '세련된', en: 'sophisticated' },
]
export const VOICE_SPEEDS: Opt[] = [
  { label: '느리게', en: 'speaking slowly' },
  { label: '보통 속도', en: 'speaking at a natural pace' },
  { label: '빠르게', en: 'speaking quickly' },
]

export type VoiceDesignInput = { gender: VoiceGender; age: string; pitch: string; tones: string[]; speed: string; extra: string }

const en = (opts: Opt[], label: string) => opts.find((o) => o.label === label)?.en
export const MAX_VOICE_TONES = 3

/** 칩 → 한국어 한 줄(화면·기본 별칭용). 예: "30대 남성 · 중저음 · 따뜻한, 차분한" */
export function describeVoice(v: VoiceDesignInput) {
  const g = v.gender === 'male' ? '남성' : '여성'
  return [`${v.age ? `${v.age} ` : ''}${g}`, v.pitch, v.tones.join(', '), v.speed !== '보통 속도' ? v.speed : '', v.extra.trim()].filter(Boolean).join(' · ')
}

/** 칩 → 영어 설명. extraEn: 추가 설명을 영어로 옮긴 것 */
export function voiceInstruct(v: VoiceDesignInput, extraEn: string) {
  const age = en(VOICE_AGES, v.age)?.replace('their', v.gender === 'male' ? 'his' : 'her')
  const who = `A Korean ${v.gender === 'male' ? 'man' : 'woman'}${age ? ` ${age}` : ''}`
  const pitch = en(VOICE_PITCHES, v.pitch)
  const tones = v.tones.map((t) => en(VOICE_TONES, t)).filter(Boolean)
  const speed = en(VOICE_SPEEDS, v.speed)
  const s1 = `${who}${pitch ? ` with ${pitch}` : ''}.`
  const s2 = tones.length ? ` The tone is ${tones.join(', ')}.` : ''
  const s3 = speed ? ` ${speed[0].toUpperCase()}${speed.slice(1)}, like a natural social media ad narration.` : ''
  return `${s1}${s2}${s3}${extraEn.trim() ? ` ${extraEn.trim()}` : ''}`.slice(0, 600)
}

/** 후보를 들어 볼 때 읽는 문장. 보관하면 이 문장이 그 목소리의 "녹음에서 읽은 문장"이 된다 */
export const VOICE_DESIGN_TEXT = '안녕하세요! 오늘 새로 나온 시그니처 메뉴, 제가 직접 먹어봤는데요. 진짜 한 입 먹자마자 반했어요.'
export const VOICE_DESIGN_N = 4

/** 한국어 내레이션은 1초에 대략 6–7자. 영상보다 길면 뒤가 잘린다 */
export const narrationLimit = (seconds: number) => Math.round(seconds * 7)
export const NARRATION_MAX = 220
