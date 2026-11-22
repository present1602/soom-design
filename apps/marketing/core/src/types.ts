import type { Platform } from './channels'
import type { EventSnapshot } from './events'
import type { HomepageSnapshot } from './homepage'
import type { Persona } from './persona'
import type { SiteFeed, SiteFeedUse } from './site-feed'

/* DB 행 모양 (supabase/migrations/0001_init.sql 과 맞춘다) */

export type AdminRole = 'super' | 'manager'
export type Admin = {
  id: string
  email: string
  nickname: string
  role: AdminRole
  active: boolean
  created_at: string
}

export type Client = {
  id: string
  code: string
  name: string
  rep_name: string
  phone: string
  email: string | null
  created_at: string
  updated_at: string
}

export type StoreKind = 'store' | 'brand'
export type Store = {
  id: string
  client_id: string
  name: string
  kind: StoreKind
  address: string
  phone: string
  hours: string
  intro: string
  sort: number
  /** 고객사 홈페이지 자료 API (0002_site_feed.sql). 비어 있으면 쓰지 않는다 */
  site_feed_url: string
  /** API 토큰. 서버 전용 — 화면으로 내려보내지 않는다 */
  site_feed_token: string | null
  /** 마지막으로 받은 자료. API 가 응답하지 않을 때 대신 쓴다 */
  site_feed_cache: SiteFeed | null
  site_feed_fetched_at: string | null
  /** 마지막 불러오기 실패 이유 (성공하면 null) */
  site_feed_error: string | null
  /** 홈페이지 주소 (0005_store_web_events.sql). 자료 API 가 없으면 이 페이지 글을 읽어 참고한다 */
  homepage_url?: string
  homepage_cache?: HomepageSnapshot | null
  homepage_fetched_at?: string | null
  homepage_error?: string | null
  created_at: string
}

