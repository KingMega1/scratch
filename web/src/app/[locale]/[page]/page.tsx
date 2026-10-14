import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';

const PAGES = ['methodology', 'independence', 'about', 'contact', 'privacy', 'terms'] as const;
type Slug = (typeof PAGES)[number];
type P = { params: Promise<{ locale: string; page: string }> };

export function generateStaticParams() { return LOCALES.flatMap(locale => PAGES.map(page => ({ locale, page }))); }
export const dynamicParams = true; // unknown slugs -> notFound() below (avoids NoFallbackError log noise)

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isLocale(locale) || !PAGES.includes(page as Slug)) return {};
  const [title, body] = dict(locale).pages[page as Slug];
  return pageMeta(locale, `/${page}`, title, body.slice(0, 150), { noindex: page === 'privacy' || page === 'terms' });
}

export default async function StaticPage({ params }: P) {
  const { locale: l, page } = await params;
  if (!isLocale(l) || !PAGES.includes(page as Slug)) notFound();
  const locale = l as Locale;
  const [title, body] = dict(locale).pages[page as Slug];
  const meta = vehicles().meta();
  return (
    <article className="wrap section prose" style={{ paddingBlockStart: 32 }}>
      <h1 className="h-page">{title}</h1>
      <p>{body}</p>
      {page === 'methodology' ? (
        <>
          <p className="small tnum">{locale === 'ar' ? 'نسخة البيانات' : 'Data version'}: <bdi>{meta.registry_version}</bdi> · {locale === 'ar' ? 'لقطة' : 'Snapshot'}: <bdi>{meta.snapshot_id}</bdi></p>
          <p><Link className="link" href={`/${locale}/market/catalog`}>{dict(locale).market.catalogCta}</Link></p>
        </>
      ) : null}
    </article>
  );
}
