import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { LOCALES } from '@/lib/i18n/config';
import { vehicles } from '@/server/vehicles/read-model';

const STATIC = ['', '/cars', '/market', '/market/catalog', '/compare', '/news', '/methodology', '/independence', '/about', '/contact'];
/* Every indexable URL in both locales, each with its ar/en/x-default alternates (hreflang must be reciprocal).
   Noindex pages (search, account, privacy/terms, drafts, Find My Car) are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...STATIC, ...vehicles().all().map(c => `/cars/${c.id}`)];
  return paths.flatMap(p => LOCALES.map(l => ({
    url: `${SITE_URL}/${l}${p}`,
    alternates: { languages: { ar: `${SITE_URL}/ar${p}`, en: `${SITE_URL}/en${p}`, 'x-default': `${SITE_URL}/ar${p}` } },
  })));
}
