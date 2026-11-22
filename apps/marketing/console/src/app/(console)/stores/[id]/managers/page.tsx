import { getStore, listAdmins } from '@/lib/data'
import { requireSuper } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { ManagerEditor } from './manager-editor'

export default async function StoreManagers({ params }: PageProps<'/stores/[id]/managers'>) {
  await requireSuper()
  const { id } = await params
  const d = (await getStore(id))!
  const all = (await listAdmins()).filter((a) => a.active && a.role === 'manager')
  const { data: counts } = await db().from('store_managers').select('admin_id')
  const n = new Map<string, number>()
  for (const r of (counts ?? []) as { admin_id: string }[]) n.set(r.admin_id, (n.get(r.admin_id) ?? 0) + 1)
  return (
    <ManagerEditor
      storeId={id}
      current={d.managers.map((m) => ({ ...m, stores: n.get(m.id) ?? 0 }))}
      options={all.filter((a) => !d.managers.some((m) => m.id === a.id)).map((a) => ({ id: a.id, nickname: a.nickname, email: a.email }))}
    />
  )
}
