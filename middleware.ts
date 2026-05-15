import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const ROLE_ROUTES: Record<string, string[]> = {
  '/customer': ['customer', 'admin'],
  '/expert':   ['expert',   'admin'],
  '/admin':    ['admin'],
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = (session.user as any)?.role ?? 'customer'

  for (const [prefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix) && !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/customer/:path*', '/expert/:path*', '/admin/:path*'],
}
