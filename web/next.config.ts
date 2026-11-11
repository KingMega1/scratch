import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// S1 CSP baseline. Scripts: self + Next inline bootstrap (unsafe-inline until nonce rollout in S3).
// Images: self only (verified model photos are served from /media/models; see data/registry/media-verified.json).
// Google Tag Manager + GA4 hosts (Google's documented CSP for GTM); GTM itself loads on production only.
const GTM_SCRIPT = 'https://www.googletagmanager.com';
const GA_HOSTS = 'https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GTM_SCRIPT}${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: ${GA_HOSTS}`,
  "font-src 'self'",
  `connect-src 'self' ${GA_HOSTS}`,
  `frame-src ${GTM_SCRIPT}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // CSS is NOT inlined (P0 11 Nov 2026): inlining copied the whole ~46 KB stylesheet into every HTML response, i.e. every
  // origin render and every ISR read. As one hashed /_next/static file it is cached immutably by the CDN instead.
  // Same-origin optimizer for /media and /brand photos only (no remote hosts). AVIF/WebP negotiated per browser.
  // AVIF (smallest bytes; browsers that support it only ask for AVIF) then WebP; optimised images cached 7 days, not 1.
  images: { formats: ['image/avif', 'image/webp'], localPatterns: [{ pathname: '/media/**' }, { pathname: '/brand/**' }], minimumCacheTTL: 604800 },
  // P1 release (P1-RELEASE-T1) is loaded from disk at runtime and hash-verified; ship the vendored files with the functions that use it.
  outputFileTracingIncludes: {
    '/api/v1/recommendation': ['./p1-release/**/*', './p1-accepted/U12-CEO3-R5/**/*'],
    '/[locale]/find-my-car': ['./p1-release/**/*', './p1-accepted/U12-CEO3-R5/**/*'],
    '/admin': ['./p1-release/**/*', './p1-accepted/U12-CEO3-R5/**/*'],
  },
  // The LX is named "LX" (CEO decision, P1 R5) but its page keeps the identity slug lexus-lx600.
  async redirects() {
    return [{ source: '/:locale(en|ar)/cars/lexus-lx', destination: '/:locale/cars/lexus-lx600', permanent: true }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/fonts/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      // Model photos keep stable names (P2 may replace a file in place): cache a day, revalidate in the background.
      { source: '/media/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      { source: '/brand/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ];
  },
};

export default config;
