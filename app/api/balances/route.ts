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
      include: { participants: true },
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

  const balances = members
    .filter((m) => m.userId !== session.userId)
    .map((m) => ({
      user: m.user,
      netAmount: balanceMap.get(m.userId) ?? 0,
    }))

  return NextResponse.json({ balances })
}
