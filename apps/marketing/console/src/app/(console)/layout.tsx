import { ToastProvider } from '@/components/toast'
import { Sidebar } from '@/components/sidebar'
import { requireStaff } from '@/lib/staff'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  return (
    <ToastProvider>
      <div className="grid min-h-full md:grid-cols-[224px_1fr]">
        <Sidebar nickname={staff.nickname} role={staff.role} />
        <main className="min-w-0 px-4 pt-6 pb-16 md:px-7">
          <div className="mx-auto grid max-w-[1200px] gap-[18px]">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
