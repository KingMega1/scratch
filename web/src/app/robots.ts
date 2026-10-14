import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { isProduction } from '@/lib/deploy-env';
export default function robots(): MetadataRoute.Robots {
  const prod = isProduction();
  return { rules: prod ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }] : [{ userAgent: '*', disallow: '/' }], sitemap: prod ? `${SITE_URL}/sitemap.xml` : undefined };
}
