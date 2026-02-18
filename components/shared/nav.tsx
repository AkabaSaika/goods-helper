'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, ArrowLeftRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: Home, label: '首页' },
  { href: '/bills', icon: Receipt, label: '账单' },
  { href: '/settlements', icon: ArrowLeftRight, label: '结算' },
  { href: '/profile', icon: User, label: '我的' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                active ? 'text-blue-600' : 'text-slate-500'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 min-h-screen flex-col border-r border-slate-200 bg-white p-4 gap-1">
      <h1 className="text-lg font-bold text-blue-600 px-3 py-2 mb-2">Goods Helper</h1>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              active
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
