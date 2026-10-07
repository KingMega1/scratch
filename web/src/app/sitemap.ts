import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';

const STATIC = ['', '/cars', '/market', '/market/catalog', '/compare', '/news', '/find-my-car', '/methodology', '/independence', '/about', '/contact'];
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...STATIC, ...vehicles().all().map(c => `/cars/${c.id}`)];
  return paths.map(p => ({
    url: `${SITE_URL}/ar${p}`,
    alternates: { languages: { ar: `${SITE_URL}/ar${p}`, en: `${SITE_URL}/en${p}` } },
  }));
}
