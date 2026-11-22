'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { getStoreInfoAction, type SourceSummary, type StoreInfo } from '@/actions/store-info'
import { Dialog } from '@/components/dialog'
import { ErrorLine, LinkButton, Note, Pill } from '@/components/ui'
import { useAction } from '@/components/use-action'

/* 콘텐츠 생성 > 매장 고르기 카드의 "정보" 버튼. 누르면 그 매장의 입력된 정보와 자료 수집 결과를 창으로 보여 준다(열 때 불러온다). */

const CHANNEL_STATUS: Record<string, string> = { connected: '연결됨', pending: '허용 대기', expired: '연결 만료', manager: '관리자 초대' }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

export function StoreInfoButton({ storeId, storeName, className }: { storeId: string; storeName: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<StoreInfo | null>(null)
  const load = useAction()
  const show = () => {
    setOpen(true)
    if (!info) load.run(() => getStoreInfoAction(storeId), (r) => setInfo(r.info))
  }
  return (
    <>
      <button type="button" onClick={show} aria-label={`${storeName} 정보 보기`} className={`rounded-md border border-line bg-soft px-2 py-0.5 text-[12px] text-ink-soft hover:border-accent hover:text-ink ${className ?? ''}`}>
        정보
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={info ? <>{info.clientName} <span className="font-medium text-ink-soft">{info.storeName}</span></> : storeName}
        footer={
          <>
            <LinkButton size="sm" href={`/stores/${storeId}/info`}>매장 정보 고치기</LinkButton>
            <LinkButton size="sm" href={`/stores/${storeId}/sources`}>자료 수집 전체 보기</LinkButton>
          </>
        }
      >
        <ErrorLine error={load.error} />
        {load.pending && !info && <p className="text-[13px] text-ink-soft">불러오는 중…</p>}
        {info && <Body info={info} storeId={storeId} />}
      </Dialog>
    </>
  )
}

function Body({ info, storeId }: { info: StoreInfo; storeId: string }) {
  return (
    <div className="grid gap-5 text-[13.5px]">
      <Block title="매장 정보" sub="고객사·매장 정보 탭에 입력된 내용">
        <Rows
          rows={[
            ['고객사', `${info.clientName} (${info.clientCode}) · 대표 ${info.repName || '-'}`],
            ['구분', info.kind === 'brand' ? '브랜드' : '매장'],
            ['주소', info.address],
            ['전화', info.phone],
            ['영업시간', info.hours],
            ['소개', info.intro && <span className="whitespace-pre-wrap">{info.intro}</span>],
            ['홈페이지', info.homepageUrl && <Ext href={info.homepageUrl} />],
            ['채널', info.channels.length ? info.channels.map((c) => `${c.platform} ${c.handle} (${CHANNEL_STATUS[c.status] ?? c.status})`).join(' · ') : ''],
            ['담당자', info.managers.join(', ')],
          ]}
        />
        <p className="mt-1.5 text-[12px] text-ink-soft">AI가 자료 수집 결과를 합쳐 정리하는 &quot;매장 프로필&quot;은 다음 단계에서 이 자리에 함께 보여요.</p>
      </Block>

      <Block title="진행 중인 이벤트" sub={`${info.events.length}개`}>
        {info.events.length ? (
          <div className="grid gap-1.5">
            {info.events.map((e) => (
              <div key={e.title + e.period} className="rounded-lg border border-line p-2.5">
                <b>{e.title}</b> <span className="text-[12px] text-ink-soft">{e.period}</span>
                {e.offer && <div>{e.offer}</div>}
                {e.details && <div className="whitespace-pre-wrap text-[12.5px] text-ink-soft">{e.details}</div>}
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Block>

      {info.siteFeed && (
        <Block title="홈페이지 자료" sub="숏폼·배너를 만들 때 참고로 넣는 자료">
          <Rows
            rows={[
              ['홈페이지 글', [info.siteFeed.homepageTitle, info.siteFeed.homepageDescription].filter(Boolean).join(' — ')],
              ['자료 API 상품', info.siteFeed.items ? `${info.siteFeed.items}개 · ${info.siteFeed.sample.join(', ')}` : ''],
            ]}
          />
        </Block>
      )}

      <Block title="자료 수집 (크롤링)" sub={info.sources ? `${info.sources.length}곳` : undefined}>
        {info.sources === null ? (
          <Note tone="warn">자료 수집을 쓰려면 supabase/migrations/0007_store_sources.sql 을 먼저 돌려 주세요.</Note>
        ) : info.sources.length ? (
          <div className="grid gap-2">
            {info.sources.map((s, i) => <Source key={s.kind} s={s} open={i === 0} />)}
          </div>
        ) : (
          <p className="text-ink-soft">
            아직 가져온 자료가 없어요. <Link href={`/stores/${storeId}/sources`} className="text-accent hover:underline">자료 수집 탭</Link>에서 네이버 플레이스 주소부터 넣어 보세요.
          </p>
        )}
      </Block>
    </div>
  )
}

function Source({ s, open }: { s: SourceSummary; open: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-line p-3 [&[open]>summary]:mb-2">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <b>{s.label}</b>
        {s.name && <span>{s.name}</span>}
        {s.fetchedAt ? <Pill tone="ok">{when(s.fetchedAt)}</Pill> : <Pill>아직 없음</Pill>}
        {s.error && <Pill tone="bad">마지막 가져오기 실패</Pill>}
      </summary>
      {!s.fetchedAt ? (
        <p className="text-[12.5px] text-ink-soft">{s.error ?? '아직 가져오지 않았어요.'}</p>
      ) : (
        <Rows
          rows={[
            ['주소', <Ext key="u" href={s.url} />],
            ['업종', s.category],
            ['소개', s.description && <span className="whitespace-pre-wrap">{s.description}</span>],
            ['위치', s.address],
            ['전화', s.phone],
            ['영업시간', s.hours.join(' · ')],
            ['키워드', s.keywords.map((k) => `#${k}`).join(' ')],
            ['메뉴', s.menus.length ? `${s.menus.map((m) => (m.price ? `${m.name} ${m.price}` : m.name)).join(' · ')}${s.menuTotal > s.menus.length ? ` 외 ${s.menuTotal - s.menus.length}개` : ''}` : ''],
            ['소식', s.news.map((n) => (n.when ? `${n.title} (${n.when})` : n.title)).join(' · ')],
            ['리뷰', [s.reviewScore != null ? `★ ${s.reviewScore}` : '', s.reviewTotal != null ? `${s.reviewTotal}개` : '', s.reviewKeywords.join(', ')].filter(Boolean).join(' · ')],
            ['리뷰 요약', s.briefing.join(' / ')],
            ['편의시설', s.conveniences.join(', ')],
            ['연결된 주소', s.links.length ? <span className="grid gap-0.5">{s.links.map((l) => <Ext key={l} href={l} />)}</span> : ''],
            ['사진', s.photos ? `${s.photos}장 (자료 수집 탭에서 보기)` : ''],
          ]}
        />
      )}
    </details>
  )
}

function Block({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 font-bold">
        {title}
        {sub && <span className="text-[12px] font-normal text-ink-soft">{sub}</span>}
      </h3>
      {children}
    </section>
  )
}

/** 빈 칸은 숨긴다 — 전부 비었으면 "비어 있어요" */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== '' && v != null && v !== false)
  if (!shown.length) return <Empty />
  return (
    <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 [&>dt]:text-ink-soft">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const Empty = () => <p className="text-ink-soft">비어 있어요.</p>
const Ext = ({ href }: { href: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">
    {href}
  </a>
)
