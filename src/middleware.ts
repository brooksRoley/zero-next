import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('tracker_session')?.value
  const secret = process.env.ADMIN_SESSION_TOKEN

  if (!secret || session !== secret) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tracker', '/tracker/:path*', '/admin/analytics'],
}
