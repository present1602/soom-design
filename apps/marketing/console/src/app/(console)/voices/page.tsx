import type { Metadata } from 'next'
import { Note, PageHead } from '@/components/ui'
import { requireStaff } from '@/lib/staff'
import { listLibraryVoices } from '@/lib/voices'
import { VoiceLibrary } from './voice-library'

export const metadata: Metadata = { title: '목소리 보관함' }

export default async function VoicesPage() {
  const staff = await requireStaff()
  const lib = await listLibraryVoices()
  return (
    <>
      <PageHead title="목소리 보관함" sub="AI로 만든 목소리를 별칭을 붙여 모아 둬요. 모델을 만들거나 목소리를 바꿀 때 여기서 골라요" />
      {lib.missing ? (
        <Note tone="warn">목소리 보관함을 쓰려면 Supabase SQL Editor에서 supabase/migrations/0006_voice_library.sql 을 먼저 돌려 주세요.</Note>
      ) : (
        <VoiceLibrary voices={lib.voices} canArchive={staff.role === 'super'} />
      )}
    </>
  )
}
