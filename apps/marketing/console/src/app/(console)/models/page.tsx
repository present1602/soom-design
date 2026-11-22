import type { Metadata } from 'next'
import Link from 'next/link'
import { MODEL_STATUS_LABEL, MODEL_STATUS_TONE as STATUS_TONE } from '@marketing/core/types'
import { Empty, LinkButton, PageHead, Pill } from '@/components/ui'
import { listModels } from '@/lib/data'
import { requireStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'

export const metadata: Metadata = { title: '가상 모델' }

const VIEWS = [
  ['', '대기·공개'],
  ['hidden', '숨김'],
] as const

export default async function ModelsPage({ searchParams }: PageProps<'/models'>) {
  await requireStaff()
  const view = (await searchParams).view === 'hidden' ? 'hidden' : ''
  const all = await listModels()
  const models = all.filter((m) => (view === 'hidden' ? m.state === 'hidden' : m.state !== 'hidden'))
  const hiddenN = all.filter((m) => m.state === 'hidden').length
  const { data } = await db().from('contents').select('model_id').not('model_id', 'is', null).limit(10000)
  const used = new Map<string, number>()
  for (const r of (data ?? []) as { model_id: string }[]) used.set(r.model_id, (used.get(r.model_id) ?? 0) + 1)
  return (
    <>
      <PageHead title="가상 모델" sub="숏폼·배너에 광고 모델로 쓰는 AI 인물이에요. 모든 고객사가 함께 써요" action={<LinkButton tone="primary" href="/models/new">모델 만들기</LinkButton>} />
      <div className="mb-4 flex gap-1.5">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={v ? `/models?view=${v}` : '/models'} className={`rounded-full border px-3 py-1 text-[12.5px] ${view === v ? 'border-accent bg-accent-weak font-bold text-accent' : 'border-line bg-card text-ink-soft hover:border-accent'}`}>
            {label} {v === 'hidden' ? hiddenN : all.length - hiddenN}
          </Link>
        ))}
      </div>
      {models.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {models.map((m) => (
            <Link key={m.id} href={`/models/${m.id}`} className="grid gap-2.5 rounded-xl border border-line bg-card p-3 hover:border-accent">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.coverUrl && <img src={m.coverUrl} alt="" className="size-full object-cover" />}
                <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 text-[11.5px] text-white">{m.source === 'ai' ? 'AI 생성' : '참고 사진'}</span>
                <span className="absolute top-2 left-2"><Pill tone={STATUS_TONE[m.state]} dot>{MODEL_STATUS_LABEL[m.state]}</Pill></span>
              </div>
              <div>
                <b>{m.name}</b> <span className="text-[12.5px] text-ink-soft">{m.gender} · {m.age_band}</span>
                <div className="truncate text-[12.5px] text-ink-soft">{m.mood}</div>
              </div>
              <div className="flex justify-between text-[12.5px]">
                <span className="text-ink-soft">{m.voice || '목소리 미정'}</span>
                <span className="tabular">{used.get(m.id) ?? 0}편</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        view === 'hidden' ? <Empty title="숨긴 모델이 없어요" /> : <Empty title="아직 가상 모델이 없어요">숏폼과 배너를 만들려면 모델이 하나 이상 필요해요. 오른쪽 위 <b>모델 만들기</b>로 시작하세요.</Empty>
      )}
    </>
  )
}
