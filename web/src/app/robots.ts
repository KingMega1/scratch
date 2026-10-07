import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
export default function robots(): MetadataRoute.Robots {
  const prod = process.env.CI_ENV === 'production';
  return { rules: prod ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }] : [{ userAgent: '*', disallow: '/' }], sitemap: prod ? `${SITE_URL}/sitemap.xml` : undefined };
}
