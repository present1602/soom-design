/* 콘솔이 jobs 표에 넣고 워커가 꺼내 처리하는 작업의 형식.
   payload 는 jsonb 라 양쪽이 이 타입으로 맞춘다. */

import type { VoiceDesignInput } from './voice'

export type JobPayloads = {
  /** 가상 모델 + 제품 이미지로 퍼스트 프레임 한 장 합성 (콘텐츠 만들기 전에 미리 봄) */
  compose_frame: { modelId: string; productPaths: string[]; prompt: string; moods: string[] }
  /** 숏폼 영상 생성 → 9:16 인코딩 → 썸네일 후보 추출 */
  generate_short: { contentId: string }
  /** 배너 시안 여러 장 생성 */
  generate_banner: { contentId: string }
  /** 가상 모델 후보 얼굴 생성. refPaths(최대 5장)가 있으면 그 사진들을 참고만 한 다른 인물로 만든다 */
  model_candidates: { gender: string; ageBand: string; mood: string; refPaths?: string[]; persona?: string }
  /** 가상 모델 각도 세트(model-shots.ts). shots 가 없으면 빠진 컷 전부, 있으면 그 컷만 */
  model_sheet: { modelId: string; shots?: string[] }
  /** 모델 이미지 한 장의 수정본을 n 장 만든다(model_images 는 건드리지 않는다 — 고르면 콘솔이 교체한다).
      edit = 지금 사진(basePath 가 있으면 그 수정본)을 instruction 대로 고치기, fresh = 그 컷을 처음부터 다시 그리기 */
  model_shot_edit: { modelId: string; imageId: string; mode: 'edit' | 'fresh'; instruction?: string; basePath?: string; n: number }
  /** 녹음 파일로 업체에 목소리 등록 (보이스 클로닝) */
  voice_clone: { modelId: string }
  /** 설명대로 목소리 후보 n 개 만들기 (Qwen3-TTS VoiceDesign). 보관하기 전까지 voice-candidates/ 에 둔다 */
  voice_design: { input: VoiceDesignInput; text: string; n: number }
  /** 매장 자료 소스 하나를 긁어 store_sources 에 저장 (core/src/crawl) */
  store_crawl: { sourceId: string }
  /** 한 채널에 업로드 */
  publish: { postId: string }
}

export type JobKind = keyof JobPayloads

export const JOB_KINDS: JobKind[] = ['compose_frame', 'generate_short', 'generate_banner', 'model_candidates', 'model_sheet', 'model_shot_edit', 'voice_clone', 'voice_design', 'store_crawl', 'publish']

/** 작업 결과 (jobs.result) */
export type JobResults = {
  compose_frame: { path: string; mock?: boolean }
  generate_short: { videoPath: string }
  generate_banner: { variantPaths: string[] }
  model_candidates: { paths: string[]; mock?: boolean }
  model_sheet: { made: string[]; failed: { label: string; error: string }[]; mock?: boolean }
  /** resolved: 콘솔에서 고른 뒤 적는다 — 남은 수정본을 다시 보여 주지 않는다 */
  model_shot_edit: { paths: string[]; mock?: boolean; resolved?: 'applied' | 'discarded' | 'continued' }
  voice_clone: { voiceId: string; mock?: boolean }
  /** instruct: AI 에 실제로 넘긴 설명 */
  voice_design: { paths: string[]; instruct: string; mock?: boolean }
  /** 무엇을 얼마나 가져왔는지 (목록 화면용 요약) */
  store_crawl: { name: string; counts: Record<string, number>; ms: number }
  publish: { url: string }
}
