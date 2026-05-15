import { NextResponse, type NextRequest } from 'next/server'

const ROLE_ROUTES: Record<string, string[]> = {
  '/customer': ['customer', 'admin'],
  '/expert':   ['expert',   'admin'],
  '/admin':    ['admin'],
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check for the Better Auth session cookie
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role enforcement happens inside each protected layout/page
  // Middleware only gates unauthenticated users here
  return NextResponse.next()
}

export const config = {
  matcher: ['/customer/:path*', '/expert/:path*', '/admin/:path*'],
}
