import type { Metadata } from 'next';
import type { Locale } from './i18n/config';
import { dict } from './i18n/dictionaries';
import { isProduction, siteUrl } from './deploy-env';

export const SITE_URL = siteUrl();

/* Canonical + hreflang for a locale-agnostic path ("" for home, "/cars/nissan/sunny" etc.). */
export function pageMeta(locale: Locale, path: string, title: string, description?: string, opts: { noindex?: boolean; image?: string; article?: { publishedTime: string | null } } = {}): Metadata {
  const t = dict(locale);
  const full = `${title} | ${t.brand}`;
  return {
    title: full,
    description: description ?? t.home.lede,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ar: `/ar${path}`, en: `/en${path}`, 'x-default': `/ar${path}` },
    },
    openGraph: { title: full, description: description ?? t.home.lede, locale: locale === 'ar' ? 'ar_EG' : 'en_US', siteName: t.brand, type: opts.article ? 'article' : 'website', url: `/${locale}${path}`,
      ...(opts.image ? { images: [{ url: opts.image, width: 1080, height: 1350 }] } : {}),
      ...(opts.article?.publishedTime ? { publishedTime: opts.article.publishedTime } : {}) },
    ...(opts.image ? { twitter: { card: 'summary_large_image' as const, title: full, description: description ?? t.home.lede, images: [opts.image] } } : {}),
    robots: opts.noindex || !isProduction() ? { index: false, follow: !opts.noindex } : undefined,
  };
}
