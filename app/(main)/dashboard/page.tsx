import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">你好，{session.username} 👋</h1>
      <p className="text-slate-500">账单功能开发中...</p>
    </div>
  )
}
