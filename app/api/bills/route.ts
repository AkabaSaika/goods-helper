import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const participantSchema = z.object({
  userId: z.string(),
  paidAmount: z.number().min(0),
  shouldPayAmount: z.number().min(0),
})

const goodsItemSchema = z.object({
  name: z.string().min(1),
  characterName: z.string().optional(),
  unitPrice: z.number().positive(),
  quantity: z.number().int().min(1),
})

const createBillSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.enum(['AA', 'ADVANCE', 'GOODS']),
  totalAmount: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().max(500).optional(),
  groupId: z.string(),
  participants: z.array(participantSchema).min(1),
  goods: z.array(goodsItemSchema).optional(),
})

// GET /api/bills?groupId=xxx&type=AA&page=1
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const groupId = searchParams.get('groupId')
  const type = searchParams.get('type')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20

  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const bills = await prisma.bill.findMany({
    where: {
      groupId,
      ...(type ? { type: type as 'AA' | 'ADVANCE' | 'GOODS' } : {}),
      participants: { some: { userId: session.userId } },
    },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      goods: true,
      createdBy: { select: { id: true, username: true } },
    },
    orderBy: { date: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return NextResponse.json({ bills })
}

// POST /api/bills
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const parsed = createBillSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: '参数错误', details: parsed.error.flatten() }, { status: 400 })

  const { participants, goods, ...billData } = parsed.data

  const bill = await prisma.$transaction(async (tx) => {
    const createdBill = await tx.bill.create({
      data: {
        ...billData,
        totalAmount: billData.totalAmount,
        date: new Date(billData.date),
        createdById: session.userId,
        participants: {
          create: participants,
        },
      },
      include: { participants: true },
    })

    if (billData.type === 'GOODS' && goods?.length) {
      await tx.goodsItem.createMany({
        data: goods.map((g) => ({
          billId: createdBill.id,
          name: g.name,
          characterName: g.characterName ?? null,
          unitPrice: g.unitPrice,
          quantity: g.quantity,
        })),
      })
    }

    return createdBill
  })

  return NextResponse.json({ bill }, { status: 201 })
}
