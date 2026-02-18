import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'

const schema = z.object({
  username: z.string().min(2).max(20),
  password: z.string().min(6),
  inviteCode: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误', details: parsed.error.flatten() }, { status: 400 })
  }

  const { username, password, inviteCode } = parsed.data

  // 查找邀请码对应的圈子
  const group = await prisma.group.findUnique({ where: { inviteCode } })
  if (!group) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 400 })
  }

  // 检查用户名是否已存在
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return NextResponse.json({ error: '用户名已存在' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      groups: {
        create: { groupId: group.id, role: 'MEMBER' },
      },
    },
  })

  const token = await signToken({ userId: user.id, username: user.username })

  const response = NextResponse.json(
    { user: { id: user.id, username: user.username } },
    { status: 201 }
  )
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return response
}
