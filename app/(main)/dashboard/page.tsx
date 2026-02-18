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
        <h1 className="text-xl font-bold mb-4">你好，{session.username}</h1>
        <p className="text-slate-500">你还没有加入任何圈子，请联系朋友获取邀请码。</p>
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

  const allParticipants = (await prisma.bill.findMany({
    where: { groupId: firstGroup.id },
    include: { participants: true },
  })).flatMap((b) => b.participants.map((p) => ({
    userId: p.userId,
    paidAmount: p.paidAmount.toString(),
    shouldPayAmount: p.shouldPayAmount.toString(),
  })))

  const balanceMap = calculatePairBalance({
    userId: session.userId,
    participants: allParticipants,
    settlements: settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount.toString(),
    })),
  })

  const totalIOwe = Array.from(balanceMap.values()).filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0)
  const totalOwedToMe = Array.from(balanceMap.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">你好，{session.username} 👋</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <p className="text-xs text-red-500 mb-1">我欠别人</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalIOwe)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 mb-1">别人欠我</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalOwedToMe)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">最近账单</h2>
        {bills.length === 0 ? (
          <p className="text-slate-400 text-sm">还没有账单</p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}
          </div>
        )}
      </div>
    </div>
  )
}
