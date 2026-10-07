import type { Metadata } from 'next';
import type { Locale } from './i18n/config';
import { dict } from './i18n/dictionaries';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/* Canonical + hreflang for a locale-agnostic path ("" for home, "/cars/nissan/sunny" etc.). */
export function pageMeta(locale: Locale, path: string, title: string, description?: string, opts: { noindex?: boolean } = {}): Metadata {
  const t = dict(locale);
  const full = `${title} | ${t.brand}`;
  return {
    title: full,
    description: description ?? t.home.lede,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ar: `/ar${path}`, en: `/en${path}`, 'x-default': `/ar${path}` },
    },
    openGraph: { title: full, description: description ?? t.home.lede, locale: locale === 'ar' ? 'ar_EG' : 'en_US', siteName: t.brand, type: 'website', url: `/${locale}${path}` },
    robots: opts.noindex || process.env.CI_ENV !== 'production' ? { index: false, follow: !opts.noindex } : undefined,
  };
}
