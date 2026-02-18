import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const schema = z.object({
  groupId: z.string(),
  toUserId: z.string(),
  amount: z.number().positive(),
  note: z.string().optional(),
  type: z.enum(['MARK_CLEARED', 'PAYMENT_RECORD']),
})

// GET /api/settlements?groupId=xxx - 获取圈子内所有结算记录
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
      OR: [{ fromUserId: session.userId }, { toUserId: session.userId }],
    },
    include: {
      fromUser: { select: { id: true, username: true } },
      toUser: { select: { id: true, username: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ settlements })
}

// POST /api/settlements - 创建结算记录
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: '参数错误' }, { status: 400 })

  const settlement = await prisma.settlement.create({
    data: { ...parsed.data, fromUserId: session.userId },
    include: {
      fromUser: { select: { id: true, username: true } },
      toUser: { select: { id: true, username: true } },
    },
  })

  return NextResponse.json({ settlement }, { status: 201 })
}
