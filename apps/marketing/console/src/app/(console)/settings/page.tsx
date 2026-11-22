import type { Metadata } from 'next'
import { PageHead } from '@/components/ui'
import { listMoods } from '@/lib/data'
import { requireSuper } from '@/lib/staff'
import { MoodEditor } from './mood-editor'

export const metadata: Metadata = { title: '생성 옵션' }

export default async function SettingsPage() {
  await requireSuper()
  const moods = await listMoods(false)
  return (
    <>
      <PageHead title="생성 옵션" sub="콘텐츠 생성 화면에 나오는 선택지를 관리해요" />
      <MoodEditor moods={moods.map((m) => ({ id: m.id, label: m.label, active: m.active }))} />
    </>
  )
}
