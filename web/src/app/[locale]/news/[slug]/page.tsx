import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { content } from '@/server/cms/provider';

type P = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await content().get(slug);
  if (!isLocale(locale) || !item) return {};
  return pageMeta(locale, `/news/${slug}`, item.title[locale], item.summary[locale], { noindex: item.status !== 'published' });
}

export default async function Article({ params }: P) {
  const { locale: l, slug } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const item = await content().get(slug);
  if (!item) notFound();
  const n = dict(locale).news;
  return (
    <article className="wrap section prose" style={{ paddingBlockStart: 32 }}>
      <nav className="breadcrumb"><Link href={`/${locale}/news`}>{n.h1}</Link></nav>
      <div className="chips" style={{ marginBlockEnd: 12 }}>
        <span className="tag">{n.types[item.type]}</span>
        {item.status === 'draft' ? <span className="tag tag-draft">{n.draft}</span> : null}
      </div>
      <h1 className="h-page">{item.title[locale]}</h1>
      <p className="lede">{item.summary[locale]}</p>
      {item.body[locale].map((p, i) => <p key={i}>{p}</p>)}
    </article>
  );
}
