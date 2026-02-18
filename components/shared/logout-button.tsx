'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50" onClick={handleLogout}>
      退出登录
    </Button>
  )
}
