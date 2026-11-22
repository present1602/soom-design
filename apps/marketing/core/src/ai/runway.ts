/* Runway 이미지→영상 (참고: proj/main-repo talents-hub/lib/ai-providers/runway.ts)
   퍼스트 프레임을 data URI 로 넘긴다 — 우리 저장소 주소가 외부에서 안 열려도(로컬 개발) 동작한다. */

import { AiError, networkError, runwayError, runwayTaskError } from './errors'

const BASE = 'https://api.dev.runwayml.com'

function cfg() {
  const apiKey = process.env.RUNWAY_API_KEY
  if (!apiKey) throw new AiError('runway', 'auth', 'RUNWAY_API_KEY 가 없어 영상을 만들 수 없어요. worker/.env.local 에 넣거나 AI_MODE=mock 으로 두세요.')
  return {
    apiKey,
    version: process.env.RUNWAY_API_VERSION || '2024-11-06',
    model: process.env.RUNWAY_MODEL || 'gen4_turbo',
  }
}

export type RunwayTask = { state: 'processing' | 'succeed' | 'failed'; videoUrl: string | null; failure: AiError | null }

export async function startImageToVideo(p: { imageDataUri: string; prompt: string; duration: 5 | 10; ratio?: string }) {
  const c = cfg()
  let res: Response
  try {
    res = await fetch(`${BASE}/v1/image_to_video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}`, 'X-Runway-Version': c.version },
    body: JSON.stringify({
      model: c.model,
      promptImage: [{ uri: p.imageDataUri, position: 'first' }],
      promptText: p.prompt.slice(0, 1000),
      ratio: p.ratio ?? '720:1280',
      duration: p.duration,
    }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    throw networkError('runway', e)
  }
  if (!res.ok) throw runwayError(res.status, await res.text(), '영상 생성 요청')
  const j = (await res.json()) as { id?: string }
  if (!j.id) throw new Error('영상 생성 작업 번호를 받지 못했어요')
  return j.id
}

export async function pollTask(taskId: string): Promise<RunwayTask> {
  const c = cfg()
  let res: Response
  try {
    res = await fetch(`${BASE}/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${c.apiKey}`, 'X-Runway-Version': c.version },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw networkError('runway', e)
  }
  if (!res.ok) throw runwayError(res.status, await res.text(), '영상 생성 상태 확인')
  const j = (await res.json()) as { status?: string; output?: string[]; failure?: string; failureCode?: string }
  const s = j.status ?? 'PENDING'
  const state = s === 'SUCCEEDED' ? 'succeed' : s === 'FAILED' || s === 'CANCELED' ? 'failed' : 'processing'
  return {
    state,
    videoUrl: state === 'succeed' ? (j.output?.[0] ?? null) : null,
    failure: state === 'failed' ? runwayTaskError(j.failure, j.failureCode) : null,
  }
}
