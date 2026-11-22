/* 가상 모델 "각도 세트".
   영상에는 첫 장면 한 장만 넘어가지만, 그 장면을 만들 때 장면에 맞는 각도의 기준 컷을 함께 넣어야
   콘텐츠마다 옆모습·위아래 각도가 다른 사람처럼 바뀌지 않는다. 그래서 모델을 만들 때 같은 얼굴로
   얼굴 15장 + 전신 4장을 한 번 뽑아 고정해 둔다.

   - 컷은 model_images.label 로 구분한다(컷 이름이 곧 label). 이미 있는 컷은 다시 만들지 않는다.
   - 모든 컷은 대표 이미지(+ 얼굴 정면·전신 정면)를 기준으로 그린다.
   - "좌/우"는 화면 기준이다(인물이 화면 왼쪽/오른쪽을 바라봄). */

export type ShotKind = 'face' | 'body'
/** key 는 저장소 파일 이름에 쓰는 영문 이름이다(models/<모델ID>/face-front-1a2b3c4d.png). 경로에는 한글을 넣지 않는다. */
export type Shot = { label: string; key: string; kind: ShotKind; pose: string; expr?: string }

export const FACE_FRONT = '얼굴 정면'
export const BODY_FRONT = '전신 정면'

export const SHOTS: Shot[] = [
  // 얼굴 15 — 눈높이 회전 7 · 위에서 3 · 아래에서 3 · 표정 2
  { label: FACE_FRONT, key: 'face-front', kind: 'face', pose: '정면, 카메라는 눈높이 (front view, eye level)' },
  { label: '얼굴 좌 30°', key: 'face-l30', kind: 'face', pose: '카메라는 눈높이, 인물이 화면 왼쪽으로 30° 고개를 돌림 (slight three-quarter view, facing screen-left)' },
  { label: '얼굴 우 30°', key: 'face-r30', kind: 'face', pose: '카메라는 눈높이, 인물이 화면 오른쪽으로 30° 고개를 돌림 (slight three-quarter view, facing screen-right)' },
  { label: '얼굴 좌 60°', key: 'face-l60', kind: 'face', pose: '카메라는 눈높이, 인물이 화면 왼쪽으로 60° 고개를 돌림 (three-quarter view, facing screen-left)' },
  { label: '얼굴 우 60°', key: 'face-r60', kind: 'face', pose: '카메라는 눈높이, 인물이 화면 오른쪽으로 60° 고개를 돌림 (three-quarter view, facing screen-right)' },
  { label: '얼굴 좌 옆모습', key: 'face-l-profile', kind: 'face', pose: '카메라는 눈높이, 화면 왼쪽을 바라보는 완전한 옆모습 (full profile, facing screen-left)' },
  { label: '얼굴 우 옆모습', key: 'face-r-profile', kind: 'face', pose: '카메라는 눈높이, 화면 오른쪽을 바라보는 완전한 옆모습 (full profile, facing screen-right)' },
  { label: '위에서 정면', key: 'high-front', kind: 'face', pose: '카메라가 머리 위쪽 약 35°에서 내려다보고, 인물은 카메라를 올려다봄 (high angle, front)' },
  { label: '위에서 좌 45°', key: 'high-l45', kind: 'face', pose: '카메라가 위쪽 약 35°에서 내려다보고, 인물은 화면 왼쪽으로 45° 고개를 돌림 (high angle, three-quarter left)' },
  { label: '위에서 우 45°', key: 'high-r45', kind: 'face', pose: '카메라가 위쪽 약 35°에서 내려다보고, 인물은 화면 오른쪽으로 45° 고개를 돌림 (high angle, three-quarter right)' },
  { label: '아래에서 정면', key: 'low-front', kind: 'face', pose: '카메라가 턱 아래쪽 약 30°에서 올려다봄, 인물은 정면 (low angle, front)' },
  { label: '아래에서 좌 45°', key: 'low-l45', kind: 'face', pose: '카메라가 아래쪽 약 30°에서 올려다보고, 인물은 화면 왼쪽으로 45° 고개를 돌림 (low angle, three-quarter left)' },
  { label: '아래에서 우 45°', key: 'low-r45', kind: 'face', pose: '카메라가 아래쪽 약 30°에서 올려다보고, 인물은 화면 오른쪽으로 45° 고개를 돌림 (low angle, three-quarter right)' },
  { label: '미소', key: 'smile', kind: 'face', pose: '정면, 카메라는 눈높이', expr: '입을 다문 자연스러운 미소' },
  { label: '활짝 웃음', key: 'laugh', kind: 'face', pose: '정면, 카메라는 눈높이', expr: '이가 보이게 활짝 웃음' },
  // 전신 4 — 정면·뒷모습·옆·3/4. 같은 기본 의상으로 체형을 고정
  { label: BODY_FRONT, key: 'body-front', kind: 'body', pose: '정면으로 똑바로 선 전신 (full body, front)' },
  { label: '전신 뒷모습', key: 'body-back', kind: 'body', pose: '뒤돌아 선 전신, 뒷모습 (full body, back view)' },
  { label: '전신 좌 옆', key: 'body-l-side', kind: 'body', pose: '화면 왼쪽을 바라보고 선 전신 옆모습 (full body, profile facing screen-left)' },
  { label: '전신 3/4', key: 'body-three-quarter', kind: 'body', pose: '화면 왼쪽으로 45° 몸을 튼 전신 (full body, three-quarter)' },
]

