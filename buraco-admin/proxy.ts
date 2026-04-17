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
  // Exclude all Next.js internals and static assets; run only on real page routes
  matcher: ['/((?!_next|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.ico).*)'],
};
