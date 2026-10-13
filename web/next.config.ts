import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// S1 CSP baseline. Scripts: self + Next inline bootstrap (unsafe-inline until nonce rollout in S3).
// Images: self only (verified model photos are served from /media/models; see data/registry/media-verified.json).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
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
  // ~10 KB of CSS: inline it in <head> so first paint is not blocked on a stylesheet round trip (Lighthouse render-blocking).
  experimental: { inlineCss: true },
  // Same-origin optimizer for /media and /brand photos only (no remote hosts). AVIF/WebP negotiated per browser.
  images: { formats: ['image/avif', 'image/webp'], localPatterns: [{ pathname: '/media/**' }, { pathname: '/brand/**' }], minimumCacheTTL: 86400 },
  // P1 release (P1-RELEASE-T1) is loaded from disk at runtime and hash-verified; ship the vendored files with the functions that use it.
  outputFileTracingIncludes: {
    '/api/v1/recommendation': ['./p1-release/**/*'],
    '/[locale]/find-my-car': ['./p1-release/**/*'],
    '/admin': ['./p1-release/**/*'],
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
