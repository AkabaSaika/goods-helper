import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      goods: true,
      createdBy: { select: { id: true, username: true } },
    },
  })

  if (!bill) return NextResponse.json({ error: '账单不存在' }, { status: 404 })

  const isMember = bill.participants.some((p) => p.userId === session.userId)
  if (!isMember) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  return NextResponse.json({ bill })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const bill = await prisma.bill.findUnique({ where: { id } })
  if (!bill) return NextResponse.json({ error: '账单不存在' }, { status: 404 })
  if (bill.createdById !== session.userId) return NextResponse.json({ error: '只有创建者可以删除' }, { status: 403 })

  await prisma.bill.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
