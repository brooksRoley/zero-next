import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { safeEqual } from 'src/lib/safeEqual'

export function proxy(request: NextRequest) {
  const session = request.cookies.get('tracker_session')?.value
  const secret = process.env.ADMIN_SESSION_TOKEN

  if (!secret || !safeEqual(session, secret)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/tracker',
    '/tracker/:path*',
    '/admin',
    '/admin/:path*',
    // Unfinished pages stay private until they work (see CLAUDE.md, Hiring Readiness).
    '/zero-paradox',
    '/education-tracker',
    '/digital-products',
  ],
}
