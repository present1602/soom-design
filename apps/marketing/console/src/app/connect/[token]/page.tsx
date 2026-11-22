import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PLATFORM_INFO } from '@marketing/core/channels'
import { ChannelIcon } from '@/components/channel-icon'
import { btn } from '@/components/ui'
import { readState } from '@/lib/oauth'
import { db } from '@/lib/supabase'

export const metadata: Metadata = { title: '채널 연결' }

/* 고객이 여는 연결 링크. 로그인 없이 열린다 — 서명된 링크 값만 믿는다.
   보여 주는 것은 매장 이름과 플랫폼뿐이고, 토큰·다른 매장 정보는 내보내지 않는다. */
export default async function ConnectPage({ params, searchParams }: PageProps<'/connect/[token]'>) {
  await connection()
  const { token } = await params
  const sp = await searchParams
  const ok = typeof sp.ok === 'string' ? sp.ok : null
  const error = typeof sp.error === 'string' ? sp.error : null

  const r = readState(token)
  if (!r.ok) return <Shell><Bad>{r.error}</Bad></Shell>

  const { data } = await db().from('stores').select('name, clients(name)').eq('id', r.state.storeId).maybeSingle()
  const store = data as unknown as { name: string; clients: { name: string } | null } | null
  if (!store) return <Shell><Bad>매장을 찾지 못했어요. 담당자에게 새 링크를 요청해 주세요.</Bad></Shell>

  const info = PLATFORM_INFO[r.state.platform]
  const storeName = store.clients?.name && store.clients.name !== store.name ? `${store.clients.name} ${store.name}` : store.name
  const start = `/api/oauth/start?t=${encodeURIComponent(token)}`

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <ChannelIcon platform={r.state.platform} size={36} />
        <div>
          <h1 className="text-[17px] font-bold">{info.name} 연결</h1>
          <p className="text-[13px] text-ink-soft">{storeName}</p>
        </div>
      </div>

      {ok ? (
        <p className="rounded-lg bg-ok-weak px-3 py-2.5 text-[13.5px] text-ok">
          <b>{ok}</b> 계정이 연결됐어요. 이 창은 닫으셔도 돼요.
        </p>
      ) : (
        <>
          {error && <Bad>{error}</Bad>}
          <div className="grid gap-2 text-[13.5px] leading-relaxed">
            <p>
              <b>{storeName}</b>의 숏폼을 대행사가 {info.name}에 올릴 수 있도록 허용해 주세요.
            </p>
            <ul className="list-disc pl-5 text-[13px] text-ink-soft">
              <li>버튼을 누르면 {info.name} 공식 화면이 열려요. 그 화면에서 직접 로그인해 주세요.</li>
              <li>비밀번호는 대행사에 전달되지 않아요. 게시물을 올리는 권한만 받아요.</li>
              {r.state.platform === 'instagram' && <li>프로페셔널(비즈니스·크리에이터) 계정이어야 해요. 개인 계정은 인스타그램 앱 설정에서 무료로 전환할 수 있어요.</li>}
              {r.state.platform === 'youtube' && <li>채널이 여러 개면 숏폼을 올릴 채널을 골라 주세요. 권한 체크 화면에서는 모두 체크해 주세요.</li>}
              <li>언제든 {info.name} 설정에서 허용을 취소할 수 있어요.</li>
            </ul>
          </div>
          <a href={start} className={btn({ tone: 'primary', size: 'lg' })}>
            {error ? '다시 시도하기' : `${info.name}로 허용하러 가기`}
          </a>
        </>
      )}
    </Shell>
  )
}

function Bad({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-bad-weak px-3 py-2.5 text-[13px] text-bad">{children}</p>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="grid w-full max-w-[440px] gap-5 rounded-2xl border border-line bg-card p-7">{children}</div>
    </div>
  )
}
