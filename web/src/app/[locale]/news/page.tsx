import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { content, type ContentType } from '@/server/cms/provider';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/news', dict(locale).news.h1, dict(locale).news.lede);
}
const TYPES: ContentType[] = ['news', 'guide', 'insight'];

export default async function News({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), n = t.news;
  const sp = await searchParams;
  const type = TYPES.find(x => x === sp.type);
  const items = await content().list({ type, includeDrafts: true });
  return (
    <div className="wrap section" style={{ paddingBlockStart: 32 }}>
      <h1 className="h-page">{n.h1}</h1>
      <p className="lede">{n.lede}</p>
      <nav className="chips" style={{ marginBlockEnd: 20 }} aria-label={n.h1}>
        <Link className="chip" href={`/${locale}/news`} aria-current={!type ? 'true' : undefined}>{n.all}</Link>
        {TYPES.map(x => <Link key={x} className="chip" href={`/${locale}/news?type=${x}`} aria-current={type === x ? 'true' : undefined}>{n.types[x]}</Link>)}
      </nav>
      {items.length ? (
        <div className="grid grid-3">{items.map(c => (
          <Link key={c.slug} className="news-card" href={`/${locale}/news/${c.slug}`}>
            <span className="tag">{n.types[c.type]}</span>
            {c.status === 'draft' ? <span className="tag tag-draft">{n.draft}</span> : null}
            <h3>{c.title[locale]}</h3><p>{c.summary[locale]}</p>
          </Link>
        ))}</div>
      ) : <div className="notice">{n.empty}</div>}
    </div>
  );
}
