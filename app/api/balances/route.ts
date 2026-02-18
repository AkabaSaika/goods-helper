import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { calculatePairBalance } from '@/lib/balance'

// GET /api/balances?groupId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const [bills, settlements, members] = await Promise.all([
    prisma.bill.findMany({
      where: { groupId },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        participants: {
          select: { userId: true, paidAmount: true, shouldPayAmount: true },
        },
      },
    }),
    prisma.settlement.findMany({ where: { groupId } }),
    prisma.userGroup.findMany({
      where: { groupId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    }),
  ])

  // 按账单分组传入，避免多张账单平铺导致比例计算错误
  const billParticipantGroups = bills.map((b) =>
    b.participants.map((p) => ({
      userId: p.userId,
      paidAmount: p.paidAmount.toString(),
      shouldPayAmount: p.shouldPayAmount.toString(),
    }))
  )

  const settlementRecords = settlements.map((s) => ({
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount.toString(),
  }))

  const balanceMap = calculatePairBalance({
    userId: session.userId,
    bills: billParticipantGroups,
    settlements: settlementRecords,
  })

  // 计算每对用户之间各账单的明细贡献
  const pairDetails = new Map<string, Array<{
    billId: string
    title: string
    type: string
    date: string
    amount: number
  }>>()

  for (const bill of bills) {
    const me = bill.participants.find((p) => p.userId === session.userId)
    if (!me) continue

    const myExtra = Number(me.paidAmount) - Number(me.shouldPayAmount)
    const others = bill.participants.filter((p) => p.userId !== session.userId)
    const totalOthersShould = others.reduce((sum, o) => sum + Number(o.shouldPayAmount), 0)

    for (const other of others) {
      const proportion = totalOthersShould > 0 ? Number(other.shouldPayAmount) / totalOthersShould : 0
      const billNet = myExtra * proportion
      if (Math.abs(billNet) < 0.005) continue

      const existing = pairDetails.get(other.userId) ?? []
      existing.push({
        billId: bill.id,
        title: bill.title,
        type: bill.type,
        date: bill.date.toISOString(),
        amount: billNet,
      })
      pairDetails.set(other.userId, existing)
    }
  }

  const balances = members
    .filter((m) => m.userId !== session.userId)
    .map((m) => ({
      user: m.user,
      netAmount: balanceMap.get(m.userId) ?? 0,
      details: pairDetails.get(m.userId) ?? [],
    }))

  return NextResponse.json({ balances })
}
