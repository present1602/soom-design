'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PLATFORM_INFO, PLATFORMS, type Platform } from '@marketing/core/channels'
import type { ChannelStatus } from '@marketing/core/types'
import { canConnect } from '@marketing/core/oauth'
import { createConnectLinkAction, removeChannelAction, saveChannelAction } from '@/actions/clients'
import { CHANNEL_STATUS, ChannelIcon } from '@/components/channel-icon'
import { useToast } from '@/components/toast'
import { Button, Card, ErrorLine, Field, Pill, inputCls } from '@/components/ui'
import { useAction } from '@/components/use-action'

type Ch = { platform: Platform; handle: string; profileUrl: string; status: ChannelStatus; expiresAt: string | null }

export function ChannelForms({ storeId, channels }: { storeId: string; channels: Ch[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PLATFORMS.map((p) => (
        <ChannelForm key={p} storeId={storeId} platform={p} current={channels.find((c) => c.platform === p) ?? null} />
      ))}
    </div>
  )
}

function ChannelForm({ storeId, platform, current }: { storeId: string; platform: Platform; current: Ch | null }) {
  const info = PLATFORM_INFO[platform]
  const router = useRouter()
  const toast = useToast()
  const [handle, setHandle] = useState(current?.handle ?? '')
  const [url, setUrl] = useState(current?.profileUrl ?? '')
  const [kakaoManager, setKakaoManager] = useState(current?.status === 'manager')
  const save = useAction()
  const remove = useAction()
  const link = useAction()
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const connectable = canConnect(platform)
  const dirty = handle !== (current?.handle ?? '') || url !== (current?.profileUrl ?? '') || (platform === 'kakao' && kakaoManager !== (current?.status === 'manager'))

  return (
    <Card className="grid gap-3.5">
      <div className="flex items-center gap-2.5">
        <ChannelIcon platform={platform} size={28} />
        <h2 className="text-[16px] font-bold">{info.name}</h2>
        <div className="ml-auto">{current ? <Pill tone={CHANNEL_STATUS[current.status].tone} dot>{CHANNEL_STATUS[current.status].label}</Pill> : <Pill>미등록</Pill>}</div>
      </div>
      <Field label="계정 이름" htmlFor={`ch-${platform}-h`}>
        <input id={`ch-${platform}-h`} className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={info.handleHint} />
      </Field>
      <Field label="프로필 주소" htmlFor={`ch-${platform}-u`}>
        <input id={`ch-${platform}-u`} className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
      </Field>
      {platform === 'kakao' && (
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" className="size-4 accent-accent" checked={kakaoManager} onChange={(e) => setKakaoManager(e.target.checked)} />
          회사 공용 카카오계정이 톡채널 매니저로 초대됐어요
        </label>
      )}
      <p className="text-[12.5px] text-ink-soft">{info.note}</p>
      {connectable && current?.status === 'connected' && current.expiresAt && (
        <p className="text-[12.5px] text-ink-soft">토큰 만료 {current.expiresAt.slice(0, 10)} — 워커가 만료 전에 자동으로 연장해요.</p>
      )}
      {connectable && current?.status === 'expired' && <p className="text-[12.5px] text-bad">연결이 끊겼어요. 연결 링크를 다시 보내 허용받아 주세요.</p>}
      {linkUrl && (
        <div className="grid gap-1.5 rounded-lg bg-soft p-2.5">
          <span className="text-[12.5px] text-ink-soft">고객에게 보낼 링크 (7일 동안 열려요). 고객이 열어 직접 로그인·허용하면 연결돼요.</span>
          <input readOnly className={inputCls} value={linkUrl} onFocus={(e) => e.currentTarget.select()} aria-label="연결 링크" />
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="justify-self-start text-[12.5px] text-accent">
            이 브라우저에서 바로 열기 ↗
          </a>
        </div>
      )}
      <ErrorLine error={save.error ?? remove.error ?? link.error} />
      <div className="flex flex-wrap items-center gap-2">
        {connectable ? (
          <Button
            size="sm"
            disabled={link.pending}
            onClick={() =>
              link.run(() => createConnectLinkAction(storeId, platform), async (r) => {
                setLinkUrl(r.url)
                try {
                  await navigator.clipboard.writeText(r.url)
                  toast('연결 링크를 복사했어요. 고객에게 보내 주세요')
                } catch {
                  toast('연결 링크를 만들었어요. 아래 주소를 복사해 보내 주세요')
                }
              })
            }
          >
            {link.pending ? '만드는 중…' : current?.status === 'connected' || current?.status === 'expired' ? '다시 연결 링크 복사' : '연결 링크 복사'}
          </Button>
        ) : (
          info.api && (
            <Button size="sm" disabled title="스레드 연결은 다음 단계에서 붙여요">
              연결 링크 (준비 중)
            </Button>
          )
        )}
        {current && (
          <Button
            size="sm"
            tone="danger"
            disabled={remove.pending}
            onClick={() =>
              remove.run(() => removeChannelAction(storeId, platform), () => {
                setHandle('')
                setUrl('')
                toast(`${info.name} 등록을 해제했어요`)
                router.refresh()
              })
            }
          >
            등록 해제
          </Button>
        )}
        <Button
          size="sm"
          tone="primary"
          className="ml-auto"
          disabled={save.pending || !dirty || !handle.trim()}
          onClick={() =>
            save.run(() => saveChannelAction(storeId, platform, { handle, profileUrl: url, kakaoManager }), () => {
              toast(`${info.name} 정보를 저장했어요`)
              router.refresh()
            })
          }
        >
          {save.pending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}
