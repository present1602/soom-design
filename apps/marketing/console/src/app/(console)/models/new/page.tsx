import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHead } from '@/components/ui'
import { requireStaff } from '@/lib/staff'
import { listLibraryVoices } from '@/lib/voices'
import { ModelWizard } from './model-wizard'

export const metadata: Metadata = { title: '모델 만들기' }

export default async function NewModelPage() {
  await requireStaff()
  const lib = await listLibraryVoices()
  return (
    <>
      <PageHead title="모델 만들기" crumb={<><Link href="/models">가상 모델</Link> / 새 모델</>} />
      <ModelWizard voices={lib.voices} libraryMissing={lib.missing} />
    </>
  )
}
