import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { num } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { parseCarQuery, queryCars, type CarQuery } from '@/server/vehicles/query';
import { CarCard } from '@/components/car';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/cars', dict(locale).nav.cars);
}

function href(locale: Locale, q: CarQuery, patch: Partial<CarQuery>) {
  const m = { ...q, ...patch, page: patch.page ?? 1 };
  const sp = new URLSearchParams();
  if (m.body) sp.set('body', m.body);
  if (m.brand) sp.set('brand', m.brand);
  if (m.min != null) sp.set('min', String(m.min));
  if (m.max != null) sp.set('max', String(m.max));
  if (m.pt) sp.set('pt', m.pt);
  if (m.official) sp.set('official', '1');
  if (m.sort && m.sort !== 'popular') sp.set('sort', m.sort);
  if (m.page && m.page > 1) sp.set('page', String(m.page));
  const s = sp.toString();
  return `/${locale}/cars${s ? `?${s}` : ''}`;
}

export default async function Cars({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), c = t.cars;
  const q = parseCarQuery(await searchParams);
  const { items, total, pages } = queryCars(q);
  const brand = q.brand ? vehicles().brands().find(b => b.id === q.brand) : null;
  const all = vehicles().all().length;
  const bandOn = (b: { min?: number; max?: number }) => q.min === b.min && q.max === b.max;
  const hasFilters = q.body || q.brand || q.min != null || q.max != null || q.pt || q.official;

  return (
    <div className="wrap section" style={{ paddingBlockStart: 32 }}>
      <h1 className="h-page">{c.h1(num(all))}</h1>
      {brand ? <p className="sub">{c.brand}: <b>{locale === 'ar' ? brand.ar ?? brand.en : brand.en}</b></p> : null}
      <div className="filters" role="group" aria-label={c.filters}>
        <div className="filter-row">
          <span className="label">{t.body.any}</span>
          <Link className="chip" href={href(locale, q, { body: undefined })} aria-current={!q.body ? 'true' : undefined}>{c.all}</Link>
          {(['suv', 'sedan', 'hatch', 'mpv'] as const).map(b => (
            <Link key={b} className="chip" href={href(locale, q, { body: b })} aria-current={q.body === b ? 'true' : undefined}>{t.body[b]}</Link>
          ))}
        </div>
        <div className="filter-row">
          <span className="label">{c.price}</span>
          <Link className="chip" href={href(locale, q, { min: undefined, max: undefined })} aria-current={q.min == null && q.max == null ? 'true' : undefined}>{c.all}</Link>
          {t.bands.map(b => (
            <Link key={b.key} className="chip" href={href(locale, q, { min: b.min, max: b.max })} aria-current={bandOn(b) ? 'true' : undefined}>{b.label}</Link>
          ))}
        </div>
        <div className="filter-row">
          <span className="label">{c.pt}</span>
          <Link className="chip" href={href(locale, q, { pt: undefined })} aria-current={!q.pt ? 'true' : undefined}>{c.all}</Link>
          {(['petrol', 'hybrid', 'ev'] as const).map(p => (
            <Link key={p} className="chip" href={href(locale, q, { pt: p })} aria-current={q.pt === p ? 'true' : undefined}>{t.pt[p]}</Link>
          ))}
          <Link className="chip" href={href(locale, q, { official: !q.official })} aria-current={q.official ? 'true' : undefined}>{c.officialOnly}</Link>
        </div>
        <div className="filter-row">
          <span className="label">{c.sort}</span>
          {([['popular', c.sortPopular], ['price_asc', c.sortPriceAsc], ['price_desc', c.sortPriceDesc]] as const).map(([k, label]) => (
            <Link key={k} className="chip" href={href(locale, q, { sort: k })} aria-current={q.sort === k ? 'true' : undefined}>{label}</Link>
          ))}
          {hasFilters ? <Link className="link" href={`/${locale}/cars`}>{c.clear}</Link> : null}
        </div>
      </div>
      <p className="small" aria-live="polite">{c.results(num(total))}</p>
      {items.length ? (
        <div className="grid grid-4" style={{ marginBlockStart: 12 }}>{items.map((car, i) => <CarCard key={car.id} car={car} locale={locale} eager={i < 4} />)}</div>
      ) : <div className="notice">{c.empty}</div>}
      {pages > 1 ? (
        <nav className="pager" aria-label="pagination">
          {q.page! > 1 ? <Link className="btn btn-ghost btn-sm" href={href(locale, q, { page: q.page! - 1 })} rel="prev">{locale === 'ar' ? 'السابق' : 'Previous'}</Link> : null}
          <span className="small tnum" style={{ alignSelf: 'center' }}>{q.page} / {pages}</span>
          {q.page! < pages ? <Link className="btn btn-ghost btn-sm" href={href(locale, q, { page: q.page! + 1 })} rel="next">{locale === 'ar' ? 'التالي' : 'Next'}</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
