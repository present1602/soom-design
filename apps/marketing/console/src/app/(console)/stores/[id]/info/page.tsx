import { getSiteFeedPreview, getStore, listAdmins, listStoreEvents } from '@/lib/data'
import { requireStaff } from '@/lib/staff'
import { InfoForms } from './info-forms'

export default async function StoreInfo({ params }: PageProps<'/stores/[id]/info'>) {
  const staff = await requireStaff()
  const { id } = await params
  const d = (await getStore(id))!
  const managers = staff.role === 'super' ? (await listAdmins()).filter((a) => a.active).map((a) => ({ id: a.id, nickname: a.nickname })) : []
  const [feed, events] = await Promise.all([getSiteFeedPreview(id), listStoreEvents(id, true)])
  return <InfoForms storeId={id} client={d.client} store={d.store} isSuper={staff.role === 'super'} managers={managers} feed={feed} events={events} />
}
