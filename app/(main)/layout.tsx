import { SideNav, BottomNav } from '@/components/shared/nav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
