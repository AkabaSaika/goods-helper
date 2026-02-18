# Goods Helper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个供 10 人朋友圈使用的记账 APP，支持 AA 账单、垫付、动漫周边拼单、两两结算和统计报表。

**Architecture:** Next.js 全栈单体，API 用 Route Handlers，Prisma + PostgreSQL 持久化，JWT 存 httpOnly Cookie 做认证。本地用 Docker 跑 PostgreSQL，生产部署 Vercel + Neon。

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, shadcn/ui, Prisma, PostgreSQL, Jose (JWT), bcryptjs, Zod, Recharts

---

## Phase 1：项目基础设施

### Task 1：创建 docker-compose.yml

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.local`
- Create: `.gitignore`（更新）

**Step 1: 创建 docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: goods_helper
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: 创建 .env.local**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/goods_helper"
JWT_SECRET="your-super-secret-key-change-in-production-min-32-chars"
BLOB_READ_WRITE_TOKEN=""
```

**Step 3: 确认 .gitignore 包含以下条目**（文件应已存在，检查并补充）

```
.env.local
.env*.local
```

**Step 4: 启动数据库，验证连接**

```bash
docker-compose up -d
docker-compose ps
```

Expected: `postgres` 容器状态为 `Up`

**Step 5: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "chore: add docker-compose for local PostgreSQL"
```

---

### Task 2：安装依赖

**Files:**
- Modify: `package.json`（通过 npm install）

**Step 1: 安装 Prisma 和数据库客户端**

```bash
npm install @prisma/client
npm install -D prisma
```

**Step 2: 安装认证相关库**

```bash
npm install jose bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: 安装工具库**

```bash
npm install zod recharts
```

**Step 4: 初始化 shadcn/ui**

```bash
npx shadcn@latest init
```

当提示选择时：
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 5: 安装常用 shadcn/ui 组件**

```bash
npx shadcn@latest add button card input label select dialog tabs badge avatar sheet form
```

**Step 6: 初始化 Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

**Step 7: 安装测试框架**

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest @types/jest
```

**Step 8: 创建 jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

**Step 9: 创建 jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

**Step 10: 在 package.json 中添加 test 脚本**

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

**Step 11: Commit**

```bash
git add package.json package-lock.json jest.config.ts jest.setup.ts
git commit -m "chore: install dependencies and configure Jest"
```

---

### Task 3：Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 替换 prisma/schema.prisma 内容**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  avatarUrl    String?
  createdAt    DateTime @default(now())

  groups          UserGroup[]
  billsCreated    Bill[]
  participants    BillParticipant[]
  settlementsFrom Settlement[] @relation("FromUser")
  settlementsTo   Settlement[] @relation("ToUser")
}

model Group {
  id          String   @id @default(cuid())
  name        String
  description String?
  inviteCode  String   @unique @default(cuid())
  createdBy   String
  createdAt   DateTime @default(now())

  members     UserGroup[]
  bills       Bill[]
  settlements Settlement[]
}

model UserGroup {
  userId   String
  groupId  String
  role     Role     @default(MEMBER)
  joinedAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id])
  group Group @relation(fields: [groupId], references: [id])

  @@id([userId, groupId])
}

enum Role {
  OWNER
  MEMBER
}

model Bill {
  id          String   @id @default(cuid())
  title       String
  type        BillType
  totalAmount Decimal  @db.Decimal(10, 2)
  currency    String   @default("CNY")
  date        DateTime
  description String?
  groupId     String
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  group        Group             @relation(fields: [groupId], references: [id])
  createdBy    User              @relation(fields: [createdById], references: [id])
  participants BillParticipant[]
  goods        GoodsItem[]
}

enum BillType {
  AA
  ADVANCE
  GOODS
}

model BillParticipant {
  id              String  @id @default(cuid())
  billId          String
  userId          String
  paidAmount      Decimal @default(0) @db.Decimal(10, 2)
  shouldPayAmount Decimal @db.Decimal(10, 2)

  bill Bill @relation(fields: [billId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@unique([billId, userId])
}

model GoodsItem {
  id            String    @id @default(cuid())
  billId        String
  name          String
  characterName String?
  quantity      Int       @default(1)
  unitPrice     Decimal   @db.Decimal(10, 2)
  purchaseDate  DateTime?
  deliveryDate  DateTime?
  imageUrl      String?

  bill Bill @relation(fields: [billId], references: [id], onDelete: Cascade)
}

model Settlement {
  id         String         @id @default(cuid())
  groupId    String
  fromUserId String
  toUserId   String
  amount     Decimal        @db.Decimal(10, 2)
  date       DateTime       @default(now())
  note       String?
  type       SettlementType

  group    Group @relation(fields: [groupId], references: [id])
  fromUser User  @relation("FromUser", fields: [fromUserId], references: [id])
  toUser   User  @relation("ToUser", fields: [toUserId], references: [id])
}

enum SettlementType {
  MARK_CLEARED
  PAYMENT_RECORD
}
```

**Step 2: 运行数据库 migration**

```bash
npx prisma migrate dev --name init
```

Expected: `✔ Generated Prisma Client` + `The following migration(s) have been applied`

**Step 3: 验证 Prisma Client 生成**

