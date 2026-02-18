import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  })

  if (!group) return NextResponse.json({ error: '圈子不存在' }, { status: 404 })

  const isMember = group.members.some((m) => m.userId === session.userId)
  if (!isMember) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  return NextResponse.json({ group })
}
