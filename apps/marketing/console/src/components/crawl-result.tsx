'use client'

/* 크롤링 결과 화면 (core/src/crawl 의 CrawlResult). 실험 메뉴(/lab/crawl)와 매장 "자료 수집" 탭이 같이 쓴다. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CrawlNews, CrawlPhoto, CrawlResult } from '@marketing/core/crawl/common'
import { SOURCES, detectSource, sourceLabel as kindLabel } from '@marketing/core/crawl/detect'
import { Button, Card, CardHead, Empty, Note, Pill, cx } from '@/components/ui'


/** 네이버 사진 원본은 수천 px 라 수백 장을 그대로 그리면 브라우저가 버거워한다.
    네이버가 자기 화면에서 쓰는 리사이즈 주소로 폭 750 짜리를 받는다(이미 그 주소면 그대로).
    정해진 조합만 열린다 — type=w750&quality=95 는 되고 w480·quality=90 은 404 (2026-11 확인). */
function sized(src: string) {
  src = src.replace(/^http:\/\//, 'https://') // 카카오 리뷰 사진 등 http 주소(섞인 콘텐츠로 막힌다)
  // 블로그 사진은 프록시를 거치면 브라우저에서 연결이 끊긴다 — 자체 크기 꼬리표(w773)로 바로 받는다
  if (/^https:\/\/(postfiles|blogfiles|mblogthumb-phinf)\.pstatic\.net\//.test(src)) return `${src.split('?')[0]}?type=w773`
  if (!/^https:\/\/[a-z0-9-]+\.pstatic\.net\//.test(src) || src.startsWith('https://search.pstatic.net/') || src.startsWith('https://ssl.pstatic.net/')) return src
  return `https://search.pstatic.net/common/?autoRotate=true&quality=95&type=w750&src=${encodeURIComponent(src.split('?')[0])}`
}

/** 네이버 이미지 서버는 다른 사이트에서 부를 때 referer 를 보고 막기도 한다 → referer 를 보내지 않는다.
    original 이면 줄이지 않고 원본(크게 보기용) */
function Img({ src, className, alt = '', original }: { src: string; className?: string; alt?: string; original?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={original ? src.replace(/^http:\/\//, 'https://') : sized(src)} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} />
}

const SOURCE_LABEL: Record<string, string> = {
  business: '업체 등록',
  placeReview: '방문자 리뷰',
  visitor: '방문자 리뷰',
  review: '방문자 리뷰',
  clip: '클립(영상)',
  pai: '예약자 리뷰',
  style: '스타일',
  blog: '블로그 후기',
  post: '소식 글',
  page: '첫 화면',
  subpage: '하위 페이지',
  og: '대표 이미지',
  profile: '프로필',
  cp: '제휴',
  cp0: '제휴',
  aiView: 'AI 추천',
  etc: '기타',
}
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s

/** 소스마다 대략 걸리는 시간(초) — 진행 막대용 */

type SectionId = 'photos' | 'news' | 'coupons' | 'menus' | 'styles' | 'reviews' | 'texts' | 'links' | 'info' | 'raw'
const SECTIONS: [SectionId, string][] = [
  ['photos', '사진'],
  ['news', '소식·이벤트'],
  ['coupons', '쿠폰·혜택'],
  ['menus', '메뉴·가격'],
  ['styles', '스타일'],
  ['reviews', '리뷰'],
  ['texts', '페이지 글'],
  ['links', '연결된 채널'],
  ['info', '매장 정보'],
  ['raw', '수집 기록'],
]

/** 크롤링 결과 화면 — 실험 메뉴와 매장 "자료 수집" 탭(저장된 결과)이 같이 쓴다.
    onFollow: 결과의 다른 주소(홈페이지·SNS)를 눌렀을 때. followLabel 로 버튼 문구를 바꾼다 */
export function CrawlResultView({ d, onFollow, followLabel }: { d: CrawlResult; onFollow: (url: string) => void; followLabel?: string }) {
  const hasInfo = d.hours.length > 0 || d.conveniences.length > 0 || d.payments.length > 0 || !!d.parking || d.transit.length > 0 || !!d.coord
  // 소스·매장마다 들어오는 칸이 달라서, 빈 구역은 숨기고 "없음" 목록으로만 알려 준다
  const counts: Record<SectionId, number | null> = {
    photos: d.photos.length,
    news: d.news.length,
    coupons: d.coupons.length,
    menus: d.menus.length + d.menuBoards.length,
    styles: d.styles.length,
    reviews: d.reviews.length + d.reviewKeywords.length + d.briefing.length,
    texts: d.texts.length,
    links: d.links.length,
    info: hasInfo ? null : 0,
    raw: null,
  }
  const shown = SECTIONS.filter(([id]) => counts[id] !== 0)
  const missing = SECTIONS.filter(([id]) => counts[id] === 0 && id !== 'styles' && id !== 'texts').map(([, l]) => l)
  const cover = d.photos.find((p) => p.source === 'business' || p.source === 'og' || p.source === 'profile') ?? d.photos[0]
  const show = (id: SectionId) => counts[id] !== 0
  return (
    <>
      <Hero d={d} cover={cover} />
      {(d.notes.length > 0 || missing.length > 0) && (
        <Note tone="info">
          <div className="grid gap-1">
            {missing.length > 0 && (
              <span>
                <b>이 주소에서 나오지 않은 것</b> · {missing.join(', ')}
              </span>
            )}
            {d.notes.map((n) => (
              <span key={n}>· {n}</span>
            ))}
          </div>
        </Note>
      )}
      <nav aria-label="결과 구역" className="sticky top-[49px] z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-line bg-card/95 p-1.5 backdrop-blur md:top-2">
        {shown.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] hover:bg-soft">
            {label}
            {counts[id] != null && <span className="rounded-full bg-accent-weak px-1.5 text-[11.5px] text-accent tabular">{counts[id]}</span>}
          </a>
        ))}
      </nav>
      {show('photos') && <Photos photos={d.photos} total={d.photoTotal} />}
      {show('news') && <News news={d.news} />}
      {show('coupons') && <Coupons d={d} />}
      {show('menus') && <Menus d={d} />}
      {show('styles') && <Styles d={d} />}
      {show('reviews') && <Reviews d={d} />}
      {show('texts') && <Texts d={d} />}
      {show('links') && <Links d={d} onFollow={onFollow} followLabel={followLabel} />}
      {show('info') && <Info d={d} />}
      <Raw d={d} />
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-soft px-3 py-2">
      <span className="text-[11.5px] text-ink-soft">{label}</span>
      <b className="text-[17px] tabular">{value}</b>
      {sub && <span className="text-[11.5px] text-ink-soft">{sub}</span>}
    </div>
  )
}

function Hero({ d, cover }: { d: CrawlResult; cover?: CrawlPhoto }) {
  const stats: [string, ReactNode, ReactNode?][] = []
  if (d.photos.length) stats.push(['사진', d.photos.length, d.photoTotal && d.photoTotal > d.photos.length ? `전체 ${d.photoTotal.toLocaleString()}장 중` : undefined])
  if (d.news.length) stats.push(['소식·이벤트', d.news.length])
  if (d.coupons.length) stats.push(['쿠폰·혜택', d.coupons.length])
  if (d.menus.length) stats.push(['메뉴·가격', d.menus.length, d.menuBoards.length ? `메뉴판 사진 ${d.menuBoards.length}` : undefined])
  if (d.reviews.length || d.reviewTotal) stats.push(['리뷰', d.reviews.length, d.reviewTotal ? `전체 ${d.reviewTotal.toLocaleString()}개${d.reviewScore ? ` · ★${d.reviewScore}` : ''}` : undefined])
  if (d.texts.length) stats.push(['페이지 글', d.texts.length])
  stats.push(['걸린 시간', `${(d.elapsedMs / 1000).toFixed(1)}초`, d.businessType ?? undefined])
  return (
    <Card className="grid gap-5 md:grid-cols-[260px_1fr]">
      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-soft md:aspect-square">{cover && <Img src={cover.url} className="size-full object-cover" />}</div>
      <div className="grid min-w-0 content-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="info">{kindLabel(d.kind)}</Pill>
          <h2 className="text-[21px] font-bold tracking-tight">{d.name}</h2>
          {d.category && <Pill tone="accent">{d.category}</Pill>}
          {d.hoursStatus && (
            <Pill tone={/영업 중/.test(d.hoursStatus) ? 'ok' : 'neutral'} dot>
              {d.hoursStatus}
            </Pill>
          )}
          <a href={d.pageUrl} target="_blank" rel="noreferrer" className="ml-auto text-[12.5px] text-accent hover:underline">
            원래 페이지 보기 ↗
          </a>
        </div>
        {d.description && <p className="line-clamp-6 max-w-[720px] text-[13.5px] whitespace-pre-line">{d.description}</p>}
        <dl className="grid gap-1 text-[13px] [&_dt]:w-24 [&_dt]:shrink-0 [&_dt]:text-ink-soft [&>div]:flex [&>div]:gap-2">
          {d.roadAddress && (
            <div>
              <dt>주소</dt>
              <dd>
                {d.roadAddress}
                {d.address && <span className="text-ink-soft"> (지번 {d.address})</span>}
              </dd>
            </div>
          )}
          {d.directions && (
            <div>
              <dt>찾아가기</dt>
              <dd>{d.directions}</dd>
            </div>
          )}
          {d.phone && (
            <div>
              <dt>전화</dt>
              <dd className="tabular">{d.phone}</dd>
            </div>
          )}
          {d.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        {d.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.keywords.map((k) => (
              <span key={k} className="rounded-md bg-soft px-2 py-0.5 text-[12px] text-ink-soft">
                #{k}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([l, v, s]) => (
            <Stat key={l} label={l} value={v} sub={s} />
          ))}
        </div>
      </div>
    </Card>
  )
}

function Section({ id, title, sub, action, children }: { id: string; title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardHead title={title} sub={sub} action={action} />
        {children}
      </Card>
    </section>
  )
}

/* ---------- 페이지 글 (홈페이지) ---------- */
function Texts({ d }: { d: CrawlResult }) {
  return (
    <Section id="texts" title="페이지 글" sub="홈페이지에서 읽은 글 원문 — 실제 등록 땐 AI 로 소개·메뉴·이벤트 칸에 나눠 넣어요">
      <div className="grid gap-3 lg:grid-cols-2">
        {d.texts.map((t, i) => (
          <TextCard key={i} t={t} />
        ))}
      </div>
    </Section>
  )
}
function TextCard({ t }: { t: CrawlResult['texts'][number] }) {
  const [more, setMore] = useState(false)
  return (
    <article className="grid content-start gap-2 rounded-xl border border-line p-3.5">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-bold">{t.title ?? '페이지'}</h3>
        <span className="text-[12px] text-ink-soft tabular">{t.body.length.toLocaleString()}자</span>
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer" className="ml-auto text-[12.5px] text-accent hover:underline">
            열기 ↗
          </a>
        )}
      </div>
      <p className={cx('text-[12.5px] whitespace-pre-line text-ink-soft', !more && 'line-clamp-[10]')}>{t.body}</p>
      <button type="button" onClick={() => setMore(!more)} className="justify-self-start text-[12.5px] text-accent">
        {more ? '접기' : '전체 보기'}
      </button>
    </article>
  )
}

/* ---------- 연결된 채널 ---------- */
function Links({ d, onFollow, followLabel = '가져오기' }: { d: CrawlResult; onFollow: (url: string) => void; followLabel?: string }) {
  return (
    <Section id="links" title="연결된 채널" sub="이 페이지가 알려 준 다른 주소 — 눌러서 이어서 가져올 수 있어요">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {d.links.map((l) => {
          const k = detectSource(l.url)
          const ok = SOURCES.find((s) => s.kind === k)?.supported
          return (
            <div key={l.url} className="flex items-center gap-2.5 rounded-lg border border-line p-2.5">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <b className="text-[13px]">{l.type ?? kindLabel(k)}</b>
                <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-[12px] text-ink-soft hover:text-accent">
                  {l.url}
                </a>
              </div>
              <Button size="sm" disabled={!ok} onClick={() => onFollow(l.url)} title={ok ? `${kindLabel(k)} 방식으로 가져오기` : '지원 안 됨'}>
                {followLabel}
              </Button>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/* ---------- 사진 ---------- */
function Photos({ photos, total }: { photos: CrawlPhoto[]; total: number | null }) {
  const sources = useMemo(() => {
    const m = new Map<string, number>()
    photos.forEach((p) => m.set(p.source, (m.get(p.source) ?? 0) + 1))
    return [...m.entries()]
  }, [photos])
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const list = filter ? photos.filter((p) => p.source === filter) : photos
  return (
    <Section id="photos" title="사진" sub={`${photos.length}장 가져옴${total && total > photos.length ? ` · 원래 페이지 표시 ${total.toLocaleString()}장` : ''} · 누르면 크게 봐요`}>
      {photos.length === 0 ? (
        <Empty title="사진을 가져오지 못했어요" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip on={!filter} onClick={() => setFilter(null)}>
              전체 {photos.length}
            </Chip>
            {sources.map(([s, n]) => (
              <Chip key={s} on={filter === s} onClick={() => setFilter(s)}>
                {sourceLabel(s)} {n}
              </Chip>
            ))}
          </div>
          <div className="columns-2 gap-2.5 sm:columns-3 lg:columns-5">
            {list.map((p, i) => (
              <button key={p.url} type="button" onClick={() => setOpen(i)} className="group relative mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-lg bg-soft text-left">
                <Img src={p.url} className="w-full transition group-hover:scale-[1.03]" />
                <span className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 py-px text-[11px] text-white">{sourceLabel(p.source)}</span>
                {p.videoUrl && <span className="absolute top-1.5 right-1.5 rounded bg-black/55 px-1.5 py-px text-[11px] text-white">▶ 영상</span>}
                {(p.date || p.author) && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pt-4 pb-1.5 text-[11px] text-white">{[p.author, p.date].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      {open != null && list[open] && <Lightbox photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </Section>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx('rounded-full border px-3 py-1 text-[12.5px]', on ? 'border-accent bg-accent-weak font-bold text-accent' : 'border-line bg-card hover:bg-soft')}>
      {children}
    </button>
  )
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: CrawlPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = photos[index]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1))
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onIndex, onClose])
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid grid-rows-[1fr_auto] bg-black/90 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative grid min-h-0 place-items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {p.videoUrl ? (
          <video key={p.videoUrl} src={p.videoUrl} poster={p.thumb} controls autoPlay className="max-h-full max-w-full rounded-lg" />
        ) : (
          <Img key={p.url} src={p.url} original className="max-h-full max-w-full rounded-lg object-contain" />
        )}
        <button type="button" aria-label="이전" disabled={index === 0} onClick={() => onIndex(index - 1)} className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25 disabled:opacity-30">
          ‹
        </button>
        <button type="button" aria-label="다음" disabled={index === photos.length - 1} onClick={() => onIndex(index + 1)} className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25 disabled:opacity-30">
          ›
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-white/85">
        <span className="tabular">
          {index + 1} / {photos.length}
        </span>
        <span>{sourceLabel(p.source)}</span>
        {p.title && <span>{p.title}</span>}
        {p.author && <span>@{p.author}</span>}
        {p.date && <span>{p.date}</span>}
        {p.width && p.height && (
          <span className="tabular">
            {p.width}×{p.height}
          </span>
        )}
        <a href={p.url} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" className="ml-auto underline underline-offset-2">
          원본 열기 ↗
        </a>
        <button type="button" onClick={onClose} className="rounded-md bg-white/15 px-3 py-1 hover:bg-white/25">
          닫기 (Esc)
        </button>
      </div>
    </div>
  )
}

/* ---------- 소식 ---------- */
function News({ news }: { news: CrawlNews[] }) {
  return (
    <Section id="news" title="소식 · 이벤트" sub="사장님이 올린 소식 탭 글 (알림·이벤트·할인)">
      {news.length === 0 ? (
        <Empty title="올라온 소식이 없어요">이 매장은 소식 탭에 글이 없거나 비공개예요.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {news.map((n, i) => (
            <NewsCard key={i} n={n} />
          ))}
        </div>
      )}
    </Section>
  )
}

function NewsCard({ n }: { n: CrawlNews }) {
  const [more, setMore] = useState(false)
  const long = (n.body?.length ?? 0) > 180
  return (
    <article className="grid content-start gap-2.5 rounded-xl border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {n.category && <Pill tone={/이벤트|EVENT|할인/i.test(n.category + n.title) ? 'warn' : 'info'}>{n.category}</Pill>}
        {n.isVideo && <Pill>영상</Pill>}
        <span className="ml-auto text-[12px] text-ink-soft">{[n.period, n.when].filter(Boolean).join(' · ')}</span>
      </div>
      <h3 className="text-[14.5px] font-bold">{n.title}</h3>
      {n.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {n.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="shrink-0">
              <Img src={src} className="h-36 w-auto rounded-lg bg-soft object-cover" />
            </a>
          ))}
        </div>
      )}
      {n.body && (
        <div>
          <p className={cx('text-[13px] whitespace-pre-line text-ink-soft', !more && 'line-clamp-4')}>{n.body}</p>
          {long && (
            <button type="button" onClick={() => setMore(!more)} className="mt-1 text-[12.5px] text-accent">
              {more ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}
      {n.url && (
        <a href={n.url} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent hover:underline">
          원문 ↗
        </a>
      )}
    </article>
  )
}

/* ---------- 쿠폰 ---------- */
function Coupons({ d }: { d: CrawlResult }) {
  return (
    <Section id="coupons" title="쿠폰">
      {d.coupons.length === 0 ? (
        <Empty title="발행 중인 쿠폰이 없어요" />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {d.coupons.map((c, i) => (
            <div key={i} className="flex overflow-hidden rounded-xl border border-dashed border-warn/50 bg-warn-weak/40">
              {c.image && <Img src={c.image} className="w-24 shrink-0 object-cover" />}
              <div className="grid content-center gap-1 px-3.5 py-3">
                <b className="text-[13.5px]">{c.title}</b>
                {c.description && <span className="text-[12.5px] text-ink-soft">{c.description}</span>}
                {c.period && <span className="text-[12px] text-warn">{c.period}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/* ---------- 메뉴 ---------- */
function Menus({ d }: { d: CrawlResult }) {
  const groups = useMemo(() => {
    const m = new Map<string, CrawlResult['menus']>()
    d.menus.forEach((x) => {
      const g = x.group ?? '메뉴'
      m.set(g, [...(m.get(g) ?? []), x])
    })
    return [...m.entries()]
  }, [d.menus])
  return (
    <Section id="menus" title="메뉴 · 가격" sub={d.menus.length ? `${d.menus.length}개` : undefined}>
      {d.menus.length === 0 && d.menuBoards.length === 0 ? (
        <Empty title="메뉴·가격 정보가 없어요" />
      ) : (
        <div className="grid gap-5">
          {groups.map(([g, items]) => (
            <div key={g} className="grid gap-2">
              {groups.length > 1 && <h3 className="text-[13px] font-bold text-ink-soft">{g}</h3>}
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                    {m.images[0] ? <Img src={m.images[0]} className="size-16 shrink-0 rounded-md bg-soft object-cover" /> : null}
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <b className="truncate text-[13.5px]">{m.name}</b>
                        {m.recommend && <Pill tone="accent">대표</Pill>}
                      </div>
                      {m.description && <span className="line-clamp-2 text-[12px] text-ink-soft">{m.description}</span>}
                    </div>
                    {m.price && <span className="shrink-0 text-[13.5px] font-bold tabular">{m.price}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {d.menuBoards.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-[13px] font-bold text-ink-soft">메뉴판 사진</h3>
              <div className="flex gap-2 overflow-x-auto">
                {d.menuBoards.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="shrink-0">
                    <Img src={src} className="h-48 w-auto rounded-lg bg-soft" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

/* ---------- 스타일 (뷰티 업종) ---------- */
function Styles({ d }: { d: CrawlResult }) {
  const [all, setAll] = useState(false)
  const list = all ? d.styles : d.styles.slice(0, 18)
  return (
    <Section id="styles" title="스타일" sub="미용실·네일샵 등 뷰티 업종만 있어요">
      {d.styles.length === 0 ? (
        <Empty title="스타일 정보가 없어요" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {list.map((s, i) => (
              <figure key={i} className="grid content-start gap-1.5">
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-soft">{s.image && <Img src={s.image} className="size-full object-cover" />}</div>
                <figcaption className="grid gap-1">
                  <b className="truncate text-[12.5px]">{s.title}</b>
                  <span className="line-clamp-2 text-[11.5px] text-ink-soft">{s.tags.map((t) => `#${t}`).join(' ')}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {d.styles.length > list.length && (
            <Button className="mt-3" size="sm" onClick={() => setAll(true)}>
              {d.styles.length - list.length}개 더 보기
            </Button>
          )}
        </>
      )}
    </Section>
  )
}

/* ---------- 리뷰 ---------- */
function Reviews({ d }: { d: CrawlResult }) {
  const max = Math.max(1, ...d.reviewKeywords.map((k) => k.count))
  return (
    <Section id="reviews" title="리뷰" sub={d.reviewTotal ? `리뷰 ${d.reviewTotal.toLocaleString()}개${d.reviewScore ? ` · 평균 ★${d.reviewScore}` : ''} 중 ${d.reviews.length}개` : undefined}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <h3 className="text-[13px] font-bold text-ink-soft">이런 점이 좋았어요</h3>
            {d.reviewKeywords.length === 0 && <span className="text-[12.5px] text-ink-soft">키워드 없음</span>}
            {d.reviewKeywords.slice(0, 12).map((k) => (
              <div key={k.name} className="relative flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-[12.5px]">
                <div className="absolute inset-y-0 left-0 bg-accent-weak" style={{ width: `${(k.count / max) * 100}%` }} />
                {k.icon && <Img src={k.icon} original className="relative size-4" />}
                <span className="relative">{k.name}</span>
                <b className="relative ml-auto tabular">{k.count}</b>
              </div>
            ))}
          </div>
          {d.briefing.length > 0 && (
            <div className="grid gap-1.5 rounded-lg bg-info-weak/60 p-3">
              <h3 className="text-[13px] font-bold text-info">{kindLabel(d.kind)} AI 요약</h3>
              {d.briefing.map((b, i) => (
                <p key={i} className="text-[12.5px]">
                  {b.sentence}
                  {b.sources.length > 0 && <span className="text-ink-soft"> · 근거 {b.sources.length}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="grid content-start gap-2.5">
          {d.reviews.length === 0 && <Empty title="리뷰 글을 가져오지 못했어요" />}
          {d.reviews.map((r, i) => (
            <article key={i} className="grid gap-2 rounded-lg border border-line p-3">
              <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                <b className="text-ink">{r.author ?? '익명'}</b>
                {r.rating != null && <span className="text-warn">{'★'.repeat(Math.round(r.rating))}</span>}
                {r.date && <span>{r.date}</span>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto text-accent hover:underline">
                    원문 ↗
                  </a>
                )}
              </div>
              {r.body && <p className="text-[13px] whitespace-pre-line">{r.body}</p>}
              {r.images.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {r.images.map((src) => (
                    <Img key={src} src={src} className="size-20 shrink-0 rounded-md bg-soft object-cover" />
                  ))}
                </div>
              )}
              {r.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.keywords.map((k) => (
                    <span key={k} className="rounded bg-soft px-1.5 py-px text-[11.5px] text-ink-soft">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}

/* ---------- 매장 정보 ---------- */
function Info({ d }: { d: CrawlResult }) {
  const rows: [string, ReactNode][] = [
    ['편의시설', d.conveniences.join(' · ')],
    ['결제', d.payments.join(' · ')],
    ['주차', d.parking],
  ]
  return (
    <Section id="info" title="매장 정보">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
        <div className="grid content-start gap-1.5">
          <h3 className="text-[13px] font-bold text-ink-soft">영업시간</h3>
          {d.hours.length === 0 ? (
            <span className="text-[12.5px] text-ink-soft">등록 안 됨</span>
          ) : (
            <table className="text-[13px]">
              <tbody>
                {d.hours.map((h) => (
                  <tr key={h.day} className="border-b border-line last:border-0">
                    <td className="w-10 py-1.5 font-bold">{h.day}</td>
                    <td className="py-1.5 tabular">{h.open && h.close ? `${h.open} – ${h.close}` : (h.note ?? '휴무')}</td>
                    <td className="py-1.5 text-[12px] text-ink-soft">{h.breaks.length ? `휴게 ${h.breaks.join(', ')}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid content-start gap-3">
          <dl className="grid gap-1.5 text-[13px]">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-16 shrink-0 text-ink-soft">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {d.transit.length > 0 && (
            <div className="grid gap-1">
              <h3 className="text-[13px] font-bold text-ink-soft">교통</h3>
              {d.transit.map((t) => (
                <span key={t} className="text-[13px]">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {d.coord && (
          <a
            href={d.kind === 'naver_place' ? `https://map.naver.com/p/entry/place/${d.id}` : `https://map.naver.com/p/search/${encodeURIComponent(d.roadAddress ?? `${d.coord.lat},${d.coord.lng}`)}`}
            target="_blank"
            rel="noreferrer"
            className="grid content-center justify-items-center gap-1 rounded-lg border border-line bg-soft p-5 text-center text-[13px] hover:bg-accent-weak"
          >
            <span className="text-[22px]">📍</span>
            <b>네이버 지도에서 위치 보기 ↗</b>
            <span className="text-[12px] text-ink-soft tabular">
              {d.coord.lat.toFixed(5)}, {d.coord.lng.toFixed(5)}
            </span>
          </a>
        )}
      </div>
    </Section>
  )
}

/* ---------- 수집 기록 ---------- */
function Raw({ d }: { d: CrawlResult }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${d.kind}-${d.id ?? 'page'}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <Section id="raw" title="수집 기록" sub="화면 구조가 바뀌어 빈 칸이 생기면 여기부터 봐요" action={<Button size="sm" onClick={download}>JSON 내려받기</Button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <h3 className="text-[13px] font-bold text-ink-soft">연 페이지</h3>
          {d.steps.map((s) => (
            <div key={s.tab} className="flex items-center gap-2 text-[13px]">
              <Pill tone={s.ok ? 'ok' : 'bad'}>{s.ok ? '성공' : '실패'}</Pill>
              <code>{s.tab.startsWith('/') ? s.tab : `/${s.tab}`}</code>
              <span className="ml-auto text-ink-soft tabular">{(s.ms / 1000).toFixed(1)}초</span>
              {s.note && <span className="text-[12px] text-bad">{s.note}</span>}
            </div>
          ))}
        </div>
        <div className="grid content-start gap-1.5">
          <h3 className="text-[13px] font-bold text-ink-soft">찾은 데이터 (요청·방법 × 횟수)</h3>
          <div className="flex flex-wrap gap-1.5">
            {d.ops.map((o) => (
              <code key={o.name} className="rounded bg-soft px-1.5 py-0.5 text-[12px]">
                {o.name} ×{o.count}
              </code>
            ))}
          </div>
        </div>
      </div>
      <div className="h-4" />
      <Note tone="info">
        <b>참고</b> · 사진은 소스마다 최대 80~120장, 리뷰는 첫 화면에 뜨는 만큼만 가져와요. 이미지 주소는 그 플랫폼 서버 것이라 오래 두면 바뀔 수 있어요 — 실제로 쓸 땐 우리 저장소로 복사해야 해요.
      </Note>
      {d.raw != null && <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-ink-soft">원본 데이터 보기</summary>
        <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-soft p-3 text-[11.5px]">{JSON.stringify(d.raw, null, 2)?.slice(0, 200000)}</pre>
      </details>}
    </Section>
  )
}
