'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, ArrowLeftRight, User, ShoppingBag } from 'lucide-react'
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden">
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 pt-2 pb-3 text-xs transition-all cursor-pointer',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-colors',
                active ? 'bg-primary/10' : ''
              )}>
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              </div>
              <span className={cn('text-[10px] leading-none', active && 'font-semibold')}>{item.label}</span>
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
    <aside className="hidden md:flex w-56 min-h-screen flex-col border-r border-border bg-card p-4 gap-1">
      <div className="flex items-center gap-2.5 px-3 py-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
          <ShoppingBag className="h-4 w-4 text-primary-foreground" />
        </div>
        <h1 className="text-base font-bold text-foreground">Goods Helper</h1>
      </div>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer',
              active
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 1.5} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
