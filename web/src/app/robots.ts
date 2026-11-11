import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { isProduction } from '@/lib/deploy-env';
export default function robots(): MetadataRoute.Robots {
  const prod = isProduction();
  // Query-string variants (?brand=, ?page=, ?sort=, ?r=...) all canonicalise to the clean URL and render on demand; crawling
  // them only adds uncached origin renders (P0 11 Nov 2026). Clean pages and every car page stay crawlable (sitemap).
  return { rules: prod ? [{ userAgent: '*', allow: ['/', '/_next/image'], disallow: ['/api/', '/admin', '/*?'] }] : [{ userAgent: '*', disallow: '/' }], sitemap: prod ? `${SITE_URL}/sitemap.xml` : undefined };
}
