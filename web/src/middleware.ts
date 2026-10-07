import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['ar', 'en'];
const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|webp|ico|ttf|woff2?|txt|xml|json)$/i;

/* 1) Locale routing: every page lives under /ar or /en (server-rendered lang/dir; no client-side flip).
   2) /admin is never public: without configured credentials it does not exist (404); with them, Basic auth. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const user = process.env.ADMIN_BASIC_AUTH_USER, pass = process.env.ADMIN_BASIC_AUTH_PASS;
    if (!user || !pass) return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    const auth = req.headers.get('authorization') || '';
    const expected = 'Basic ' + btoa(`${user}:${pass}`);
    if (auth !== expected) return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="carindex-admin"', 'X-Robots-Tag': 'noindex' } });
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || PUBLIC_FILE.test(pathname)) return NextResponse.next();

  const seg = pathname.split('/')[1];
  if (LOCALES.includes(seg)) return NextResponse.next();

  const pref = req.cookies.get('ci_locale')?.value;
  const locale = pref && LOCALES.includes(pref) ? pref : 'ar'; // Arabic-first
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
