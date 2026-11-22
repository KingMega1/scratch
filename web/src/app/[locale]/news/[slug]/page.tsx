import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { showDrafts, siteUrl } from '@/lib/deploy-env';
import { content } from '@/server/cms/provider';

type P = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await content().get(slug);
  if (!isLocale(locale) || !item || (item.status !== 'published' && !showDrafts())) return {};
  return pageMeta(locale, `/news/${slug}`, item.title[locale], item.summary[locale], { noindex: item.status !== 'published', image: item.images?.[0]?.src, article: { publishedTime: item.publishedAt } });
}

export default async function Article({ params }: P) {
  const { locale: l, slug } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const item = await content().get(slug);
  if (!item || (item.status !== 'published' && !showDrafts())) notFound(); // drafts are never served in production
  const n = dict(locale).news;
  const base = siteUrl();
  const ld = {
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: item.title[locale], description: item.summary[locale], inLanguage: locale,
    datePublished: item.publishedAt ?? undefined,
    image: (item.images ?? []).map(im => `${base}${im.src}`),
    mainEntityOfPage: `${base}/${locale}/news/${slug}`,
    author: { '@type': 'Organization', name: 'CarIndexed' },
    publisher: { '@type': 'Organization', name: 'CarIndexed', logo: { '@type': 'ImageObject', url: `${base}/brand/carindexed-logo-white-yellow.svg` } },
  };
  return (
    <article className="wrap section prose" style={{ paddingBlockStart: 32 }}>
      {item.status === 'published' ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} /> : null}
      <nav className="breadcrumb"><Link prefetch={false} href={`/${locale}/news`}>{n.h1}</Link></nav>
      <div className="chips" style={{ marginBlockEnd: 12 }}>
        <span className="tag">{n.types[item.type]}</span>
        {item.status === 'draft' ? <span className="tag tag-draft">{n.draft}</span> : null}
      </div>
      <h1 className="h-page">{item.title[locale]}</h1>
      <p className="lede">{item.summary[locale]}</p>
      {item.images?.[0] ? <img src={item.images[0].src} alt={item.images[0].alt[locale]} width={1080} height={1350} style={{ width: '100%', maxWidth: 480, height: 'auto', borderRadius: 12, marginBlockEnd: 16 }} decoding="async" /> : null}
      {item.body[locale].map((p, i) => <p key={i}>{p}</p>)}
      {item.images && item.images.length > 1 ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', marginBlockStart: 20 }}>
          {item.images.slice(1).map(im => <img key={im.src} src={im.src} alt={im.alt[locale]} width={1080} height={1350} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', borderRadius: 12 }} />)}
        </div>
      ) : null}
    </article>
  );
}
