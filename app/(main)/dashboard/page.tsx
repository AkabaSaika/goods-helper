import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { BillCard } from '@/components/shared/bill-card'
import { formatCurrency } from '@/lib/utils'
import { calculatePairBalance } from '@/lib/balance'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { groups: { include: { group: true } } },
  })

  const firstGroup = user?.groups[0]?.group
  if (!firstGroup) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-md shadow-primary/30 shrink-0">
            {session.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">欢迎回来</p>
            <h1 className="text-lg font-bold">{session.username}</h1>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">你还没有加入任何圈子，请联系朋友获取邀请码。</p>
      </div>
    )
  }

  const [bills, settlements] = await Promise.all([
    prisma.bill.findMany({
      where: { groupId: firstGroup.id, participants: { some: { userId: session.userId } } },
      include: {
        participants: { include: { user: { select: { id: true, username: true } } } },
        goods: true,
      },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    prisma.settlement.findMany({
      where: { groupId: firstGroup.id, OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] },
    }),
  ])

  const allBillsForBalance = await prisma.bill.findMany({
    where: { groupId: firstGroup.id },
    include: { participants: true },
  })

  const billParticipantGroups = allBillsForBalance.map((b) => b.participants.map((p) => ({
    userId: p.userId,
    paidAmount: p.paidAmount.toString(),
    shouldPayAmount: p.shouldPayAmount.toString(),
  })))

  const balanceMap = calculatePairBalance({
    userId: session.userId,
    bills: billParticipantGroups,
    settlements: settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount.toString(),
    })),
  })

  const totalIOwe = Array.from(balanceMap.values()).filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0)
  const totalOwedToMe = Array.from(balanceMap.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-md shadow-primary/30 shrink-0">
          {session.username[0].toUpperCase()}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">欢迎回来</p>
          <h1 className="text-lg font-bold">{session.username}</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-rose-500 mb-1 font-medium">我欠别人</p>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalIOwe)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 mb-1 font-medium">别人欠我</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalOwedToMe)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">最近账单</h2>
        {bills.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">还没有账单</p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => <BillCard key={bill.id} bill={{ ...bill, totalAmount: Number(bill.totalAmount), date: bill.date.toISOString() }} />)}
          </div>
        )}
      </div>
    </div>
  )
}
