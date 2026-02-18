import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/goods?groupId=xxx&character=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const groupId = searchParams.get('groupId')
  const character = searchParams.get('character')

  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const goods = await prisma.goodsItem.findMany({
    where: {
      bill: {
        groupId,
        type: 'GOODS',
        participants: { some: { userId: session.userId } },
      },
      ...(character ? { characterName: { contains: character, mode: 'insensitive' } } : {}),
    },
    include: {
      bill: { select: { id: true, title: true, date: true } },
    },
    orderBy: { bill: { date: 'desc' } },
  })

  return NextResponse.json({ goods })
}
