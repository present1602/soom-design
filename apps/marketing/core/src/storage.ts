/* 파일은 비공개 버킷 하나에 둔다(0001_init.sql). 화면에는 서명 링크로만 보인다.

   경로 규칙
   - uploads/<yyyy-mm>/<uuid>.<ext>       직원이 올린 원본(제품·참고·퍼스트 프레임·썸네일). 모델 사진·녹음도 처음엔 여기로 올라온다
   - candidates/<yyyy-mm>/<uuid>.png      모델을 저장하기 전에 AI 가 만든 얼굴 후보 4장
   - models/<모델ID>/<이름>-<8자>.<ext>    모델 한 명의 파일 — 대표(cover-)·기준 컷(face-front- 등)·참고(ref-)·녹음(voice-)
   - voice-candidates/<yyyy-mm>/<uuid>.mp3  AI 가 설명대로 만든 목소리 후보(보관하기 전)
   - voices/<목소리ID>/sample-<8자>.mp3   목소리 보관함의 샘플 (0006_voice_library.sql)
   - generated/<yyyy-mm>/<uuid>.<ext>     그 밖에 AI·워커가 만든 결과(영상·장면·내레이션·배너)
   - sources/<모델ID>/…                   초상권 확인용 보관. 모델을 만들 때 넣은 실제 인물 사진의 사본과
                                          info.json(모델 이름·만든 사람·시각·동의 여부). 앱은 읽지도 지우지도 않고 DB 에도 없다

   모델 파일은 모델 폴더에 모은다. 저장할 때 uploads/·candidates/ 에서 복사해 오고(console lib/model-files.ts),
   기준 컷은 워커가 처음부터 모델 폴더에 쓴다. 어떤 파일이 대표인지는 파일 이름이 아니라
   virtual_models.cover_path 가 정한다 — 이름의 cover- 는 대시보드에서 알아보기 쉽게 붙일 뿐이다.
   이 규칙 전에 만든 모델 파일은 generated/·uploads/ 에 그대로 두고 쓴다. */
export const BUCKET = 'marketing'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** 목소리 녹음 파일 (m4a 는 브라우저마다 audio/mp4 · audio/x-m4a 로 온다) */
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm', 'audio/ogg'] as const
export const MAX_PRODUCT_IMAGES = 10
export const MAX_REFERENCE_IMAGES = 5

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
}

export function extFor(mime: string) {
  return EXT[mime] ?? 'bin'
}

function month() {
  return new Date().toISOString().slice(0, 7)
}

export function uploadPath(mime: string) {
  return `uploads/${month()}/${crypto.randomUUID()}.${extFor(mime)}`
}

export function generatedPath(ext: 'png' | 'jpg' | 'mp4' | 'mp3') {
  return `generated/${month()}/${crypto.randomUUID()}.${ext}`
}

export function candidatePath() {
  return `candidates/${month()}/${crypto.randomUUID()}.png`
}

export function voiceCandidatePath() {
  return `voice-candidates/${month()}/${crypto.randomUUID()}.mp3`
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const IMAGE_EXT = 'jpg|png|webp'
const AUDIO_EXT = 'mp3|wav|m4a|webm|ogg'

/** 모델 폴더 안 파일 이름. name 은 영문 소문자·숫자·하이픈(cover, ref, voice, 컷 key).
    같은 이름을 다시 만들어도 겹치지 않게 뒤에 8자를 붙인다 — 덮어쓰면 받아 둔 서명 링크가 옛 그림을 보여 준다. */
export function modelFilePath(modelId: string, name: string, ext: string) {
  if (!new RegExp(`^${UUID}$`).test(modelId)) throw new Error(`모델 ID 가 올바르지 않아요: ${modelId}`)
  if (!/^[a-z0-9-]{1,40}$/.test(name)) throw new Error(`모델 파일 이름이 올바르지 않아요: ${name}`)
  return `models/${modelId}/${name}-${crypto.randomUUID().slice(0, 8)}.${ext}`
}

/** 초상권 확인용 보관 경로 — sources/<모델ID>/<이름>-<8자>.<ext>. 폴더 이름이 곧 어느 모델에 쓰인 사진인지다. */
export function sourcePath(modelId: string, name: string, ext: string) {
  return modelFilePath(modelId, name, ext).replace(/^models\//, 'sources/')
}

/** 경로의 확장자 (복사할 때 그대로 쓴다) */
export function extOfPath(p: string) {
  return p.slice(p.lastIndexOf('.') + 1)
}

/** AI 얼굴 후보 경로인지 */
export function isCandidatePath(p: unknown): p is string {
  return typeof p === 'string' && new RegExp(`^candidates/\\d{4}-\\d{2}/${UUID}\\.png$`).test(p)
}

/* modelId 를 주면 그 모델 폴더만 받는다 — 다른 모델의 파일을 끼워 넣지 못하게 */
function modelDir(modelId?: string) {
  if (modelId === undefined) return UUID
  return new RegExp(`^${UUID}$`).test(modelId) ? modelId : null
}
/** 모델 폴더의 이미지인지 */
export function isModelImagePath(p: unknown, modelId?: string): p is string {
  const dir = modelDir(modelId)
  return typeof p === 'string' && !!dir && new RegExp(`^models/${dir}/[a-z0-9-]+-[0-9a-f]{8}\\.(${IMAGE_EXT})$`).test(p)
}
/** 모델 폴더의 녹음인지 */
export function isModelAudioPath(p: unknown, modelId?: string): p is string {
  const dir = modelDir(modelId)
  return typeof p === 'string' && !!dir && new RegExp(`^models/${dir}/voice-[0-9a-f]{8}\\.(${AUDIO_EXT})$`).test(p)
}

/** 직원이 올린 경로인지 — 서버 액션이 남의 경로를 끼워 넣지 못하게 막는다 */
export function isUploadPath(p: unknown): p is string {
  return typeof p === 'string' && /^uploads\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(p)
}
export function isAudioUploadPath(p: unknown): p is string {
  return typeof p === 'string' && /^uploads\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(mp3|wav|m4a|webm|ogg)$/.test(p)
}
export function isGeneratedPath(p: unknown): p is string {
  return typeof p === 'string' && /^generated\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|mp4|mp3)$/.test(p)
}

/** AI 목소리 후보 경로인지 */
export function isVoiceCandidatePath(p: unknown): p is string {
  return typeof p === 'string' && new RegExp(`^voice-candidates/\\d{4}-\\d{2}/${UUID}\\.mp3$`).test(p)
}
/** 목소리 보관함 샘플 경로 */
export function voiceLibraryPath(voiceId: string) {
  if (!new RegExp(`^${UUID}$`).test(voiceId)) throw new Error(`목소리 ID 가 올바르지 않아요: ${voiceId}`)
  return `voices/${voiceId}/sample-${crypto.randomUUID().slice(0, 8)}.mp3`
}
