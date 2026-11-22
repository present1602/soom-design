import { NextResponse } from 'next/server'
import type { Content, ContentAsset, ContentPost } from '@marketing/core/types'
import { signMany } from '@/lib/files'
import { canSeeStore, getStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'

export type AssetView = { id: string; url: string | null; selected: boolean }
export type ContentView = {
  content: Content
  storeName: string
  clientName: string
  modelName: string | null
  videoUrl: string | null
  thumbUrl: string | null
  firstFrameUrl: string | null
  thumbCandidates: AssetView[]
  uploadedThumb: AssetView | null
  variants: AssetView[]
  products: string[]
  posts: ContentPost[]
  /** 이 콘텐츠의 마지막 생성 작업 (워커가 잡았는지·다시 시도 중인지 보려고) */
  job: { status: string; attempts: number; error: string | null; createdAt: string } | null
}

/* 생성 화면이 진행 상황을 묻는 곳 + 원본 보기. 파일은 1시간짜리 서명 링크로 돌려준다. */
export async function GET(_req: Request, ctx: RouteContext<'/api/contents/[id]'>) {
  const staff = await getStaff()
  if (!staff) return NextResponse.json({ error: '로그인이 풀렸어요. 새로고침해 주세요.' }, { status: 401 })
  const { id } = await ctx.params
  const { data: c } = await db().from('contents').select('*').eq('id', id).maybeSingle()
  const content = c as Content | null
  if (!content || !canSeeStore(staff, content.store_id)) return NextResponse.json({ error: '콘텐츠를 찾지 못했어요.' }, { status: 404 })

  const [assets, posts, store, model, jobQ] = await Promise.all([
    db().from('content_assets').select('*').eq('content_id', id).order('sort'),
    db().from('content_posts').select('*').eq('content_id', id).order('created_at'),
    db().from('stores').select('name, clients(name)').eq('id', content.store_id).single(),
    content.model_id ? db().from('virtual_models').select('name').eq('id', content.model_id).maybeSingle() : Promise.resolve({ data: null }),
    db().from('jobs').select('status, attempts, error, created_at').in('kind', ['generate_short', 'generate_banner']).eq('payload->>contentId', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const jr = jobQ.data as { status: string; attempts: number; error: string | null; created_at: string } | null
  const list = (assets.data ?? []) as ContentAsset[]
  const signed = await signMany(list.map((a) => a.path))
  const view = (a: ContentAsset): AssetView => ({ id: a.id, url: signed.get(a.path) ?? null, selected: a.selected })
  const by = (k: ContentAsset['kind']) => list.filter((a) => a.kind === k)
  const uploaded = by('thumbnail')[0]
  const pickedCand = by('thumb_candidate').find((a) => a.selected)
  const s = store.data as unknown as { name: string; clients: { name: string } | null } | null

  const body: ContentView = {
    content,
    storeName: s?.name ?? '',
    clientName: s?.clients?.name ?? '',
    modelName: (model.data as { name: string } | null)?.name ?? null,
    videoUrl: by('video')[0] ? (signed.get(by('video')[0].path) ?? null) : null,
    thumbUrl: signed.get((uploaded ?? pickedCand)?.path ?? '') ?? null,
    firstFrameUrl: by('first_frame')[0] ? (signed.get(by('first_frame')[0].path) ?? null) : null,
    thumbCandidates: by('thumb_candidate').map(view),
    uploadedThumb: uploaded ? view(uploaded) : null,
    variants: by('variant').map(view),
    products: by('product').map((a) => signed.get(a.path)).filter((u): u is string => !!u),
    posts: (posts.data ?? []) as ContentPost[],
    job: jr ? { status: jr.status, attempts: jr.attempts, error: jr.error, createdAt: jr.created_at } : null,
  }
  return NextResponse.json(body)
}
