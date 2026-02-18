import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Receipt, ShoppingBag, CreditCard } from 'lucide-react'

const billTypeConfig = {
  AA: { label: 'AA', icon: Receipt, color: 'bg-sky-100 text-sky-600' },
  ADVANCE: { label: '垫付', icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
  GOODS: { label: '周边', icon: ShoppingBag, color: 'bg-violet-100 text-violet-600' },
}

interface BillCardProps {
  bill: {
    id: string
    title: string
    type: 'AA' | 'ADVANCE' | 'GOODS'
    totalAmount: string | number
    date: string
    participants: { user: { id: string; username: string; avatarUrl?: string | null } }[]
  }
}

export function BillCard({ bill }: BillCardProps) {
  const config = billTypeConfig[bill.type]
  const Icon = config.icon

  return (
    <Link href={`/bills/${bill.id}`} className="block group cursor-pointer">
      <Card className="transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5 border-border/60">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl shrink-0 ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{bill.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(bill.date)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-foreground">{formatCurrency(Number(bill.totalAmount))}</p>
            <div className="flex -space-x-1 justify-end mt-1">
              {bill.participants.slice(0, 3).map((p) => (
                <Avatar key={p.user.id} className="h-5 w-5 border border-white">
                  <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">{p.user.username[0]}</AvatarFallback>
                </Avatar>
              ))}
              {bill.participants.length > 3 && (
                <span className="text-xs text-muted-foreground ml-1">+{bill.participants.length - 3}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
