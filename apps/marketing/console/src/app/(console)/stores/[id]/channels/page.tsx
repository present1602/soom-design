import { Note } from '@/components/ui'
import { getStore } from '@/lib/data'
import { requireStaff } from '@/lib/staff'
import { ChannelForms } from './channel-forms'

export default async function StoreChannels({ params, searchParams }: PageProps<'/stores/[id]/channels'>) {
  await requireStaff()
  const { id } = await params
  const sp = await searchParams
  const d = (await getStore(id))!
  return (
    <>
      {sp.new === '1' && <Note tone="accent">고객사를 등록했어요. 이 매장의 채널을 등록하면 콘텐츠를 바로 올릴 수 있어요.</Note>}
      <Note tone="info">
        여기에 등록한 채널만 <b>콘텐츠 생성</b>의 업로드 대상에 나와요. 인스타그램·유튜브는 <b>연결 링크 복사</b>로 만든 링크를 고객에게 보내고, 고객이 직접 로그인해 허용하면 비밀번호 없이 자동으로 올려요. 스레드 연결은 준비 중이고, 카카오는 매니저로 초대받은 뒤 직원이 직접 올려요.
      </Note>
      <ChannelForms storeId={id} channels={d.channels.map((c) => ({ platform: c.platform, handle: c.handle, profileUrl: c.profile_url, status: c.status, expiresAt: c.token_expires_at }))} />
    </>
  )
}
