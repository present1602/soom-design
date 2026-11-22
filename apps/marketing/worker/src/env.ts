import os from 'node:os'

function need(...names: string[]) {
  for (const n of names) if (process.env[n]) return process.env[n]!
  throw new Error(`${names.join(' 또는 ')} 가 없어요. worker/.env.local 을 확인해 주세요 (.env.example 참고).`)
}

export const env = {
  supabaseUrl: need('SUPABASE_URL'),
  // 새 Secret 키(sb_secret_…). 예전 service_role JWT 이름도 받는다
  serviceKey: need('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  /** mock 이면 AI 업체를 부르지 않고 ffmpeg 로 가짜 결과를 만든다 */
  aiMode: (process.env.AI_MODE === 'live' ? 'live' : 'mock') as 'live' | 'mock',
  /** mock 이면 실제로 올리지 않는다 */
  publishMode: (process.env.PUBLISH_MODE === 'live' ? 'live' : 'mock') as 'live' | 'mock',
  pollMs: Number(process.env.POLL_MS || 2000),
  workerId: `${os.hostname()}:${process.pid}`,
}
