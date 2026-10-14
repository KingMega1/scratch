import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['ar', 'en'];
const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|webp|ico|ttf|woff2?|txt|xml|json)$/i;

/* Compare fixed-size SHA-256 digests: work does not depend on matching credential prefixes. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  const aa = new Uint8Array(x), bb = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
async function basicAuthOk(header: string, user: string, pass: string): Promise<boolean> {
  if (!header.startsWith('Basic ')) return false;
  let decoded: string;
  try { decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6).trim()), c => c.charCodeAt(0))); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const [userOk, passOk] = await Promise.all([safeEqual(decoded.slice(0, i), user), safeEqual(decoded.slice(i + 1), pass)]);
  return userOk && passOk;
}

/* 1) Locale routing: every page lives under /ar or /en (server-rendered lang/dir; no client-side flip).
   2) /admin is never public: without configured credentials it does not exist (404); with them, Basic auth. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const user = process.env.ADMIN_BASIC_AUTH_USER, pass = process.env.ADMIN_BASIC_AUTH_PASS;
    if (!user || !pass) return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    if (!await basicAuthOk(req.headers.get('authorization') || '', user, pass)) return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="carindex-admin"', 'X-Robots-Tag': 'noindex' } });
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
