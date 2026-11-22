import Link from 'next/link'
import { PLATFORM_INFO, PLATFORMS } from '@marketing/core/channels'
import type { Content } from '@marketing/core/types'
import { CHANNEL_STATUS, ChannelIcon } from '@/components/channel-icon'
import { Card, CardHead, Pill } from '@/components/ui'
import { decorate, getStore } from '@/lib/data'
import { signMany } from '@/lib/files'
import { shortDate } from '@/lib/format'
import { requireStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'

export default async function StoreDashboard({ params }: PageProps<'/stores/[id]'>) {
  const staff = await requireStaff()
  const { id } = await params
  const d = (await getStore(id))!
  const [recentQ, totalQ, modelIdsQ] = await Promise.all([
    db().from('contents').select('*').eq('store_id', id).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(5),
    db().from('contents').select('id', { count: 'exact', head: true }).eq('store_id', id).not('published_at', 'is', null),
    db().from('contents').select('model_id').eq('store_id', id).not('model_id', 'is', null).limit(500),
  ])
  const recent = await decorate((recentQ.data ?? []) as Content[])
  const modelIds = [...new Set((modelIdsQ.data ?? []).map((r: { model_id: string }) => r.model_id))]
  const models = modelIds.length ? ((await db().from('virtual_models').select('id, name, cover_path').in('id', modelIds)).data ?? []) : []
  const covers = await signMany(models.map((m: { cover_path: string | null }) => m.cover_path))

  return (
    <>
      <Card>
        <CardHead title="최근 업로드한 콘텐츠" sub={`전체 ${totalQ.count ?? 0}건`} action={<Link className="text-[12.5px] text-accent" href={`/stores/${id}/contents`}>전체 보기</Link>} />
        {recent.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recent.map((r) => {
              const first = r.posts.find((p) => p.status === 'done' && p.post_url)
              return (
                <div key={r.id} className="grid min-w-0 gap-1.5">
                  <a href={first?.post_url ?? '#'} target="_blank" rel="noopener noreferrer" className="block aspect-[9/16] overflow-hidden rounded-xl bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.thumbUrl && <img src={r.thumbUrl} alt="" className="size-full object-cover" />}
                  </a>
                  <div className="truncate text-[13px] font-medium">{r.title}</div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex gap-1">
                      {r.posts.filter((p) => p.status === 'done').map((p) => (
                        <ChannelIcon key={p.id} platform={p.platform} href={p.post_url} size={20} />
                      ))}
                    </span>
                    <span className="text-[12px] text-ink-soft tabular">{shortDate(r.published_at).slice(0, 5)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-ink-soft">아직 업로드한 콘텐츠가 없어요. 오른쪽 위 <b>콘텐츠 등록</b>으로 시작하세요.</p>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="채널" action={<Link className="text-[12.5px] text-accent" href={`/stores/${id}/channels`}>관리</Link>} />
          <ul className="grid">
            {PLATFORMS.map((p) => {
              const c = d.channels.find((x) => x.platform === p)
              return (
                <li key={p} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                  <ChannelIcon platform={p} off={!c} size={26} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate font-medium">{c ? c.handle : '미등록'}</b>
                    <span className="text-[12.5px] text-ink-soft">{PLATFORM_INFO[p].name}</span>
                  </div>
                  {c && <Pill tone={CHANNEL_STATUS[c.status].tone} dot>{CHANNEL_STATUS[c.status].label}</Pill>}
                </li>
              )
            })}
          </ul>
        </Card>
        <Card>
          <CardHead title="매장 정보" action={<Link className="text-[12.5px] text-accent" href={`/stores/${id}/info`}>수정</Link>} />
          <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-[13.5px] [&>dd]:min-w-0 [&>dd]:break-words [&>dt]:text-ink-soft">
            <dt>주소</dt>
            <dd>{d.store.address || '—'}</dd>
            <dt>전화</dt>
            <dd className="tabular">{d.store.phone || '—'}</dd>
            <dt>영업시간</dt>
            <dd>{d.store.hours || '—'}</dd>
            <dt>대표자</dt>
            <dd>
              {d.client.rep_name} · <span className="tabular">{d.client.phone}</span>
            </dd>
            {d.client.email && (
              <>
                <dt>이메일</dt>
                <dd>{d.client.email}</dd>
              </>
            )}
          </dl>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHead title="사용 중인 가상 모델" />
            <div className="flex flex-wrap gap-1.5">
              {models.length ? (
                models.map((m: { id: string; name: string; cover_path: string | null }) => (
                  <Link key={m.id} href={`/models/${m.id}`} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-[13px] hover:border-accent">
                    <span className="size-7 overflow-hidden rounded-full bg-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.cover_path && covers.get(m.cover_path) && <img src={covers.get(m.cover_path)} alt="" className="size-full object-cover" />}
                    </span>
                    {m.name}
                  </Link>
                ))
              ) : (
                <span className="text-[12.5px] text-ink-soft">아직 없어요</span>
              )}
            </div>
          </Card>
          <Card>
            <CardHead title="콘텐츠 담당자" action={staff.role === 'super' && <Link className="text-[12.5px] text-accent" href={`/stores/${id}/managers`}>변경</Link>} />
            <div className="flex flex-wrap gap-1.5">
              {d.managers.length ? d.managers.map((m) => <span key={m.id} className="rounded-md border border-line px-2.5 py-0.5 text-[13px]">{m.nickname}</span>) : <span className="text-[12.5px] text-bad">담당자가 없어요</span>}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
