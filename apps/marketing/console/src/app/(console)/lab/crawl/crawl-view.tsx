'use client'

import { useEffect, useState } from 'react'
import type { SourceKind } from '@marketing/core/crawl/common'
import { SOURCES, detectSource, sourceLabel as kindLabel } from '@marketing/core/crawl/detect'
import { CrawlResultView } from '@/components/crawl-result'
import { useAction } from '@/components/use-action'
import { Button, Card, ErrorLine, Pill, cx, inputCls } from '@/components/ui'
import type { CrawlResult } from '@marketing/core/crawl/common'
import { crawlAction } from './actions'

const SAMPLE = 'https://map.naver.com/p/entry/place/1731431381'

/** 소스마다 대략 걸리는 시간(초) — 진행 막대용 */
const EXPECT: Record<SourceKind, number> = { naver_place: 26, homepage: 16, instagram: 8, kakao_place: 2, daangn: 2, smartstore: 1 }

export function CrawlView() {
  const [url, setUrl] = useState(SAMPLE)
  const [pick, setPick] = useState<SourceKind | 'auto'>('auto')
  const [data, setData] = useState<CrawlResult | null>(null)
  const [runKind, setRunKind] = useState<SourceKind>('naver_place')
  const { pending, error, run } = useAction()
  const detected = detectSource(url)
  const kind = pick === 'auto' ? detected : pick

  const start = (u: string, k: SourceKind | undefined) => {
    setRunKind(k ?? detectSource(u))
    setData(null) // 실패했을 때 지난 결과가 이번 결과처럼 보이지 않게
    run(() => crawlAction(u, k), (r) => setData(r.data))
  }
  const submit = () => start(url, pick === 'auto' ? undefined : pick)
  // 결과의 "연결된 채널"에서 다른 주소를 바로 가져온다
  const follow = (u: string) => {
    setUrl(u)
    setPick('auto')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    start(u, undefined)
  }
  const info = SOURCES.find((s) => s.kind === kind)

  return (
    <>
      <Card>
        <form
          className="grid gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label htmlFor="place-url" className="text-[12.5px] font-medium text-ink-soft">
            가게·회사 주소
          </label>
          <div className="flex flex-wrap gap-2">
            <select aria-label="주소 종류" className="shrink-0 rounded-lg border border-line bg-card px-2.5 py-2 outline-none focus:border-accent focus:ring-3 focus:ring-accent-weak disabled:bg-soft" value={pick} onChange={(e) => setPick(e.target.value as SourceKind | 'auto')} disabled={pending}>
              <option value="auto">자동 · {kindLabel(detected)}</option>
              {SOURCES.map((s) => (
                <option key={s.kind} value={s.kind} disabled={!s.supported}>
                  {s.label}
                  {s.supported ? '' : ' (지원 안 됨)'}
                </option>
              ))}
            </select>
            <input id="place-url" className={cx(inputCls, 'min-w-0 flex-1')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="네이버 플레이스 · 카카오맵 · 당근 · 인스타그램 · 홈페이지 주소" disabled={pending} />
            <Button tone="primary" type="submit" disabled={pending || !url.trim()}>
              {pending ? '가져오는 중…' : '가져오기'}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
            <Pill tone={info?.supported ? 'accent' : 'bad'}>{kindLabel(kind)}</Pill>
            {info?.hint}
            {info?.supported && ` · 약 ${EXPECT[kind]}초`}. 주소를 보고 종류를 자동으로 고르고, 틀리면 왼쪽에서 바꿔요.
          </p>
          {pending && <Progress kind={runKind} />}
          <ErrorLine error={error} />
        </form>
      </Card>
      {data && !pending && <CrawlResultView d={data} onFollow={follow} />}
    </>
  )
}

/* 실제 진행률은 알 수 없다 — 네이버는 지금 어느 탭을 여는 중일지 시간으로 짐작해 보여 준다 */
const NAVER_STEPS = ['홈 · 기본 정보', '사진 탭 (스크롤하며 더 불러오기)', '리뷰', '소식 · 이벤트', '메뉴 · 가격 · 스타일', '정리하는 중']
const HOME_STEPS = ['첫 화면 열기', '하위 페이지 (회사소개·메뉴 등)', '정리하는 중']
function Progress({ kind }: { kind: SourceKind }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const steps = kind === 'naver_place' ? NAVER_STEPS : kind === 'homepage' ? HOME_STEPS : ['가져오는 중']
  const at =
    kind === 'naver_place'
      ? Math.min(5, sec < 3 ? 0 : sec < 13 ? 1 : sec < 17 ? 2 : sec < 20 ? 3 : sec < 24 ? 4 : 5)
      : kind === 'homepage'
        ? sec < 6
          ? 0
          : sec < 14
            ? 1
            : 2
        : 0
  return (
    <div className="grid gap-2 rounded-lg bg-soft px-3.5 py-3 text-[13px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${Math.min(95, (sec / EXPECT[kind]) * 100)}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-ink-soft">
        {steps.map((s, i) => (
          <span key={s} className={cx(i < at && 'text-ok', i === at && 'font-bold text-ink')}>
            {i < at ? '✓' : i === at ? '●' : '○'} {s}
          </span>
        ))}
        <span className="ml-auto tabular">{sec}초</span>
      </div>
    </div>
  )
}

/* ---------------- 결과 ---------------- */

