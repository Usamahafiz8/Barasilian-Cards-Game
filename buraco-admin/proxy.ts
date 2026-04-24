import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token        = req.cookies.get('admin_token')?.value;
  const isPublic     = PUBLIC.some((p) => pathname.startsWith(p));

  if (!isPublic && !token) return NextResponse.redirect(new URL('/login', req.url));
  if (isPublic  &&  token) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  // Exclude Next.js internals, static assets, and API proxy routes
  matcher: ['/((?!_next|api/|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.ico).*)'],
};