```bash
npx prisma studio
```

浏览器打开 `http://localhost:5555`，确认所有表存在，然后 Ctrl+C 关闭。

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema with all models"
```

---

### Task 4：Prisma 客户端单例 + 基础 lib

**Files:**
- Create: `lib/db.ts`
- Create: `lib/auth.ts`
- Create: `lib/utils.ts`（覆盖 shadcn 生成的）

**Step 1: 创建 lib/db.ts（Prisma 单例，避免开发时重复创建连接）**

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 2: 创建 lib/auth.ts（JWT 工具函数）**

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-do-not-use-in-production'
)

export interface JWTPayload {
  userId: string
  username: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}
```

**Step 3: 创建 lib/utils.ts**（shadcn 可能已生成，检查后覆盖）

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = 'CNY'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
```

**Step 4: 安装 clsx 和 tailwind-merge（shadcn 可能已安装，确认一下）**

```bash
npm install clsx tailwind-merge
```

**Step 5: 写 lib/auth.ts 的单元测试**

```typescript
// __tests__/lib/auth.test.ts
import { signToken, verifyToken } from '@/lib/auth'

describe('auth utils', () => {
  it('signs and verifies a token', async () => {
    const payload = { userId: 'user-1', username: 'alice' }
    const token = await signToken(payload)
    expect(typeof token).toBe('string')

    const decoded = await verifyToken(token)
    expect(decoded?.userId).toBe('user-1')
    expect(decoded?.username).toBe('alice')
  })

  it('returns null for invalid token', async () => {
    const result = await verifyToken('invalid-token')
    expect(result).toBeNull()
  })
})
```

**Step 6: 运行测试确认通过**

```bash
npm test -- --testPathPattern="auth"
```

Expected: PASS `__tests__/lib/auth.test.ts`

**Step 7: Commit**

```bash
git add lib/ __tests__/
git commit -m "feat: add db singleton, auth utils, and formatters"
```

---

## Phase 2：用户认证

### Task 5：认证 API Routes

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`

**Step 1: 创建注册接口 app/api/auth/register/route.ts**

```typescript
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
```

**Step 2: 创建登录接口 app/api/auth/login/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'

const schema = z.object({
  username: z.string(),
  password: z.string(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 })
  }

  const { username, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, username: user.username })

  const response = NextResponse.json({ user: { id: user.id, username: user.username } })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}
```

**Step 3: 创建登出接口 app/api/auth/logout/route.ts**

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('auth-token')
  return response
}
```

**Step 4: 创建当前用户接口 app/api/auth/me/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      groups: {
        include: { group: true },
      },
    },
  })

  return NextResponse.json({ user })
}
```

**Step 5: Commit**

```bash
git add app/api/auth/
git commit -m "feat: add auth API routes (register, login, logout, me)"
```

---

### Task 6：Auth Middleware（路由保护）

**Files:**
- Create: `middleware.ts`

**Step 1: 创建 middleware.ts**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/register', '/api/auth/login', '/api/auth/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 允许公开路径
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 允许静态资源
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('auth-token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.delete('auth-token')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware for route protection"
```

---

### Task 7：登录页面 UI

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/layout.tsx`

**Step 1: 创建 auth layout app/(auth)/layout.tsx**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
```

