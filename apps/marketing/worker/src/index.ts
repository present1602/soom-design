/* 작업 큐 워커.
   jobs 표에서 하나씩 꺼내(claim_job) 처리하고 결과를 적는다. 콘솔은 그 표를 보고 화면을 갱신한다.
   `--once` 로 돌리면 쌓인 작업만 처리하고 끝난다(크론·Cloud Run Job 용). */
import { isFatalAiError } from '@marketing/core/ai/errors'
import type { Job } from '@marketing/core/types'
import type { JobKind, JobPayloads } from '@marketing/core/jobs'
import { db } from './db'
import { env } from './env'
import { composeFrameJob, generateBannerJob, generateShortJob, modelCandidatesJob } from './handlers/generate'
import { modelSheetJob } from './handlers/model-sheet'
import { modelShotEditJob } from './handlers/model-shot-edit'
import { publishJob, refreshInstagramTokens } from './handlers/publish'
import { storeCrawlJob } from './handlers/store-crawl'
import { voiceCloneJob, voiceDesignJob } from './handlers/voice'

const handlers: { [K in JobKind]: (p: JobPayloads[K]) => Promise<unknown> } = {
  compose_frame: composeFrameJob,
  generate_short: generateShortJob,
  generate_banner: generateBannerJob,
  model_candidates: modelCandidatesJob,
  model_sheet: modelSheetJob,
  model_shot_edit: modelShotEditJob,
  voice_clone: voiceCloneJob,
  voice_design: voiceDesignJob,
  store_crawl: storeCrawlJob,
  publish: publishJob,
}

async function claim(): Promise<Job | null> {
  const { data, error } = await db.rpc('claim_job', { p_worker: env.workerId })
  if (error) {
    const hint = /invalid api key|jws|jwt/i.test(error.message)
      ? 'SUPABASE_SECRET_KEY 가 SUPABASE_URL 프로젝트의 Secret key 인지 확인 — 대시보드의 복사 버튼으로 가져와야 한다'
      : '0001_init.sql 을 실행했는지 확인'
    throw new Error(`작업을 꺼내지 못했어요: ${error.message} (${hint})`)
  }
  return (data as Job[] | null)?.[0] ?? null
}

async function finish(job: Job, result: unknown) {
  await db.from('jobs').update({ status: 'done', result, error: null, updated_at: new Date().toISOString() }).eq('id', job.id)
}

async function fail(job: Job, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  // 업로드는 두 번 올라갈 수 있어 다시 하지 않는다. 크레딧·키·정책 문제도 다시 해 봐야 같은 이유로 실패한다
  const retry = job.attempts < job.max_attempts && job.kind !== 'publish' && !isFatalAiError(err)
  await db
    .from('jobs')
    .update({
      status: retry ? 'queued' : 'failed',
      error: msg,
      run_after: new Date(Date.now() + 30_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  if (!retry && (job.kind === 'generate_short' || job.kind === 'generate_banner')) {
    await db.from('contents').update({ status: 'failed', error: msg }).eq('id', (job.payload as { contentId: string }).contentId)
  }
  if (job.kind === 'store_crawl') {
    // 다시 시도할 때도 화면에 지금 실패 이유를 보여 준다(성공하면 지워진다)
    await db.from('store_sources').update({ error: msg, updated_at: new Date().toISOString() }).eq('id', (job.payload as { sourceId: string }).sourceId)
  }
  if (!retry && job.kind === 'voice_clone') {
    await db.from('virtual_models').update({ voice_error: msg }).eq('id', (job.payload as { modelId: string }).modelId)
  }
  console.error(`[job ${job.kind} ${job.id.slice(0, 8)}] 실패${retry ? ' (다시 시도 예정)' : ''}:`, msg)
}

async function runOne() {
  const job = await claim()
  if (!job) return false
  const started = Date.now()
  console.log(`[job ${job.kind} ${job.id.slice(0, 8)}] 시작 (시도 ${job.attempts})`)
  try {
    const handler = handlers[job.kind as JobKind] as ((p: unknown) => Promise<unknown>) | undefined
    if (!handler) throw new Error(`모르는 작업 종류예요: ${job.kind}`)
    const result = await handler(job.payload)
    await finish(job, result)
    console.log(`[job ${job.kind} ${job.id.slice(0, 8)}] 완료 ${((Date.now() - started) / 1000).toFixed(1)}s`)
  } catch (e) {
    await fail(job, e)
  }
  return true
}

let stopping = false
process.on('SIGINT', () => (stopping = true))
process.on('SIGTERM', () => (stopping = true))

async function main() {
  const once = process.argv.includes('--once')
  console.log(`[worker] ${env.workerId} · AI=${env.aiMode} · 업로드=${env.publishMode}${once ? ' · 한 번만' : ''}`)
  let lastSweep = 0
  while (!stopping) {
    // 6시간마다 곧 끊길 채널 토큰을 연장한다 (실제 업로드 모드에서만)
    if (env.publishMode === 'live' && Date.now() - lastSweep > 6 * 3600_000) {
      lastSweep = Date.now()
      await refreshInstagramTokens().catch((e) => console.error('[token]', e instanceof Error ? e.message : e))
    }
    let did = false
    try {
      did = await runOne()
    } catch (e) {
      console.error('[worker]', e instanceof Error ? e.message : e)
    }
    if (!did) {
      if (once) break
      await new Promise((r) => setTimeout(r, env.pollMs))
    }
  }
  console.log('[worker] 종료')
}

main()
