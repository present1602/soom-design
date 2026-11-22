import { Note } from '@/components/ui'
import { listStoreSources, SOURCES_MIGRATION } from '@/lib/sources'
import { requireStaff } from '@/lib/staff'
import { SourcesView } from './sources-view'

export default async function StoreSources({ params }: PageProps<'/stores/[id]/sources'>) {
  await requireStaff()
  const { id } = await params
  const { rows, missing } = await listStoreSources(id)
  if (missing) return <Note tone="warn">{SOURCES_MIGRATION}</Note>
  return <SourcesView storeId={id} rows={rows} />
}
