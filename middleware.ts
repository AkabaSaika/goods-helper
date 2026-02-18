import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const AUTH_PAGE_PATHS = ['/login', '/register']
const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 允许静态资源
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // 允许认证 API 直接通过
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('auth-token')?.value
  const payload = token ? await verifyToken(token) : null

  // 已登录用户访问登录/注册页时重定向到首页
  if (AUTH_PAGE_PATHS.some((p) => pathname.startsWith(p))) {
    if (payload) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // 未登录访问受保护页面
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', req.url))
    if (token) response.cookies.delete('auth-token') // 清除过期/无效 token
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
