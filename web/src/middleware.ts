import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['ar', 'en'];
const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|webp|ico|ttf|woff2?|txt|xml|json)$/i;

/* Length-independent comparison so response timing does not reveal how much of a credential matched. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function basicAuthOk(header: string, user: string, pass: string): boolean {
  if (!header.startsWith('Basic ')) return false;
  let decoded: string;
  try { decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6).trim()), c => c.charCodeAt(0))); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const userOk = safeEqual(decoded.slice(0, i), user), passOk = safeEqual(decoded.slice(i + 1), pass);
  return userOk && passOk;
}

/* 1) Locale routing: every page lives under /ar or /en (server-rendered lang/dir; no client-side flip).
   2) /admin is never public: without configured credentials it does not exist (404); with them, Basic auth. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const user = process.env.ADMIN_BASIC_AUTH_USER, pass = process.env.ADMIN_BASIC_AUTH_PASS;
    if (!user || !pass) return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    if (!basicAuthOk(req.headers.get('authorization') || '', user, pass)) return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="carindex-admin"', 'X-Robots-Tag': 'noindex' } });
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
