'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Client, Store } from '@marketing/core/types'
import { SITE_FEED_EXAMPLE } from '@marketing/core/site-feed'
import type { StoreEvent } from '@marketing/core/events'
import { addStoreAction, saveWebSourceAction, testHomepageAction, testSiteFeedAction, updateClientAction, updateStoreAction } from '@/actions/clients'
import { archiveEventAction } from '@/actions/events'
import { EventDialog, EventSummary } from '@/components/event-dialog'
import { Dialog } from '@/components/dialog'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine, Field, inputCls, Note } from '@/components/ui'
import { useAction } from '@/components/use-action'
import type { SiteFeedPreview } from '@/lib/data'

export function InfoForms({ storeId, client, store, isSuper, managers, feed, events }: { storeId: string; client: Client; store: Store; isSuper: boolean; managers: { id: string; nickname: string }[]; feed: SiteFeedPreview | null; events: StoreEvent[] | null }) {
  const router = useRouter()
  const toast = useToast()
  const [c, setC] = useState({ name: client.name, rep: client.rep_name, phone: client.phone, email: client.email ?? '' })
  const [s, setS] = useState({ name: store.name, kind: store.kind, address: store.address, phone: store.phone, hours: store.hours, intro: store.intro })
  const ca = useAction()
  const sa = useAction()
  const kind = s.kind === 'brand' ? '브랜드' : '매장'
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3.5">
          <h2 className="text-[16px] font-bold">고객사</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="고유코드"><input className={inputCls} value={client.code} readOnly /></Field>
            <Field label="고객사명" htmlFor="ci-n"><input id="ci-n" className={inputCls} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
            <Field label="대표자" htmlFor="ci-r"><input id="ci-r" className={inputCls} value={c.rep} onChange={(e) => setC({ ...c, rep: e.target.value })} /></Field>
            <Field label="연락처" htmlFor="ci-p"><input id="ci-p" className={inputCls} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} inputMode="tel" /></Field>
          </div>
          <Field label="이메일 (선택)" htmlFor="ci-e"><input id="ci-e" className={inputCls} value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} placeholder="없으면 비워 두세요" /></Field>
          <p className="text-[12.5px] text-ink-soft">고객사 정보는 이 고객사의 모든 매장에 함께 적용돼요.</p>
          <ErrorLine error={ca.error} />
          <div className="flex justify-end">
            <Button tone="primary" disabled={ca.pending} onClick={() => ca.run(() => updateClientAction(storeId, client.id, c), () => { toast('고객사 정보를 저장했어요'); router.refresh() })}>
              {ca.pending ? '저장 중…' : '고객사 저장'}
            </Button>
          </div>
        </Card>
        <Card className="grid content-start gap-3.5">
          <h2 className="text-[16px] font-bold">{kind}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${kind}명`} htmlFor="si-n"><input id="si-n" className={inputCls} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
            <Field label="구분" htmlFor="si-k">
              <select id="si-k" className={inputCls} value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value as Store['kind'] })}>
                <option value="store">매장</option>
                <option value="brand">브랜드</option>
              </select>
            </Field>
          </div>
          <Field label="주소" htmlFor="si-a"><input id="si-a" className={inputCls} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="전화" htmlFor="si-t"><input id="si-t" className={inputCls} value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
            <Field label="영업시간" htmlFor="si-h"><input id="si-h" className={inputCls} value={s.hours} onChange={(e) => setS({ ...s, hours: e.target.value })} placeholder="예: 매일 10:00–21:00" /></Field>
          </div>
          <Field label="소개 · 브랜드 톤" htmlFor="si-i" hint="AI 프롬프트에 함께 들어가요. 강점, 타깃 고객, 말투, 쓰지 않을 표현을 적어 두세요.">
            <textarea id="si-i" rows={4} className={inputCls} value={s.intro} onChange={(e) => setS({ ...s, intro: e.target.value })} />
          </Field>
          <ErrorLine error={sa.error} />
          <div className="flex justify-end">
            <Button tone="primary" disabled={sa.pending} onClick={() => sa.run(() => updateStoreAction(storeId, s), () => { toast(`${kind} 정보를 저장했어요`); router.refresh() })}>
              {sa.pending ? '저장 중…' : `${kind} 저장`}
            </Button>
          </div>
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <WebSourceCard storeId={storeId} store={store} feed={feed} />
        <EventsCard storeId={storeId} events={events} />
      </div>
      {isSuper && <AddStore clientId={client.id} managers={managers} />}
    </>
  )
}

function AddStore({ clientId, managers }: { clientId: string; managers: { id: string; nickname: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', kind: 'store' as 'store' | 'brand', managerId: managers[0]?.id ?? '' })
  const { pending, error, setError, run } = useAction()
  const close = () => {
    setOpen(false)
    setError(null)
  }
  return (
    <div className="flex justify-end">
      <Button onClick={() => setOpen(true)}>이 고객사에 매장·브랜드 추가</Button>
      <Dialog
        open={open}
        onClose={close}
        title="매장·브랜드 추가"
        footer={
          <>
            <Button onClick={close}>취소</Button>
            <Button tone="primary" disabled={pending} onClick={() => run(() => addStoreAction(clientId, f), (r) => router.push(`/stores/${r.storeId}/info`))}>
              {pending ? '추가 중…' : '추가'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="이름" htmlFor="ns-n"><input id="ns-n" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="예: 홍대점" /></Field>
          <Field label="구분" htmlFor="ns-k">
            <select id="ns-k" className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'store' | 'brand' })}>
              <option value="store">매장</option>
              <option value="brand">브랜드</option>
            </select>
          </Field>
          <Field label="콘텐츠 담당자" htmlFor="ns-m">
            <select id="ns-m" className={inputCls} value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}>
              <option value="">나중에 정하기</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
            </select>
          </Field>
        </div>
        <ErrorLine error={error} />
      </Dialog>
    </div>
  )
}

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** 홈페이지. 주소만 넣으면 페이지 글을 읽어 참고하고, 우리가 만든 사이트면 자료 API 로 상품·이벤트를 정확히 받는다.
    숏폼·배너를 만들 때마다 새로 불러 프롬프트 참고 자료로 쓴다. */
function WebSourceCard({ storeId, store, feed }: { storeId: string; store: Store; feed: SiteFeedPreview | null }) {
  const router = useRouter()
  const toast = useToast()
  const [home, setHome] = useState(store.homepage_url ?? '')
  const [useApi, setUseApi] = useState(!!store.site_feed_url)
  const [url, setUrl] = useState(store.site_feed_url ?? '')
  const [token, setToken] = useState('')
  const hasToken = !!store.site_feed_token
  const save = useAction()
  const test = useAction()
  const dirty = home !== (store.homepage_url ?? '') || useApi !== !!store.site_feed_url || (useApi && url !== (store.site_feed_url ?? '')) || token !== ''
  const savedApi = !!store.site_feed_url
  const canTest = savedApi || !!store.homepage_url
  const hp = feed?.homepage
  return (
    <Card className="grid content-start gap-3.5">
      <div>
        <h2 className="text-[16px] font-bold">홈페이지</h2>
        <p className="mt-1 text-[13px] text-ink-soft">숏폼·배너를 만들 때마다 홈페이지를 새로 읽어 AI 참고 자료로 넣어요. 사이트에서 바꾼 상품·이벤트가 바로 반영돼요.</p>
      </div>
      {feed === null && <Note tone="warn">DB에 홈페이지 자료 칸이 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0002_site_feed.sql 을 먼저 돌려 주세요.</Note>}
      {feed && !feed.homepageReady && <Note tone="warn">홈페이지 주소 칸이 아직 없어요. supabase/migrations/0005_store_web_events.sql 을 돌려 주세요.</Note>}
      <Field label="홈페이지 주소" htmlFor="hp-u" hint={useApi ? '자료 API 를 쓰면 페이지 대신 API 자료를 참고해요. 주소는 기록용으로 남아요.' : '페이지의 제목·소개·본문 글을 읽어요. 네이버 플레이스·인스타처럼 글이 거의 안 읽히는 곳도 있어요.'}>
        <input id="hp-u" className={inputCls} value={home} onChange={(e) => setHome(e.target.value)} placeholder="https://고객사도메인" inputMode="url" />
      </Field>
      {!useApi && hp && (hp.fetchedAt || hp.error) && (
        <div className="grid gap-1.5 text-[13px]">
          {hp.fetchedAt && (
            <p>
              마지막으로 읽은 내용: <b>{when(hp.fetchedAt)}</b>
              {hp.title && <> · {hp.title}</>} <span className="text-ink-soft">(본문 {hp.chars.toLocaleString()}자)</span>
              {hp.description && <span className="mt-0.5 block text-ink-soft">{hp.description}</span>}
            </p>
          )}
          {hp.error && <Note tone="bad">마지막 읽기 실패: {hp.error}{hp.fetchedAt ? ' — 생성할 때는 지난 내용으로 대신해요.' : ''}</Note>}
        </div>
      )}

      <label className="flex items-start gap-2 rounded-lg bg-soft p-3 text-[13.5px]">
        <input type="checkbox" className="mt-0.5" checked={useApi} onChange={(e) => setUseApi(e.target.checked)} />
        <span>
          <b>우리가 만든 홈페이지예요 — 자료 API로 가져오기</b>
          <span className="block text-[12.5px] text-ink-soft">사이트에 읽기 전용 API를 넣어 두면 상품·가격·공지를 정확하게 받아요.</span>
        </span>
      </label>
      {useApi && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="자료 API 주소 (GET)" htmlFor="sf-u">
              <input id="sf-u" className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://고객사도메인/api/marketing-feed" inputMode="url" />
            </Field>
            <Field label="토큰 (선택)" htmlFor="sf-t" hint={hasToken ? '저장된 토큰이 있어요. 바꿀 때만 넣으세요.' : 'Authorization: Bearer 로 보내요.'}>
              <input id="sf-t" className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? '••••••••' : '없으면 비워 두세요'} autoComplete="off" />
            </Field>
          </div>
          {feed && savedApi && (feed.fetchedAt || feed.error) && (
            <div className="grid gap-1.5 text-[13px]">
              {feed.fetchedAt && (
                <p>
                  마지막으로 받은 자료: <b>{when(feed.fetchedAt)}</b> · 상품 {feed.items}개{feed.notices ? ` · 공지 ${feed.notices}개` : ''}
                  {feed.sample.length > 0 && <span className="text-ink-soft"> ({feed.sample.join(', ')}{feed.items > feed.sample.length ? ' …' : ''})</span>}
                </p>
              )}
              {feed.error && <Note tone="bad">마지막 불러오기 실패: {feed.error}{feed.fetchedAt ? ' — 생성할 때는 지난 자료로 대신해요.' : ''}</Note>}
            </div>
          )}
          <details className="text-[13px]">
            <summary className="cursor-pointer text-ink-soft">고객사 사이트가 돌려줄 형식 보기</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-soft p-3 text-[12px] leading-relaxed">{JSON.stringify(SITE_FEED_EXAMPLE, null, 2)}</pre>
          </details>
        </>
      )}
      <ErrorLine error={save.error ?? test.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={test.pending || save.pending || dirty || !canTest}
          title={dirty ? '먼저 저장해 주세요' : undefined}
          onClick={() => {
            save.setError(null)
            if (savedApi) test.run(() => testSiteFeedAction(storeId), (r) => { toast(`불러왔어요 · 상품 ${r.items}개${r.notices ? ` · 공지 ${r.notices}개` : ''}`); router.refresh() })
            else test.run(() => testHomepageAction(storeId), (r) => { toast(`읽었어요${r.title ? ` · ${r.title}` : ''} · 본문 ${r.chars.toLocaleString()}자`); router.refresh() })
          }}
        >
          {test.pending ? '읽는 중…' : '지금 읽어 보기'}
        </Button>
        <Button
          tone="primary"
          disabled={save.pending || !dirty}
          onClick={() => { test.setError(null); save.run(() => saveWebSourceAction(storeId, { homepageUrl: home, useApi, apiUrl: url, token: token || undefined }), () => { setToken(''); toast('홈페이지 설정을 저장했어요'); router.refresh() }) }}
        >
          {save.pending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}

/** 매장 이벤트. 콘텐츠를 만들 때 하나 골라 매장 정보와 함께 AI 에 넘긴다 */
function EventsCard({ storeId, events }: { storeId: string; events: StoreEvent[] | null }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<StoreEvent | 'new' | null>(null)
  const [showOld, setShowOld] = useState(false)
  const arc = useAction()
  const list = (events ?? []).filter((e) => showOld || !e.archived)
  const hidden = (events ?? []).filter((e) => e.archived).length
  return (
    <Card className="grid content-start gap-3.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="grid gap-1">
          <h2 className="text-[16px] font-bold">이벤트</h2>
          <p className="text-[13px] text-ink-soft">대행하며 진행할 이벤트·프로모션을 적어 두세요. 콘텐츠를 만들 때 골라서 매장 정보와 함께 숏폼·배너에 반영해요.</p>
        </div>
        <Button className="ml-auto" tone="primary" disabled={events === null} onClick={() => setEditing('new')}>이벤트 추가</Button>
      </div>
      {events === null && <Note tone="warn">DB에 매장 이벤트 표가 아직 없어요. Supabase SQL Editor에서 supabase/migrations/0005_store_web_events.sql 을 돌려 주세요.</Note>}
      {events && !list.length && <p className="text-[13px] text-ink-soft">아직 이벤트가 없어요.</p>}
      {list.length > 0 && (
        <ul className="grid divide-y divide-line rounded-xl border border-line">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
              <EventSummary e={e} />
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" onClick={() => setEditing(e)}>고치기</Button>
                <Button size="sm" tone="ghost" disabled={arc.pending} onClick={() => arc.run(() => archiveEventAction(storeId, e.id, !e.archived), () => { toast(e.archived ? '다시 목록에 올렸어요' : '목록에서 내렸어요'); router.refresh() })}>
                  {e.archived ? '다시 올리기' : '내리기'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" className="justify-self-start text-[12.5px] text-ink-soft underline" onClick={() => setShowOld(!showOld)}>
          {showOld ? '내린 이벤트 숨기기' : `내린 이벤트 ${hidden}개 보기`}
        </button>
      )}
      <ErrorLine error={arc.error} />
      {editing && (
        <EventDialog
          storeId={storeId}
          event={editing === 'new' ? null : editing}
          open
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast('이벤트를 저장했어요'); router.refresh() }}
        />
      )}
    </Card>
  )
}