export type ChannelStatus = 'pending' | 'connected' | 'expired' | 'manager'
export type StoreChannel = {
  id: string
  store_id: string
  platform: Platform
  handle: string
  profile_url: string
  status: ChannelStatus
  external_id: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export type ModelStatus = 'draft' | 'published' | 'hidden'
export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = { draft: '대기', published: '공개', hidden: '숨김' }
/** 화면 Pill 색 */
export const MODEL_STATUS_TONE: Record<ModelStatus, 'warn' | 'ok' | 'neutral'> = { draft: 'warn', published: 'ok', hidden: 'neutral' }
export const isModelStatus = (v: unknown): v is ModelStatus => v === 'draft' || v === 'published' || v === 'hidden'
/** 0008 전 DB 는 archived 로 판단한다 */
export const modelStatus = (m: { status?: string | null; archived: boolean }): ModelStatus => (isModelStatus(m.status) ? m.status : m.archived ? 'hidden' : 'published')

export type VirtualModel = {
  id: string
  name: string
  gender: string
  age_band: string
  mood: string
  voice: string
  source: 'ai' | 'photo'
  consent: boolean
  cover_path: string | null
  /** 예전 "목록에서 내리기". 0008 부터는 status 와 맞춰 둔다(status 가 published 가 아니면 true) */
  archived: boolean
  /** 0008_model_status.sql. 돌리기 전 DB 에는 없다 — modelStatus() 로 읽는다 */
  status?: ModelStatus
  /** 0003_voice.sql. preset = voice 칸의 기본 목소리, upload = 녹음 파일로 등록한 목소리,
      library = 목소리 보관함에서 고른 목소리(0006. voice 칸에 별칭, 샘플은 모델 폴더로 복사) */
  voice_source?: 'preset' | 'upload' | 'library'
  /** 0006_voice_library.sql. 고른 보관함 목소리 */
  voice_library_id?: string | null
  voice_sample_path?: string | null
  /** 녹음한 사람의 광고 사용 동의 */
  voice_consent?: boolean
  /** 업체(ElevenLabs)에 등록된 목소리 id. upload 인데 비어 있으면 등록 중이거나 실패 */
  voice_provider_id?: string | null
  voice_error?: string | null
  /** 0004_persona.sql. 녹음 목소리를 읽을 엔진 (qwen | elevenlabs) */
  voice_engine?: string | null
  /** 녹음에서 읽은 문장 (Qwen3-TTS 품질용) */
  voice_sample_text?: string | null
  /** 직업·MBTI·성격·취미·말투 같은 캐릭터 설정 */
  persona?: Persona | null
  created_at: string
}

/** 매장 자료 소스 (0007_store_sources.sql). data 는 crawl/common.ts 의 CrawlResult */
export type StoreSource = {
  id: string
  store_id: string
  kind: 'naver_place' | 'kakao_place' | 'daangn' | 'instagram' | 'homepage'
  url: string
  data: unknown | null
  fetched_at: string | null
  prev_data: unknown | null
  prev_fetched_at: string | null
  error: string | null
  created_at: string
  updated_at: string
}

/** 목소리 보관함 (0006_voice_library.sql) */
export type LibraryVoice = {
  id: string
  alias: string
  gender: 'female' | 'male'
  description: string
  instruct: string
  engine: string
  sample_path: string
  sample_text: string
  archived: boolean
  created_by: string | null
  created_at: string
}

export type ModelImage = {
  id: string
  model_id: string
  label: string
  path: string
  sort: number
  created_at: string
}

export type MoodOption = {
  id: string
  label: string
  sort: number
  active: boolean
  created_at: string
}

export type ContentType = 'short' | 'banner'
export type ContentStatus = 'generating' | 'ready' | 'failed' | 'published'

/** 생성 화면에서 고른 값. 형식마다 쓰는 칸이 다르다. */
export type ContentSettings = {
  /** 숏폼 길이(초) — 15·30초는 구간을 이어 붙인다 */
  length?: 5 | 10 | 15 | 30
  /** 썸네일: ai = 추천 중 고르기, auto = 첫 장면, upload = 직접 올림 */
  thumbMode?: 'ai' | 'auto' | 'upload'
  /** 퍼스트 프레임: none = AI 가 정함, upload = 직접, ai = 모델+제품 합성 */
  firstFrame?: 'none' | 'upload' | 'ai'
  /** 배너 크기 */
  size?: '1:1' | '4:5' | '9:16'
  variants?: 2 | 4
  headline?: string
  subline?: string
  cta?: string
  /** 워커가 모의 생성으로 만들었는지 (AI_MODE=mock) */
  mock?: boolean
  /** 생성 직전에 불러온 홈페이지 자료 */
  siteFeed?: SiteFeedUse
  /** 고른 매장 이벤트 (고른 시점의 사본) */
  event?: EventSnapshot
  /** 숏폼 내레이션 대본 (모델 목소리로 읽어 영상에 입힌다) */
  narration?: string
  /** 워커가 내레이션을 실제로 입혔는지 */
  narrated?: boolean
}

export type Content = {
  id: string
  store_id: string
  type: ContentType
  status: ContentStatus
  title: string
  prompt: string
  moods: string[]
  model_id: string | null
  settings: ContentSettings
  error: string | null
  created_by: string | null
  created_at: string
  published_at: string | null
}

export type AssetKind = 'product' | 'reference' | 'first_frame' | 'video' | 'thumb_candidate' | 'thumbnail' | 'variant' | 'narration'
export type ContentAsset = {
  id: string
  content_id: string
  kind: AssetKind
  path: string
  sort: number
  selected: boolean
  meta: Record<string, unknown>
  created_at: string
}

export type PostStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'manual'
export type ContentPost = {
  id: string
  content_id: string
  channel_id: string | null
  platform: Platform
  status: PostStatus
  caption: string
  post_url: string | null
  error: string | null
  posted_at: string | null
  created_at: string
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed'
export type Job = {
  id: string
  kind: string
  payload: Record<string, unknown>
  status: JobStatus
  attempts: number
  max_attempts: number
  run_after: string
  locked_at: string | null
  locked_by: string | null
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  updated_at: string
}
