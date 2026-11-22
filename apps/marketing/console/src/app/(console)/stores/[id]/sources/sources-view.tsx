'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { CrawlResult } from '@marketing/core/crawl/common'
import { SOURCES, detectSource, sourceLabel } from '@marketing/core/crawl/detect'
import { addStoreSourceAction, getStoreSourceDataAction, recrawlAllStoreSourcesAction, recrawlStoreSourceAction, removeStoreSourceAction } from '@/actions/sources'
import { CrawlResultView } from '@/components/crawl-result'
import { useToast } from '@/components/toast'
import { Button, Card, CardHead, Empty, ErrorLine, Note, Pill, cx, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'
import type { SourceRow } from '@/lib/sources'

/* 매장 자료 수집 탭. 주소를 등록하면 워커가 가져와 저장하고(store_crawl), 이 화면은 가져오는 동안 3초마다 새로 그린다. */

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)
/** 소스마다 대략 걸리는 시간 */
const EXPECT: Record<string, string> = { naver_place: '30초', homepage: '15초', instagram: '10초', kakao_place: '몇 초', daangn: '몇 초' }

export function SourcesView({ storeId, rows }: { storeId: string; rows: SourceRow[] }) {
  const router = useRouter()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const add = useAction()
  const all = useAction()
  const [openId, setOpenId] = useState<string | null>(null)
  const anyRunning = rows.some((r) => r.running)
  const kind = detectSource(url)
  const info = SOURCES.find((s) => s.kind === kind)
  const taken = url.trim() ? rows.find((r) => r.kind === kind) : undefined

  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(t)
  }, [anyRunning, router])

  const addUrl = (u: string, after?: () => void) =>
    add.run(() => addStoreSourceAction(storeId, u), () => {
      toast(`${sourceLabel(detectSource(u))} 가져오기를 시작했어요`)
      after?.()
      router.refresh()
    })

  return (
    <div className="grid gap-4">
      <Card>
        <CardHead
          title="자료 수집"
          sub="매장 주소를 등록하면 가게 정보·메뉴·사진·소식·리뷰를 가져와 저장해요. 종류마다 하나씩 등록해요"
          action={rows.length > 0 && <Button size="sm" disabled={all.pending} onClick={() => all.run(() => recrawlAllStoreSourcesAction(storeId), (r) => { toast(r.started ? `${r.started}곳 다시 가져오기를 시작했어요` : '이미 모두 가져오는 중이에요'); router.refresh() })}>{all.pending ? '시작하는 중…' : '전부 다시 가져오기'}</Button>}
        />
        <ErrorLine error={all.error} />
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addUrl(url, () => setUrl(''))
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input aria-label="매장 주소" className={cx(inputCls, 'min-w-0 flex-1')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="네이버 플레이스 · 카카오맵 · 당근 · 인스타그램 · 홈페이지 주소" disabled={add.pending} />
            <Button tone="primary" type="submit" disabled={add.pending || !url.trim() || !info?.supported}>
              {add.pending ? '등록하는 중…' : taken ? '주소 바꾸고 가져오기' : '추가하고 가져오기'}
            </Button>
          </div>
          {url.trim() && (
            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
              <Pill tone={info?.supported ? 'accent' : 'bad'}>{sourceLabel(kind)}</Pill>
              {info?.supported ? `약 ${EXPECT[kind] ?? '몇 초'} 걸려요.` : info?.hint}
              {taken && info?.supported && <span className="text-warn">이미 등록된 {sourceLabel(kind)} 주소를 이 주소로 바꿔요(지난 결과는 지워져요).</span>}
            </p>
          )}
          <ErrorLine error={add.error} />
        </form>
      </Card>

      {!rows.length ? (
        <Empty title="아직 등록한 주소가 없어요">네이버 플레이스 주소부터 넣어 보세요. 가져온 결과의 &quot;연결된 채널&quot;에서 인스타그램·홈페이지도 바로 추가할 수 있어요.</Empty>
      ) : (
        <div className="grid gap-2.5">
          {rows.map((r) => (
            <SourceCard key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
          ))}
        </div>
      )}

      {openId && rows.find((r) => r.id === openId) && <Viewer key={`${openId}-${rows.find((r) => r.id === openId)!.fetchedAt}`} row={rows.find((r) => r.id === openId)!} onFollow={(u) => addUrl(u)} />}
    </div>
  )
}

