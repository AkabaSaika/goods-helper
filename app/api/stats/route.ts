import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/stats?groupId=xxx&from=2024-01-01&to=2024-12-31
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const groupId = searchParams.get('groupId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  }

  const bills = await prisma.bill.findMany({
    where: {
      groupId,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    },
    include: {
      participants: { where: { userId: session.userId } },
      goods: true,
    },
  })

  let totalPaid = 0
  let totalShouldPay = 0
  const byType: Record<string, number> = { AA: 0, ADVANCE: 0, GOODS: 0 }
  const byCharacter: Record<string, number> = {}

  for (const bill of bills) {
    const me = bill.participants[0]
    if (!me) continue

    totalPaid += Number(me.paidAmount)
    totalShouldPay += Number(me.shouldPayAmount)
    byType[bill.type] = (byType[bill.type] ?? 0) + Number(me.shouldPayAmount)

    if (bill.type === 'GOODS') {
      for (const item of bill.goods) {
        const key = item.characterName ?? '未标注'
        byCharacter[key] = (byCharacter[key] ?? 0) + Number(item.unitPrice) * item.quantity
      }
    }
  }

  return NextResponse.json({
    totalPaid,
    totalShouldPay,
    totalAdvanced: totalPaid - totalShouldPay,
    byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
    byCharacter: Object.entries(byCharacter)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
  })
}
