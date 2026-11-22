import { NextResponse } from 'next/server'
import type { Job } from '@marketing/core/types'
import { signMany } from '@/lib/files'
import { getStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'

/* 퍼스트 프레임 합성·모델 후보처럼 콘텐츠에 묶이지 않은 작업의 진행 상황.
   결과 파일 경로가 있으면 서명 링크도 함께 준다. */
export async function GET(_req: Request, ctx: RouteContext<'/api/jobs/[id]'>) {
  const staff = await getStaff()
  if (!staff) return NextResponse.json({ error: '로그인이 풀렸어요. 새로고침해 주세요.' }, { status: 401 })
  const { id } = await ctx.params
  const { data } = await db().from('jobs').select('*').eq('id', id).maybeSingle()
  const job = data as Job | null
  if (!job || !['compose_frame', 'model_candidates', 'voice_design'].includes(job.kind)) return NextResponse.json({ error: '작업을 찾지 못했어요.' }, { status: 404 })
  const r = (job.result ?? {}) as { path?: string; paths?: string[]; mock?: boolean }
  const paths = r.paths ?? (r.path ? [r.path] : [])
  const signed = await signMany(paths)
  return NextResponse.json({
    status: job.status,
    // 다시 시도 대기 중이면 마지막 에러는 보이지 않는다(곧 다시 돈다)
    error: job.status === 'failed' ? job.error : null,
    retrying: job.status === 'queued' && job.attempts > 0,
    files: paths.map((p) => ({ path: p, url: signed.get(p) ?? null })),
    mock: r.mock ?? false,
  })
}
