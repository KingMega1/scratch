import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { search } from '@/server/search/index';
import SearchTracker from '@/components/SearchTracker';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/search', dict(locale).search.h1, undefined, { noindex: true });
}

const EXAMPLES = { ar: ['صني', 'SUV', 'هايبرد', 'تحت 1.5 مليون', 'Tucson ولا Sportage'], en: ['Sunny', 'SUV', 'hybrid', 'under 1.5 million', 'Sportage vs Tucson'] };

export default async function Search({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), s = t.search;
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 120) : '';
  const res = await search(q, locale);
  const order = ['actions', 'cars', 'brands', 'market', 'content'] as const;
  return (
    <div className="wrap section" style={{ paddingBlockStart: 32, maxWidth: 860 }}>
      <h1 className="h-page">{s.h1}</h1>
      <form role="search" action={`/${locale}/search`} className="search-box">
        <label className="visually-hidden" htmlFor="sq">{s.h1}</label>
        <input id="sq" name="q" type="search" defaultValue={q} placeholder={t.searchPlaceholder} autoFocus={!q} />
        <button className="btn btn-primary" type="submit">{s.submit}</button>
      </form>
      {q ? <SearchTracker q={q} results={res.total} /> : null}
      <div className="chips" style={{ marginBlock: 16 }} aria-label={s.examples}>
        <span className="small" style={{ alignSelf: 'center' }}>{s.examples}:</span>
        {EXAMPLES[locale].map(e => <Link key={e} className="chip" href={`/${locale}/search?q=${encodeURIComponent(e)}`}><bdi>{e}</bdi></Link>)}
      </div>
      <div aria-live="polite">
        {!q ? <p className="small">{s.empty}</p> : res.total === 0 ? <div className="notice">{s.none(q)}</div> : order.map(g => res.groups[g]?.length ? (
          <section key={g} className="result-group" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`}>{s.groups[g]}</h2>
            {res.groups[g]!.map(h => (
              <Link key={h.href} className="result-row" href={h.href} data-group={g}>
                <span className="name">{locale === 'ar' && /[a-z]/i.test(h.title) ? <bdi>{h.title}</bdi> : h.title}</span>
                <span className="small tnum">{h.meta ?? '→'}</span>
              </Link>
            ))}
          </section>
        ) : null)}
      </div>
    </div>
  );
}
