import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: '只支持图片文件' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: '图片不能超过 5MB' }, { status: 400 })

  const blob = await put(`goods/${session.userId}/${Date.now()}-${file.name}`, file, {
    access: 'public',
  })

  return NextResponse.json({ url: blob.url })
}
