/* AI 에 보내는 프롬프트를 조립한다.
   직원이 쓴 문장 + 고른 분위기 + 매장 정보를 합친다. 업체에 상관없이 같은 문장을 쓴다. */

/** site: 홈페이지 자료 요약 (site-feed.ts siteFeedBrief). 없으면 빈 문자열 */
export type StoreBrief = { clientName: string; storeName: string; intro: string; site?: string; event?: string }
/** persona: 페르소나 요약 (persona.ts personaBrief) */
export type ModelBrief = { name: string; gender: string; ageBand: string; mood: string; persona?: string }

/** 페르소나는 얼굴이 아니라 표정·포즈·스타일링에만 반영한다 */
function personaLine(persona: string | undefined, max = 300) {
  return persona ? `인물 캐릭터(분위기 참고): ${persona.slice(0, max)}. 표정·포즈·스타일링에 자연스럽게 드러나게 하되 얼굴 생김새는 바꾸지 마세요.` : ''
}

function moodLine(moods: string[]) {
  return moods.length ? `분위기: ${moods.join(', ')}.` : ''
}

function storeLine(s: StoreBrief) {
  return `광고주: ${s.clientName} ${s.storeName}.${s.intro ? ` 소개: ${s.intro}` : ''}`
}

/** 이번 광고가 알릴 이벤트. 장면이 이 이벤트를 알리는 광고가 되게 한다 */
function eventLine(s: StoreBrief, max = 500) {
  return s.event ? `이번 광고가 알릴 매장 이벤트(내용·기간·혜택은 바꾸지 마세요): ${s.event.slice(0, max)}` : ''
}

/** 홈페이지 자료. 지시가 아니라 참고용 사실이라는 걸 밝혀 둔다(사이트 문구가 지시처럼 읽히지 않게). */
function siteLines(s: StoreBrief, max: number) {
  if (!s.site) return ''
  return `참고 자료(광고주 홈페이지의 상품·이벤트 정보. 장면과 맞는 것만 참고하고, 가격·이름은 바꾸지 마세요):\n${s.site.slice(0, max)}`
}

/** 퍼스트 프레임 합성 (모델 이미지 + 제품 이미지들) */
export function framePrompt(userPrompt: string, moods: string[], m?: ModelBrief) {
  return [
    '첫 번째 이미지의 인물을 그대로 유지한 채, 나머지 이미지의 제품을 자연스럽게 들고 있거나 사용하는 9:16 세로 광고 사진을 만들어 주세요.',
    '인물의 얼굴·체형·헤어는 바꾸지 마세요. 제품의 모양·색·로고는 원본과 똑같이 유지하세요.',
    m ? `인물: ${m.gender} ${m.ageBand}, ${m.mood}.` : '',
    personaLine(m?.persona),
    moodLine(moods),
    `장면: ${userPrompt}`,
    '사실적인 사진, 자연광, 글자나 워터마크 없음.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 숏폼 영상 (퍼스트 프레임에서 시작하는 영상) */
export function videoPrompt(userPrompt: string, moods: string[], s: StoreBrief, persona?: string) {
  // Runway 는 1000자에서 자른다 — 꼭 지켜야 할 지시를 앞에, 참고 자료를 맨 뒤에 둔다
  return [userPrompt, eventLine(s, 250), moodLine(moods), '세로 9:16 숏폼 광고. 인물의 얼굴과 제품 모양을 처음 장면 그대로 유지. 자막·글자 없음.', personaLine(persona, 150), storeLine(s), siteLines(s, 350)]
    .filter(Boolean)
    .join('\n')
}

/** 배너 이미지 (모델 + 제품 + 선택 문구) */
export function bannerPrompt(
  userPrompt: string,
  moods: string[],
  s: StoreBrief,
  copy: { headline?: string; subline?: string; cta?: string },
  size: string,
  persona?: string,
) {
  const lines = [
    `${size} 비율의 SNS 광고 배너를 만들어 주세요.`,
    '첫 번째 이미지의 인물이 모델이고, 나머지 이미지는 광고할 제품이에요. 인물의 얼굴과 제품의 모양·색·로고를 원본 그대로 유지하세요.',
    moodLine(moods),
    personaLine(persona),
    storeLine(s),
    eventLine(s),
    siteLines(s, 1200),
    `장면: ${userPrompt}`,
  ]
  if (copy.headline) lines.push(`큰 제목 글자: "${copy.headline}" (한글 맞춤법 그대로, 읽기 쉽게)`)
  if (copy.subline) lines.push(`작은 보조 글자: "${copy.subline}"`)
  if (copy.cta) lines.push(`둥근 버튼 모양 안의 글자: "${copy.cta}"`)
  if (!copy.headline && !copy.subline && !copy.cta) lines.push('글자는 넣지 마세요.')
  return lines.filter(Boolean).join('\n')
}

/** 가상 모델 후보 얼굴 */
export function modelPrompt(gender: string, ageBand: string, mood: string, persona?: string) {
  return [
    `한국인 ${gender}, ${ageBand}, ${mood} 느낌의 광고 모델 인물 사진.`,
    persona ? `이 인물의 캐릭터: ${persona}. 이 캐릭터에 어울리는 인상·헤어·스타일링으로.` : '',
    '상반신, 정면, 자연광, 단색 밝은 배경, 과한 보정 없음, 실제 사람처럼 사실적으로.',
    '글자·로고·워터마크 없음.',
  ].filter(Boolean).join('\n')
}