**Step 2: 创建登录页 app/(auth)/login/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '登录失败')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Goods Helper</CardTitle>
        <CardDescription>登录你的账号</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
          <p className="text-center text-sm text-slate-500">
            没有账号？{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              注册
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add login page UI"
```

---

### Task 8：注册页面 UI

**Files:**
- Create: `app/(auth)/register/page.tsx`

**Step 1: 创建注册页 app/(auth)/register/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '', inviteCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '注册失败')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Goods Helper</CardTitle>
        <CardDescription>使用邀请码加入圈子</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">邀请码</Label>
            <Input
              id="inviteCode"
              value={form.inviteCode}
              onChange={(e) => update('inviteCode', e.target.value)}
              placeholder="粘贴邀请码"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="2-20个字符"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="至少6个字符"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
          <p className="text-center text-sm text-slate-500">
            已有账号？{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 2: 更新 app/layout.tsx 元信息**

将 `title` 改为 `"Goods Helper"`, `description` 改为 `"朋友圈记账 APP"`，并将 `<html lang="en">` 改为 `<html lang="zh-CN">`。

**Step 3: Commit**

```bash
git add app/\(auth\)/register/ app/layout.tsx
git commit -m "feat: add register page UI and update app metadata"
```

---

### Task 9：主布局 + Dashboard 骨架

**Files:**
- Create: `app/(main)/layout.tsx`
- Create: `app/(main)/dashboard/page.tsx`
- Create: `components/shared/nav.tsx`
- Modify: `app/page.tsx`（重定向到 /dashboard）

**Step 1: 创建 app/page.tsx（重定向）**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/dashboard')
}
```

**Step 2: 创建底部导航组件 components/shared/nav.tsx**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, ArrowLeftRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: Home, label: '首页' },
  { href: '/bills', icon: Receipt, label: '账单' },
  { href: '/settlements', icon: ArrowLeftRight, label: '结算' },
  { href: '/profile', icon: User, label: '我的' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                active ? 'text-blue-600' : 'text-slate-500'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 min-h-screen flex-col border-r border-slate-200 bg-white p-4 gap-1">
      <h1 className="text-lg font-bold text-blue-600 px-3 py-2 mb-2">Goods Helper</h1>
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              active
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
```

**Step 3: 安装 lucide-react**

```bash
npm install lucide-react
```

**Step 4: 创建主布局 app/(main)/layout.tsx**

```typescript
import { SideNav, BottomNav } from '@/components/shared/nav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

**Step 5: 创建 Dashboard 骨架 app/(main)/dashboard/page.tsx**

```typescript
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">你好，{session.username} 👋</h1>
      <p className="text-slate-500">账单功能开发中...</p>
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add app/ components/
git commit -m "feat: add main layout with responsive nav and dashboard skeleton"
```

---

## Phase 3：圈子管理 API

### Task 10：圈子 API

**Files:**
- Create: `app/api/groups/route.ts`（创建圈子）
- Create: `app/api/groups/[id]/route.ts`（获取圈子详情）
- Create: `app/api/groups/[id]/invite/route.ts`（刷新邀请码）
- Create: `app/api/groups/[id]/members/route.ts`（管理成员）

**Step 1: 创建圈子接口 app/api/groups/route.ts**

```typescript
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
```

**Step 2: 创建圈子详情接口 app/api/groups/[id]/route.ts**

```typescript
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
```

**Step 3: 创建刷新邀请码接口 app/api/groups/[id]/invite/route.ts**

```typescript
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
```

**Step 4: 安装 cuid2**

```bash
npm install @paralleldrive/cuid2
```

**Step 5: Commit**

```bash
git add app/api/groups/
git commit -m "feat: add group management API routes"
```

---

## Phase 4：账单功能

### Task 11：账单 API

**Files:**
- Create: `app/api/bills/route.ts`
- Create: `app/api/bills/[id]/route.ts`

**Step 1: 写账单余额计算工具函数 lib/balance.ts（先写测试）**

```typescript
// __tests__/lib/balance.test.ts
import { calculatePairBalance } from '@/lib/balance'

describe('calculatePairBalance', () => {
  it('returns positive when others owe the user', () => {
    // 用户A支付了100，应付50，则A被欠50
    const result = calculatePairBalance({
      userId: 'A',
      participants: [
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ],
      settlements: [],
    })
    expect(result.get('B')).toBe(50)
  })

  it('reduces balance after settlement', () => {
    const result = calculatePairBalance({
      userId: 'A',
      participants: [
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ],
      settlements: [
        { fromUserId: 'B', toUserId: 'A', amount: '30' },
      ],
    })
    expect(result.get('B')).toBe(20)
  })
})
```

**Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern="balance"
```

Expected: FAIL (function not found)

**Step 3: 实现 lib/balance.ts**

```typescript
// lib/balance.ts
interface Participant {
  userId: string
  paidAmount: string
  shouldPayAmount: string
}

interface SettlementRecord {
  fromUserId: string
  toUserId: string
  amount: string
}

interface BalanceInput {
  userId: string
  participants: Participant[]
  settlements: SettlementRecord[]
}

/**
 * 计算 userId 与其他每个人的净余额
 * 正数：对方欠 userId；负数：userId 欠对方
 */
export function calculatePairBalance({ userId, participants, settlements }: BalanceInput): Map<string, number> {
  // 净余额 map：key = 对方userId, value = 对方欠我的金额
  const balanceMap = new Map<string, number>()

  // 处理账单参与记录
  for (const p of participants) {
    if (p.userId === userId) continue
    const paid = parseFloat(p.paidAmount)
    const should = parseFloat(p.shouldPayAmount)
    const net = paid - should // 对方多付为正（对方应收），少付为负（对方应付我）
    // 对方net为负意味着对方欠我
    balanceMap.set(p.userId, (balanceMap.get(p.userId) ?? 0) - net)
  }

  // 自己的支付和应付
  const me = participants.find((p) => p.userId === userId)
  if (me) {
    const myPaid = parseFloat(me.paidAmount)
    const myShould = parseFloat(me.shouldPayAmount)
    const myExtra = myPaid - myShould // 我多付的金额，应由他人分摊
    // 分配到其他人
    const others = participants.filter((p) => p.userId !== userId)
    for (const other of others) {
      const otherShould = parseFloat(other.shouldPayAmount)
      const totalOthersShould = others.reduce((sum, o) => sum + parseFloat(o.shouldPayAmount), 0)
      const proportion = totalOthersShould > 0 ? otherShould / totalOthersShould : 0
      const owedByOther = myExtra * proportion
      balanceMap.set(other.userId, (balanceMap.get(other.userId) ?? 0) + owedByOther)
    }
  }

  // 处理结算记录
  for (const s of settlements) {
    const amount = parseFloat(s.amount)
    if (s.fromUserId === userId) {
      // 我还了对方
      balanceMap.set(s.toUserId, (balanceMap.get(s.toUserId) ?? 0) - amount)
    } else if (s.toUserId === userId) {
      // 对方还了我
      balanceMap.set(s.fromUserId, (balanceMap.get(s.fromUserId) ?? 0) - amount)
    }
  }

  return balanceMap
}
```

**Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern="balance"
```

Expected: PASS

**Step 5: 创建账单列表/创建接口 app/api/bills/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const participantSchema = z.object({
  userId: z.string(),
  paidAmount: z.number().min(0),
  shouldPayAmount: z.number().min(0),
})

const createBillSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.enum(['AA', 'ADVANCE', 'GOODS']),
  totalAmount: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().max(500).optional(),
  groupId: z.string(),
  participants: z.array(participantSchema).min(1),
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

  const { participants, ...billData } = parsed.data

  const bill = await prisma.bill.create({
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

  return NextResponse.json({ bill }, { status: 201 })
}
```

**Step 6: 创建账单详情/更新/删除接口 app/api/bills/[id]/route.ts**

```typescript
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
```

**Step 7: Commit**

```bash
git add app/api/bills/ lib/balance.ts __tests__/
git commit -m "feat: add bill CRUD API and balance calculation logic"
```

---

### Task 12：账单列表页

**Files:**
- Create: `app/(main)/bills/page.tsx`
- Create: `components/shared/bill-card.tsx`

**Step 1: 创建账单卡片组件 components/shared/bill-card.tsx**

```typescript
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Receipt, ShoppingBag, CreditCard } from 'lucide-react'

const billTypeConfig = {
  AA: { label: 'AA', icon: Receipt, color: 'bg-blue-100 text-blue-700' },
  ADVANCE: { label: '垫付', icon: CreditCard, color: 'bg-orange-100 text-orange-700' },
  GOODS: { label: '周边', icon: ShoppingBag, color: 'bg-purple-100 text-purple-700' },
}

interface BillCardProps {
  bill: {
    id: string
    title: string
    type: 'AA' | 'ADVANCE' | 'GOODS'
    totalAmount: string | number
    date: string
    participants: { user: { id: string; username: string; avatarUrl?: string | null } }[]
  }
}

export function BillCard({ bill }: BillCardProps) {
  const config = billTypeConfig[bill.type]
  const Icon = config.icon

  return (
    <Link href={`/bills/${bill.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 truncate">{bill.title}</p>
            <p className="text-sm text-slate-500">{formatDate(bill.date)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-slate-900">{formatCurrency(Number(bill.totalAmount))}</p>
            <div className="flex -space-x-1 justify-end mt-1">
              {bill.participants.slice(0, 3).map((p) => (
                <Avatar key={p.user.id} className="h-5 w-5 border border-white">
                  <AvatarFallback className="text-xs">{p.user.username[0]}</AvatarFallback>
                </Avatar>
              ))}
              {bill.participants.length > 3 && (
                <span className="text-xs text-slate-400 ml-1">+{bill.participants.length - 3}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

**Step 2: 创建账单列表页 app/(main)/bills/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BillCard } from '@/components/shared/bill-card'
import { Plus } from 'lucide-react'
import Link from 'next/link'

const tabs = [
  { value: '', label: '全部' },
  { value: 'AA', label: 'AA' },
  { value: 'ADVANCE', label: '垫付' },
  { value: 'GOODS', label: '周边' },
]

export default function BillsPage() {
  const [activeTab, setActiveTab] = useState('')
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupId, setGroupId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId)
      })
  }, [])

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (activeTab) params.set('type', activeTab)

    fetch(`/api/bills?${params}`)
      .then((r) => r.json())
      .then((d) => { setBills(d.bills ?? []); setLoading(false) })
  }, [groupId, activeTab])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">账单</h1>
        <Button asChild size="sm">
          <Link href="/bills/new"><Plus className="h-4 w-4 mr-1" />新建</Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p>还没有账单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/\(main\)/bills/ components/shared/bill-card.tsx
git commit -m "feat: add bill list page with type filter tabs"
```

---

### Task 13：新建账单页（AA + 垫付）

**Files:**
- Create: `app/(main)/bills/new/page.tsx`
- Create: `components/shared/create-bill-form.tsx`

**Step 1: 创建新建账单表单 components/shared/create-bill-form.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Member {
  id: string
  username: string
}

export function CreateBillForm({ groupId, members, currentUserId }: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [type, setType] = useState<'AA' | 'ADVANCE' | 'GOODS'>('AA')
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([currentUserId])
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    const amount = parseFloat(totalAmount)
    const perPerson = amount / selectedMembers.length

    const participants = selectedMembers.map((userId) => ({
      userId,
      paidAmount: userId === paidBy ? amount : 0,
      shouldPayAmount: perPerson,
    }))

    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, type, totalAmount: amount,
          date: new Date(date).toISOString(),
          description: description || undefined,
          groupId, participants,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '创建失败'); return }
      router.push('/bills')
      router.refresh()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: 类型和基本信息 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>账单类型</Label>
            <div className="flex gap-2">
              {(['AA', 'ADVANCE', 'GOODS'] as const).map((t) => (
                <Button
                  key={t}
                  variant={type === t ? 'default' : 'outline'}
                  onClick={() => setType(t)}
                  className="flex-1"
                >
                  {t === 'AA' ? 'AA 均摊' : t === 'ADVANCE' ? '垫付' : '周边拼单'}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>账单标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：火锅聚餐" />
          </div>
          <div className="space-y-2">
            <Label>总金额（元）</Label>
            <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>日期</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>备注（可选）</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可以不填" />
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={!title || !totalAmount}>
            下一步
          </Button>
        </div>
      )}

      {/* Step 2: 参与人 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>参与人（{selectedMembers.length} 人）</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Badge
                  key={m.id}
                  variant={selectedMembers.includes(m.id) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleMember(m.id)}
                >
                  {m.username}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>谁付的款</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.filter((m) => selectedMembers.includes(m.id)).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMembers.length > 0 && (
            <Card className="bg-slate-50">
              <CardContent className="p-3 text-sm text-slate-600">
                每人应付：<strong>¥{(parseFloat(totalAmount || '0') / selectedMembers.length).toFixed(2)}</strong>
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">上一步</Button>
            <Button onClick={handleSubmit} disabled={loading || selectedMembers.length === 0} className="flex-1">
              {loading ? '创建中...' : '确认创建'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: 创建新建账单页 app/(main)/bills/new/page.tsx**

```typescript
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { CreateBillForm } from '@/components/shared/create-bill-form'

export default async function NewBillPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const userWithGroups = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      groups: {
        include: {
          group: {
            include: {
              members: {
                include: { user: { select: { id: true, username: true } } },
              },
            },
          },
        },
      },
    },
  })

  const firstGroup = userWithGroups?.groups[0]?.group
  if (!firstGroup) redirect('/dashboard')

  const members = firstGroup.members.map((m) => m.user)

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">新建账单</h1>
      <CreateBillForm
        groupId={firstGroup.id}
        members={members}
        currentUserId={session.userId}
      />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/\(main\)/bills/new/ components/shared/create-bill-form.tsx
git commit -m "feat: add create bill form with AA and advance support"
```

---

### Task 14：账单详情页

**Files:**
- Create: `app/(main)/bills/[id]/page.tsx`

**Step 1: 创建账单详情页 app/(main)/bills/[id]/page.tsx**

```typescript
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'

const typeLabels = { AA: 'AA 均摊', ADVANCE: '垫付', GOODS: '周边拼单' }

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true } } },
      },
      goods: true,
      createdBy: { select: { username: true } },
    },
  })

  if (!bill) notFound()

  const isMember = bill.participants.some((p) => p.userId === session.userId)
  if (!isMember) redirect('/bills')

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">{bill.title}</h1>
        <Badge variant="outline">{typeLabels[bill.type]}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">总金额</span>
            <span className="font-semibold text-lg">{formatCurrency(Number(bill.totalAmount))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">日期</span>
            <span>{formatDate(bill.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">创建者</span>
            <span>{bill.createdBy.username}</span>
          </div>
          {bill.description && (
            <div className="flex justify-between">
              <span className="text-slate-500">备注</span>
              <span>{bill.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">参与人（{bill.participants.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bill.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{p.user.username[0]}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">{p.user.username}</span>
              <div className="text-right text-sm">
                <p className="text-slate-500">应付 {formatCurrency(Number(p.shouldPayAmount))}</p>
                {Number(p.paidAmount) > 0 && (
                  <p className="text-green-600">已付 {formatCurrency(Number(p.paidAmount))}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {bill.goods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">周边明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bill.goods.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.characterName && <p className="text-slate-400">{item.characterName}</p>}
                </div>
                <div className="text-right">
                  <p>{formatCurrency(Number(item.unitPrice))} × {item.quantity}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/\(main\)/bills/\[id\]/
git commit -m "feat: add bill detail page"
```

---

## Phase 5：结算中心

### Task 15：结算 API

**Files:**
- Create: `app/api/settlements/route.ts`
- Create: `app/api/balances/route.ts`

**Step 1: 创建结算接口 app/api/settlements/route.ts**

```typescript
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
```

**Step 2: 创建余额计算接口 app/api/balances/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { calculatePairBalance } from '@/lib/balance'

// GET /api/balances?groupId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId 必填' }, { status: 400 })

  const [bills, settlements, members] = await Promise.all([
    prisma.bill.findMany({
      where: { groupId },
      include: { participants: true },
    }),
    prisma.settlement.findMany({ where: { groupId } }),
    prisma.userGroup.findMany({
      where: { groupId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    }),
  ])

  // 汇总所有账单的参与记录
  const allParticipants = bills.flatMap((b) =>
    b.participants.map((p) => ({
      userId: p.userId,
      paidAmount: p.paidAmount.toString(),
      shouldPayAmount: p.shouldPayAmount.toString(),
    }))
  )

  const settlementRecords = settlements.map((s) => ({
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount.toString(),
  }))

  const balanceMap = calculatePairBalance({
    userId: session.userId,
    participants: allParticipants,
    settlements: settlementRecords,
  })

  const balances = members
    .filter((m) => m.userId !== session.userId)
    .map((m) => ({
      user: m.user,
      netAmount: balanceMap.get(m.userId) ?? 0,
    }))

  return NextResponse.json({ balances })
}
```

**Step 3: Commit**

```bash
git add app/api/settlements/ app/api/balances/
git commit -m "feat: add settlement and balance API routes"
```

---

### Task 16：结算中心页面

**Files:**
- Create: `app/(main)/settlements/page.tsx`

**Step 1: 创建结算中心页 app/(main)/settlements/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'

interface Balance {
  user: { id: string; username: string }
  netAmount: number
}

export default function SettlementsPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settleTarget, setSettleTarget] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId)
      })
  }, [])

  function loadBalances(gId: string) {
    setLoading(true)
    fetch(`/api/balances?groupId=${gId}`)
      .then((r) => r.json())
      .then((d) => { setBalances(d.balances ?? []); setLoading(false) })
  }

  useEffect(() => {
    if (groupId) loadBalances(groupId)
  }, [groupId])

  async function handleSettle(type: 'MARK_CLEARED' | 'PAYMENT_RECORD') {
    if (!settleTarget || !groupId) return
    setSettling(true)
    const settlementAmount = type === 'MARK_CLEARED'
      ? Math.abs(settleTarget.netAmount)
      : parseFloat(amount)

    await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        toUserId: settleTarget.user.id,
        amount: settlementAmount,
        note: note || undefined,
        type,
      }),
    })

    setSettleTarget(null)
    setAmount('')
    setNote('')
    setSettling(false)
    loadBalances(groupId)
  }

  const iOwe = balances.filter((b) => b.netAmount < 0)
  const theyOwe = balances.filter((b) => b.netAmount > 0)
  const balanced = balances.filter((b) => Math.abs(b.netAmount) < 0.01)

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">结算中心</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          {iOwe.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-500 mb-2">我欠别人</p>
              <div className="space-y-2">
                {iOwe.map((b) => (
                  <BalanceRow key={b.user.id} balance={b} onSettle={() => setSettleTarget(b)} />
                ))}
              </div>
            </div>
          )}
          {theyOwe.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-500 mb-2">别人欠我</p>
              <div className="space-y-2">
                {theyOwe.map((b) => (
                  <BalanceRow key={b.user.id} balance={b} onSettle={() => setSettleTarget(b)} />
                ))}
              </div>
            </div>
          )}
          {balanced.length > 0 && iOwe.length === 0 && theyOwe.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-2">✅</p>
              <p>全部结清啦</p>
            </div>
          )}
        </>
      )}

      <Dialog open={!!settleTarget} onOpenChange={() => setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>与 {settleTarget?.user.username} 结算</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              当前余额：<strong>{formatCurrency(Math.abs(settleTarget?.netAmount ?? 0))}</strong>
              {(settleTarget?.netAmount ?? 0) < 0 ? '（我欠对方）' : '（对方欠我）'}
            </p>
            <div className="space-y-2">
              <Label>还款金额（留空则全额结清）</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${Math.abs(settleTarget?.netAmount ?? 0).toFixed(2)}`}
              />
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="转账备注" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleSettle('MARK_CLEARED')} disabled={settling}>
              标记结清
            </Button>
            <Button onClick={() => handleSettle('PAYMENT_RECORD')} disabled={settling || !amount}>
              录入还款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BalanceRow({ balance, onSettle }: { balance: Balance; onSettle: () => void }) {
  const isNegative = balance.netAmount < 0
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{balance.user.username[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-medium">{balance.user.username}</p>
          <p className={`text-sm ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
            {isNegative ? '我欠' : '欠我'} {formatCurrency(Math.abs(balance.netAmount))}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onSettle}>结算</Button>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add app/\(main\)/settlements/
git commit -m "feat: add settlements center page with balance display"
```

---

## Phase 6：动漫周边

### Task 17：周边记录页

**Files:**
- Create: `app/(main)/goods/page.tsx`
- Create: `app/api/goods/route.ts`
- Create: `app/api/upload/route.ts`（图片上传）

**Step 1: 创建周边列表接口 app/api/goods/route.ts**

```typescript
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
```

**Step 2: 创建图片上传接口 app/api/upload/route.ts**

```typescript
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
```

**Step 3: 安装 Vercel Blob**

```bash
npm install @vercel/blob
```

**Step 4: 创建周边列表页 app/(main)/goods/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import Image from 'next/image'
import { Search } from 'lucide-react'

export default function GoodsPage() {
  const [goods, setGoods] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId) })
  }, [])

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (search) params.set('character', search)
    fetch(`/api/goods?${params}`)
      .then((r) => r.json())
      .then((d) => { setGoods(d.goods ?? []); setLoading(false) })
  }, [groupId, search])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">周边记录</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索角色名..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : goods.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🎁</p>
          <p>还没有周边记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {goods.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.imageUrl && (
                <div className="relative h-32 bg-slate-100">
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                </div>
              )}
              <CardContent className="p-3 space-y-1">
                <p className="font-medium text-sm truncate">{item.name}</p>
                {item.characterName && (
                  <Badge variant="secondary" className="text-xs">{item.characterName}</Badge>
                )}
                <p className="text-xs text-slate-500">
                  {formatCurrency(Number(item.unitPrice))} × {item.quantity}
                </p>
                <p className="text-xs text-slate-400">{formatDate(item.bill.date)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add app/\(main\)/goods/ app/api/goods/ app/api/upload/
git commit -m "feat: add goods listing page and image upload API"
```

---

## Phase 7：统计报表

### Task 18：统计 API + 页面

**Files:**
- Create: `app/api/stats/route.ts`
- Create: `app/(main)/stats/page.tsx`

**Step 1: 创建统计接口 app/api/stats/route.ts**

```typescript
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
```

**Step 2: 创建统计页 app/(main)/stats/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#4F6AF5', '#f97316', '#a855f7']
const PRESETS = [
  { label: '本月', getValue: () => {
    const now = new Date()
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
  }},
  { label: '本年', getValue: () => {
    const now = new Date()
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    }
  }},
]

export default function StatsPage() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId) })
  }, [])

  function loadStats() {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })
  }

  useEffect(() => { if (groupId) loadStats() }, [groupId])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">统计</h1>

      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => {
            const { from: f, to: t } = p.getValue()
            setFrom(f); setTo(t)
          }}>
            {p.label}
          </Button>
        ))}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        <span className="self-center text-slate-400">—</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        <Button size="sm" onClick={loadStats}>查询</Button>
      </div>

      {loading && <p className="text-slate-500 text-sm">加载中...</p>}

      {stats && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '我的支出', value: stats.totalShouldPay, color: 'text-slate-900' },
              { label: '我的垫付', value: stats.totalAdvanced, color: 'text-blue-600' },
              { label: '实付总计', value: stats.totalPaid, color: 'text-green-600' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.color}`}>{formatCurrency(item.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.byType.some((t: any) => t.value > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">账单类型分布</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.byType.filter((t: any) => t.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {stats.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {stats.byCharacter.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">周边花费（按角色）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.byCharacter.slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/api/stats/ app/\(main\)/stats/
git commit -m "feat: add stats API and report page with charts"
```

---

## Phase 8：个人中心 + 圈子管理

### Task 19：个人中心 + 圈子页面

**Files:**
- Create: `app/(main)/profile/page.tsx`
- Create: `app/(main)/group/[id]/page.tsx`

**Step 1: 创建个人中心页 app/(main)/profile/page.tsx**

```typescript
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/shared/logout-button'
import Link from 'next/link'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      groups: {
        include: {
          group: { include: { _count: { select: { members: true } } } },
        },
      },
    },
  })

  if (!user) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{user.username[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-bold">{user.username}</p>
            <p className="text-slate-500 text-sm">加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">我的圈子</CardTitle></CardHeader>
        <CardContent className="p-0">
          {user.groups.map((ug) => (
            <Link key={ug.groupId} href={`/group/${ug.groupId}`} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-medium">{ug.group.name}</p>
                <p className="text-xs text-slate-500">{ug.group._count.members} 位成员</p>
              </div>
              <span className="text-xs text-slate-400">{ug.role === 'OWNER' ? '管理员' : '成员'} →</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  )
}
```

**Step 2: 创建退出登录按钮组件 components/shared/logout-button.tsx**

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50" onClick={handleLogout}>
      退出登录
    </Button>
  )
}
```

**Step 3: 创建圈子管理页 app/(main)/group/[id]/page.tsx**

```typescript
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { InviteCodeSection } from '@/components/shared/invite-code-section'
import { formatDate } from '@/lib/utils'

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!group) notFound()

  const myMembership = group.members.find((m) => m.userId === session.userId)
  if (!myMembership) redirect('/profile')

  const isOwner = myMembership.role === 'OWNER'

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">{group.name}</h1>
        {group.description && <p className="text-slate-500 text-sm mt-1">{group.description}</p>}
      </div>

      {isOwner && <InviteCodeSection groupId={id} inviteCode={group.inviteCode} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">成员（{group.members.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{m.user.username[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.user.username}</p>
                <p className="text-xs text-slate-400">加入于 {formatDate(m.joinedAt)}</p>
              </div>
              {m.role === 'OWNER' && <Badge variant="secondary">管理员</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 4: 创建邀请码展示组件 components/shared/invite-code-section.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw } from 'lucide-react'

export function InviteCodeSection({ groupId, inviteCode: initial }: { groupId: string; inviteCode: string }) {
  const [code, setCode] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function refreshCode() {
    setRefreshing(true)
    const res = await fetch(`/api/groups/${groupId}/invite`, { method: 'POST' })
    const data = await res.json()
    if (data.inviteCode) setCode(data.inviteCode)
    setRefreshing(false)
  }

  return (
    <Card className="border-blue-100 bg-blue-50">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">邀请码</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0 flex items-center gap-2">
        <code className="flex-1 font-mono text-sm bg-white px-3 py-2 rounded-lg border truncate">{code}</code>
        <Button size="icon" variant="outline" onClick={copyCode}><Copy className="h-4 w-4" />{copied && <span className="sr-only">已复制</span>}</Button>
        <Button size="icon" variant="outline" onClick={refreshCode} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button>
      </CardContent>
    </Card>
  )
}
```

**Step 5: Commit**

```bash
git add app/\(main\)/profile/ app/\(main\)/group/ components/shared/
git commit -m "feat: add profile page, group management, and invite code UI"
```

---

## Phase 9：Dashboard 完善

### Task 20：完善首页

**Files:**
- Modify: `app/(main)/dashboard/page.tsx`

**Step 1: 更新 Dashboard 展示余额概览和最近账单**

```typescript
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { BillCard } from '@/components/shared/bill-card'
import { formatCurrency } from '@/lib/utils'
import { calculatePairBalance } from '@/lib/balance'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { groups: { include: { group: true } } },
  })

  const firstGroup = user?.groups[0]?.group
  if (!firstGroup) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">你好，{session.username}</h1>
        <p className="text-slate-500">你还没有加入任何圈子，请联系朋友获取邀请码。</p>
      </div>
    )
  }

  const [bills, settlements] = await Promise.all([
    prisma.bill.findMany({
      where: { groupId: firstGroup.id, participants: { some: { userId: session.userId } } },
      include: {
        participants: { include: { user: { select: { id: true, username: true } } } },
        goods: true,
      },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    prisma.settlement.findMany({
      where: { groupId: firstGroup.id, OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] },
    }),
  ])

  const allParticipants = (await prisma.bill.findMany({
    where: { groupId: firstGroup.id },
    include: { participants: true },
  })).flatMap((b) => b.participants.map((p) => ({
    userId: p.userId,
    paidAmount: p.paidAmount.toString(),
    shouldPayAmount: p.shouldPayAmount.toString(),
  })))

  const balanceMap = calculatePairBalance({
    userId: session.userId,
    participants: allParticipants,
    settlements: settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount.toString(),
    })),
  })

  const totalIOwe = Array.from(balanceMap.values()).filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0)
  const totalOwedToMe = Array.from(balanceMap.values()).filter((v) => v > 0).reduce((s, v) => s + v, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">你好，{session.username} 👋</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <p className="text-xs text-red-500 mb-1">我欠别人</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalIOwe)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 mb-1">别人欠我</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalOwedToMe)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">最近账单</h2>
        {bills.length === 0 ? (
          <p className="text-slate-400 text-sm">还没有账单</p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/\(main\)/dashboard/
git commit -m "feat: complete dashboard with balance overview and recent bills"
```

---

## Phase 10：首次运行初始化

### Task 21：创建初始圈子种子数据脚本

**Files:**
- Create: `prisma/seed.ts`

**Step 1: 创建种子脚本 prisma/seed.ts**（用于首次部署后创建第一个圈子）

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建初始圈子
  const group = await prisma.group.upsert({
    where: { inviteCode: 'initial-invite-code' },
    update: {},
    create: {
      name: '我们的小圈子',
      description: '第一个圈子',
      inviteCode: 'initial-invite-code',
      createdBy: 'admin',
    },
  })

  console.log('✅ 初始圈子已创建')
  console.log('邀请码：', group.inviteCode)
  console.log('圈子 ID：', group.id)
  console.log('把邀请码分享给朋友，让他们注册！')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 2: 在 package.json 中添加 seed 命令**

在 `prisma` 字段下添加：
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

并安装 ts-node：

```bash
npm install -D ts-node
```

**Step 3: 运行种子**

```bash
npx prisma db seed
```

Expected: `✅ 初始圈子已创建` 并打印邀请码

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "chore: add prisma seed script for initial group creation"
```

---

## Phase 11：生产部署

### Task 22：Vercel 部署

**Files:**
- Create: `vercel.json`（可选，如需特殊配置）

**Step 1: 在 GitHub 上创建仓库并推送代码**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

**Step 2: 在 Neon 创建数据库**

1. 访问 [neon.tech](https://neon.tech)，注册并创建项目 `goods-helper`
2. 复制 Connection String（格式：`postgresql://user:pass@host/dbname?sslmode=require`）

**Step 3: 在 Vercel 导入项目**

1. 访问 [vercel.com](https://vercel.com)，选择 Import Git Repository
2. 选择 `goods-helper` 仓库
3. 在 Environment Variables 中添加：
   - `DATABASE_URL` = Neon 连接串
   - `JWT_SECRET` = 随机32位字符串（可用 `openssl rand -hex 32` 生成）
   - `BLOB_READ_WRITE_TOKEN` = Vercel Blob token（在 Vercel Storage 中创建）

**Step 4: 运行生产数据库迁移**

```bash
# 使用 Neon 的连接串在本地运行迁移
DATABASE_URL="<neon-connection-string>" npx prisma migrate deploy
DATABASE_URL="<neon-connection-string>" npx prisma db seed
```

**Step 5: 验证部署**

访问 Vercel 分配的域名，确认：
- 登录页正常显示
- 使用种子创建的邀请码 `initial-invite-code` 可以注册
- 注册后可以进入 Dashboard

**Step 6: 修改默认邀请码**

登录后进入圈子设置，刷新邀请码为随机码，禁用 `initial-invite-code`。

---

## 执行顺序总结

| Phase | Tasks | 重要性 |
|-------|-------|--------|
| 基础设施 | 1-4 | P0，必须先完成 |
| 认证 | 5-9 | P0，所有功能前提 |
| 圈子 API | 10 | P0 |
| 账单 | 11-14 | P0，核心功能 |
| 结算 | 15-16 | P0，核心功能 |
| 周边 | 17 | P1 |
| 统计 | 18 | P1 |
| 个人中心 | 19-20 | P1 |
| 首次初始化 | 21 | P0，部署必须 |
| 生产部署 | 22 | P0 |
