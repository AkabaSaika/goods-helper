import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createId } from '@paralleldrive/cuid2'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const membership = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: session.userId, groupId: id } },
  })

  if (!membership || membership.role !== 'OWNER') {
    return NextResponse.json({ error: '只有 Owner 可以刷新邀请码' }, { status: 403 })
  }

  const group = await prisma.group.update({
    where: { id },
    data: { inviteCode: createId() },
    select: { inviteCode: true },
  })

  return NextResponse.json({ inviteCode: group.inviteCode })
}
