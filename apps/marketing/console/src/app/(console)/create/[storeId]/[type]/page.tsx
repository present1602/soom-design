import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Content, ContentAsset } from '@marketing/core/types'
import { LinkButton, PageHead } from '@/components/ui'
import { getSiteFeedPreview, getStore, listModels, listMoods, listStoreEvents } from '@/lib/data'
import { signMany } from '@/lib/files'
import { str } from '@/lib/format'
import { canSeeStore, requireStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { CreateSteps } from '../../steps'
import { PickedStore } from '../picked-store'
import type { StoreBriefView } from './store-brief'
import { Workspace, type Initial } from './workspace'

export default async function WorkspacePage({ params, searchParams }: PageProps<'/create/[storeId]/[type]'>) {
  const staff = await requireStaff()
  const { storeId, type } = await params
  if (type !== 'short' && type !== 'banner') notFound()
  if (!canSeeStore(staff, storeId)) notFound()
  const d = await getStore(storeId)
  if (!d) notFound()
  const [models, moods, events, feed] = await Promise.all([listModels({ usable: true }), listMoods(true), listStoreEvents(storeId), getSiteFeedPreview(storeId)])

  // ?content= 로 들어오면 그 콘텐츠를 이어서 본다(새로고침해도 결과가 남는다)
  let initial: Initial | null = null
  const cid = str((await searchParams).content)
  if (cid) {
    const { data } = await db().from('contents').select('*').eq('id', cid).eq('store_id', storeId).maybeSingle()
    const c = data as Content | null
    if (c && c.type === type) {
      const { data: a } = await db().from('content_assets').select('*').eq('content_id', c.id).in('kind', ['product', 'reference', 'first_frame', 'thumbnail']).order('sort')
      const assets = (a ?? []) as ContentAsset[]
      const signed = await signMany(assets.map((x) => x.path))
      const urls = (k: ContentAsset['kind']) => assets.filter((x) => x.kind === k).map((x) => ({ path: x.path, url: signed.get(x.path) ?? '' }))
      initial = { contentId: c.id, modelId: c.model_id, prompt: c.prompt, moods: c.moods, settings: c.settings, products: urls('product'), references: urls('reference'), firstFrame: urls('first_frame')[0] ?? null, thumb: urls('thumbnail')[0] ?? null }
    }
  }

  const name = `${d.client.name} ${d.store.name}`
  const st = d.store
  const source: StoreBriefView['source'] = st.site_feed_url
    ? { kind: 'api', ok: !feed?.error, note: feed?.error ? `마지막 불러오기 실패 — ${feed.fetchedAt ? '지난 자료로 대신해요' : '자료 없이 만들어요'}` : feed?.fetchedAt ? `상품 ${feed.items}개 · 만들 때 새로 불러와요` : '만들 때 불러와요' }
    : st.homepage_url
      ? { kind: 'homepage', ok: !feed?.homepage.error, note: feed?.homepage.error ? `마지막 읽기 실패 — ${feed.homepage.fetchedAt ? '지난 내용으로 대신해요' : '자료 없이 만들어요'}` : '만들 때 페이지를 새로 읽어요' }
      : { kind: 'none', ok: false, note: '없음 — 매장 정보 탭에서 넣을 수 있어요' }
  const brief: StoreBriefView = { id: storeId, intro: st.intro, address: st.address, hours: st.hours, phone: st.phone, homepageUrl: st.homepage_url ?? '', source }
  return (
    <>
      <PageHead
        title={type === 'short' ? 'AI 숏폼 생성' : 'AI 배너광고 생성'}
        crumb={<><Link href="/create">콘텐츠 생성</Link> / <Link href={`/create/${storeId}`}>{name}</Link> / {type === 'short' ? 'AI 숏폼' : 'AI 배너'}</>}
        action={<LinkButton href={`/create/${storeId}`}>유형 바꾸기</LinkButton>}
      />
      <CreateSteps at={3} />
      <PickedStore name={name} code={d.client.code} channels={d.channels} />
      <Workspace
        key={initial?.contentId ?? 'new'}
        type={type}
        store={{ id: storeId, name, address: d.store.address, hours: d.store.hours }}
        brief={brief}
        events={events}
        channels={d.channels.map((c) => ({ id: c.id, platform: c.platform, handle: c.handle, status: c.status, profileUrl: c.profile_url }))}
        models={models.map((m) => ({ id: m.id, name: m.name, gender: m.gender, ageBand: m.age_band, mood: m.mood, coverUrl: m.coverUrl, voice: m.voice_source === 'upload' ? '녹음 목소리' : m.voice || null }))}
        moods={moods.map((m) => m.label)}
        isSuper={staff.role === 'super'}
        initial={initial}
      />
    </>
  )
}