function SourceCard({ r, open, onToggle }: { r: SourceRow; open: boolean; onToggle: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const act = useAction()
  return (
    <Card className={cx('grid gap-2', open && 'border-accent')}>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {r.cover ? <img src={r.cover} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-lg object-cover" /> : <span className="size-12 shrink-0 rounded-lg bg-soft" />}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <b>{sourceLabel(r.kind)}</b>
            {r.name && <span className="text-[13px]">{r.name}</span>}
            {r.running ? <Pill tone="accent" dot>가져오는 중…</Pill> : r.error ? <Pill tone="bad" dot>{r.fetchedAt ? '마지막 가져오기 실패' : '실패'}</Pill> : r.fetchedAt ? <Pill tone="ok" dot>{when(r.fetchedAt)}</Pill> : <Pill>대기</Pill>}
          </div>
          <a href={r.url} target="_blank" rel="noreferrer" className="truncate text-[12px] text-ink-soft hover:text-accent">{r.url}</a>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" disabled={!r.fetchedAt} onClick={onToggle}>{open ? '접기' : '결과 보기'}</Button>
          <Button size="sm" disabled={r.running || act.pending} onClick={() => act.run(() => recrawlStoreSourceAction(r.id), () => { toast('다시 가져오기를 시작했어요'); router.refresh() })}>다시 가져오기</Button>
          <Button size="sm" tone="ghost" disabled={r.running || act.pending} onClick={() => confirm(`${sourceLabel(r.kind)} 주소와 가져온 결과를 지울까요?`) && act.run(() => removeStoreSourceAction(r.id), () => { toast('지웠어요'); router.refresh() })}>지우기</Button>
        </div>
      </div>
      {r.counts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[12.5px]">
          {r.counts.map((c) => {
            const diff = c.prev == null ? 0 : c.n - c.prev
            return (
              <span key={c.label} className="rounded-full bg-soft px-2 py-0.5 tabular">
                {c.label} {c.n}
                {diff !== 0 && <span className={diff > 0 ? 'ml-1 text-ok' : 'ml-1 text-bad'}>{diff > 0 ? `+${diff}` : diff}</span>}
              </span>
            )
          })}
          {r.prevFetchedAt && <span className="text-ink-soft">· 직전 {when(r.prevFetchedAt)} 대비</span>}
        </div>
      )}
      {r.error && !r.running && <ErrorLine error={r.fetchedAt ? `${r.error} — 지난 결과(${when(r.fetchedAt)})는 그대로 있어요.` : r.error} />}
      {r.running && <p className="text-[12.5px] text-ink-soft">워커가 가져오고 있어요(약 {EXPECT[r.kind] ?? '몇 초'}). 워커가 꺼져 있으면 시작되지 않아요.</p>}
      <ErrorLine error={act.error} />
    </Card>
  )
}

function Viewer({ row, onFollow }: { row: SourceRow; onFollow: (url: string) => void }) {
  const [which, setWhich] = useState<'data' | 'prev_data'>('data')
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-bold">{sourceLabel(row.kind)} 결과</h2>
        {row.prevFetchedAt && (
          <div className="inline-flex rounded-lg bg-soft p-[3px]">
            {(['data', 'prev_data'] as const).map((w) => (
              <button key={w} type="button" onClick={() => setWhich(w)} className={cx('rounded-md px-2.5 py-1 text-[12.5px]', which === w ? 'bg-card font-bold shadow-sm' : 'text-ink-soft')}>
                {w === 'data' ? `최신 (${when(row.fetchedAt)})` : `직전 (${when(row.prevFetchedAt)})`}
              </button>
            ))}
          </div>
        )}
      </div>
      <Note tone="info">사진은 원래 플랫폼 주소 그대로라 나중에 깨질 수 있어요. 쓸 사진은 매장 프로필에서 골라 우리 저장소로 옮길 거예요(다음 단계).</Note>
      <Loaded key={`${row.id}-${which}`} id={row.id} which={which} onFollow={onFollow} />
    </div>
  )
}

/** 결과 하나 불러와 그리기. 보는 대상이 바뀌면 key 로 새로 만든다 */
function Loaded({ id, which, onFollow }: { id: string; which: 'data' | 'prev_data'; onFollow: (url: string) => void }) {
  const [data, setData] = useState<CrawlResult | null>(null)
  const { run, pending, error } = useAction()
  useEffect(() => {
    run(() => getStoreSourceDataAction(id, which), (r) => setData(r.data))
  }, [run, id, which])
  return (
    <>
      <ErrorLine error={error} />
      {pending && !data && <p className="text-[12.5px] text-ink-soft">불러오는 중…</p>}
      {data && <CrawlResultView d={data} onFollow={onFollow} followLabel="자료로 추가" />}
    </>
  )
}
