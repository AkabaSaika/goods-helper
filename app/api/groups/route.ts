import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
})

// GET /api/groups - 获取我的所有圈子
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: session.userId } } },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { userId: session.userId },
        select: { role: true },
      },
    },
  })

  return NextResponse.json({ groups })
}

// POST /api/groups - 创建新圈子
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: '参数错误' }, { status: 400 })

  const group = await prisma.group.create({
    data: {
      ...parsed.data,
      createdBy: session.userId,
      members: { create: { userId: session.userId, role: 'OWNER' } },
    },
  })

  return NextResponse.json({ group }, { status: 201 })
}