export const SHOT_LABELS = new Set(SHOTS.map((s) => s.label))
export const shotOf = (label: string) => SHOTS.find((s) => s.label === label)

/** 전신 컷은 체형을 비교할 수 있게 의상을 하나로 고정한다. 장면별 의상은 콘텐츠 프롬프트에서 바꾼다. */
const BASE_OUTFIT = '무지 흰색 반팔 티셔츠, 일자 청바지, 흰 운동화'

export type ModelLook = { gender: string; ageBand: string; mood: string; persona?: string }

/** 기준 이미지들의 인물 그대로, 정해진 각도로 한 장 */
export function shotPrompt(shot: Shot, m: ModelLook, refCount: number) {
  return [
    `첨부한 ${refCount > 1 ? `이미지 ${refCount}장은 모두 같은 인물이에요. 이` : '이미지의'} 인물과 완전히 같은 사람을 그려 주세요.`,
    '얼굴형, 눈·코·입의 모양과 간격, 눈썹, 피부톤, 헤어스타일과 머리색, 체형을 바꾸지 마세요.',
    `인물: 한국인 ${m.gender}, ${m.ageBand}.`,
    `구도: ${shot.pose}.`,
    shot.kind === 'face' ? '머리와 어깨가 보이는 클로즈업, 얼굴이 화면의 중심.' : `머리부터 발끝까지 화면 안에. 의상: ${BASE_OUTFIT}.`,
    `표정: ${shot.expr ?? '편안한 무표정'}.`,
    '배경: 밝은 회색 단색 스튜디오, 부드럽고 고른 조명. 실제 사람처럼 사실적인 사진. 글자·로고·워터마크 없음.',
  ].join('\n')
}

/** 실제 인물 사진을 "참고만" 해서 실존하지 않는 다른 인물 후보를 만든다(초상권 회피). */
export function inspirePrompt(m: ModelLook, refCount = 1) {
  return [
    `첨부한 사진${refCount > 1 ? ` ${refCount}장` : ''}은 분위기 참고용이에요. 사진 속 사람${refCount > 1 ? '들' : ''}과 다른, 실존하지 않는 새로운 인물의 광고 모델 사진을 만들어 주세요.`,
    `참고만 할 것: 전체적인 분위기, 헤어스타일의 느낌, 스타일링, 사진 톤.${refCount > 1 ? ' 여러 장의 공통된 느낌을 따르세요.' : ''}`,
    '반드시 바꿀 것: 얼굴형, 눈·코·입의 모양과 간격, 눈썹, 턱선, 점·흉터 같은 고유한 특징. 원본 인물로 알아볼 수 없는 다른 사람이어야 해요.',
    `인물: 한국인 ${m.gender}, ${m.ageBand}, ${m.mood}.`,
    m.persona ? `이 인물의 캐릭터: ${m.persona}. 이 캐릭터에 어울리는 인상·헤어·스타일링으로.` : '',
    '상반신, 정면, 자연광, 단색 밝은 배경, 과한 보정 없음, 실제 사람처럼 사실적으로. 글자·로고·워터마크 없음.',
  ].filter(Boolean).join('\n')
}

/** 모델 이미지 한 장 고치기(각도 세트 컷이든 직접 올린 이미지든).
    첫 이미지가 고칠 사진이고, 뒤는 같은 인물의 기준 사진(대표·얼굴 정면·전신 정면)이다.
    "말한 부분만" 고치게 하지만 이미지 AI 는 다른 곳도 조금씩 바꾼다 — 그래서 콘솔에서 비교하고 고른다. */
export function shotEditPrompt(label: string, m: ModelLook, instruction: string, refCount: number) {
  const shot = shotOf(label)
  return [
    '첫 번째 이미지를 고쳐 주세요. 아래 "고칠 내용"만 바꾸고 나머지는 최대한 그대로 두세요.',
    refCount > 1 ? `나머지 이미지 ${refCount - 1}장은 같은 인물의 기준 사진이에요. 얼굴 생김새와 체형 비율은 이 사진들과 같은 사람으로 맞춰 주세요.` : '',
    `고칠 내용: ${instruction}`,
    `그대로 둘 것: 구도와 포즈${shot ? `(${shot.pose})` : ''}, 의상, 배경, 조명, 헤어스타일과 머리색.`,
    `인물: 한국인 ${m.gender}, ${m.ageBand}.`,
    '실제 사람처럼 사실적인 사진. 글자·로고·워터마크 없음.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 수정 칸의 빠른 문구 */
export const EDIT_SUGGESTIONS = ['얼굴을 조금 더 작게', '머리 길이를 기준 사진과 같게', '표정을 더 자연스럽게', '체형 비율을 전신 정면과 같게', '피부톤을 기준 사진과 같게']
