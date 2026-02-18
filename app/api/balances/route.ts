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

  // 计算每对用户之间各账单的明细贡献（结算前的毛金额）
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
    .map((m) => {
      const rawDetails = pairDetails.get(m.userId) ?? []

      // 计算与该用户之间的净结算额
      // 正数 = 对方已还我，负数 = 我已还对方
      let netSettlement = settlements.reduce((sum, s) => {
        if (s.fromUserId === m.userId && s.toUserId === session.userId) return sum + Number(s.amount)
        if (s.fromUserId === session.userId && s.toUserId === m.userId) return sum - Number(s.amount)
        return sum
      }, 0)

      // FIFO：按日期从旧到新将结算额逐笔抵扣，过滤掉已结清的账单
      const sorted = [...rawDetails].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const outstanding: typeof rawDetails = []
      for (const d of sorted) {
        const sameSign =
          (netSettlement > 0 && d.amount > 0) || (netSettlement < 0 && d.amount < 0)

        if (!sameSign || Math.abs(netSettlement) < 0.005) {
          outstanding.push(d)
          continue
        }

        const absNet = Math.abs(netSettlement)
        const absAmt = Math.abs(d.amount)
        if (absNet >= absAmt) {
          // 该笔账单已被结算全覆盖，跳过
          netSettlement -= Math.sign(netSettlement) * absAmt
        } else {
          // 部分结算，显示剩余未结清金额
          outstanding.push({ ...d, amount: Math.sign(d.amount) * (absAmt - absNet) })
          netSettlement = 0
        }
      }

      return {
        user: m.user,
        netAmount: balanceMap.get(m.userId) ?? 0,
        details: outstanding.reverse(), // 最新的在前
      }
    })
    .filter((b) => Math.abs(b.netAmount) > 0.005) // 过滤掉浮点误差导致的"零余额"

  return NextResponse.json({ balances })
}
