import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { num } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { brandSlug, vehicles } from '@/server/vehicles/read-model';
import { PriceFrom, arModel } from '@/components/car';
import { BrandGrid, BrandMark, brandName } from '@/components/brand';
import type { Powertrain, PublicCar } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/market/catalog', dict(locale).catalog.h1);
}

type Sort = 'name' | 'price_asc' | 'price_desc';
const FUELS: Powertrain[] = ['petrol', 'diesel', 'hybrid', 'phev', 'reev', 'ev'];
const BODIES = ['suv', 'sedan', 'hatch', 'mpv'] as const;
const PAGE = 24;
const LEGACY: Record<string, Sort> = { brand: 'name', regs: 'name', price: 'price_asc' };
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined);
const intOf = (v?: string) => { const n = Number(v); return v != null && Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n) : undefined; };
// Search normalisation: case, Latin diacritics, Arabic letter variants and tatweel.
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function ModelCard({ car, locale, withBrand }: { car: PublicCar; locale: Locale; withBrand: boolean }) {
  const t = dict(locale);
  const model = locale === 'ar' ? arModel(car) ?? car.model.en : car.model.en;
  const brand = locale === 'ar' ? car.brand.ar ?? car.brand.en : car.brand.en;
  const specs = [car.body ? t.body[car.body] : null, car.powertrains.map(p => t.pt[p]).join(' / ') || null].filter(Boolean).join(' · ');
  return (
    <li>
      <Link className={`mc${car.image ? ' has-photo' : ''}`} href={`/${locale}/cars/${car.id}`} data-model-id={car.id} data-price-state={car.priceFrom.state}>
        {car.image ? <img className="mc-photo" src={car.image.src} alt="" loading="lazy" decoding="async" data-verified-photo="true" /> : null}
        <span className="mc-name">
          {withBrand ? <span className="mc-brand">{locale === 'ar' && !car.brand.ar ? <bdi>{brand}</bdi> : brand}</span> : null}
          {locale === 'ar' && !arModel(car) ? <bdi>{model}</bdi> : model}
        </span>
        <span className="mc-price"><span className="mc-label">{t.catalog.price}</span>{car.priceFrom.state === 'unknown' ? <span className="price-na">{t.catalog.na}</span> : <PriceFrom car={car} locale={locale} />}</span>
        {specs ? <span className="mc-specs">{specs}</span> : null}
      </Link>
    </li>
  );
}

/* Car prices catalogue: brand logos -> a brand's models -> vehicle details (progressive disclosure).
   The full list is never dumped at once: entry shows brands; search/filters show paged results.
   Data: the website catalogue serving release (read model). Unknown prices and conflicts stay explicit. */
export default async function Catalog({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), c = t.catalog;
  const sp = await searchParams;
  const rawSort = one(sp.sort) ?? 'name';
  const sort: Sort = (['name', 'price_asc', 'price_desc'] as const).includes(rawSort as Sort) ? rawSort as Sort : LEGACY[rawSort] ?? 'name';
  const fuelP = one(sp.fuel) as Powertrain | undefined, fuel = fuelP && FUELS.includes(fuelP) ? fuelP : undefined;
  const bodyP = one(sp.body), body = bodyP && (BODIES as readonly string[]).includes(bodyP) ? bodyP : undefined;
  const q = (one(sp.q) ?? '').slice(0, 60).trim();
  const min = intOf(one(sp.min)), max = intOf(one(sp.max));
  const V = vehicles(), all = V.all();
  const brands = V.brands();
  const brandP = one(sp.brand), brand = brandP ? brands.find(b => b.id === brandP) ?? null : null;
  const present = FUELS.filter(f => all.some(x => x.powertrains.includes(f)));
  const filtering = Boolean(q || fuel || body || min != null || max != null);
  const mode: 'brands' | 'brand' | 'results' = brand ? 'brand' : filtering ? 'results' : 'brands';

  const col = new Intl.Collator(locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base', numeric: true });
  const modelName = (x: PublicCar) => (locale === 'ar' ? arModel(x) ?? x.model.en : x.model.en);
  const terms = norm(q).split(' ').filter(Boolean);
  const hay = (x: PublicCar) => norm([x.brand.en, x.brand.ar ?? '', x.model.en, x.model.ar ?? '', x.id].join(' '));
  const p = (x: PublicCar) => x.priceFrom.sortValue;
  let rows = all.filter(x => (!brand || brandSlug(x.brand.en) === brand.id) && (!fuel || x.powertrains.includes(fuel)) && (!body || x.body === body) &&
    (!terms.length || terms.every(w => hay(x).includes(w))) &&
    (min == null || (p(x) != null && p(x)! >= min)) && (max == null || (p(x) != null && p(x)! < max)));
  rows = [...rows].sort((x, y) => {
    if (sort === 'name') return col.compare(`${brandName(x.brand, locale)} ${modelName(x)}`, `${brandName(y.brand, locale)} ${modelName(y)}`);
    const a = p(x), b = p(y);
    if (a == null && b == null) return col.compare(modelName(x), modelName(y));
    if (a == null) return 1; if (b == null) return -1; // unknown prices last, never guessed
    return sort === 'price_asc' ? a - b : b - a;
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(Math.max(1, intOf(one(sp.page)) ?? 1), pages);
  const shown = mode === 'brand' ? rows : rows.slice((page - 1) * PAGE, page * PAGE);

  const href = (o: Record<string, string | number | undefined | null>) => {
    const cur: Record<string, string | number | undefined> = { brand: brand?.id, q: q || undefined, fuel, body, min, max, sort: sort === 'name' ? undefined : sort, page: undefined };
    for (const [k, v] of Object.entries(o)) cur[k] = v === null ? undefined : v;
    const s = new URLSearchParams(Object.entries(cur).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();
    return `/${locale}/market/catalog${s ? `?${s}` : ''}`;
  };
  const bandOn = (b: { min?: number; max?: number }) => min === b.min && max === b.max;

  return (
    <div className="wrap section catalog" style={{ paddingBlockStart: 32 }} data-catalog-mode={mode}>
      <nav className="breadcrumb" aria-label={c.back}>
        <Link href={`/${locale}/market`}>{c.back}</Link>
        {mode !== 'brands' ? <> · <Link href={`/${locale}/market/catalog`}>{c.h1}</Link></> : null}
      </nav>
      {mode === 'brand' && brand ? (
        <header className="cat-brand-head cat-brand-page">
          <BrandMark id={brand.id} label={brand.en} size={48} />
          <h1 className="h-page">{locale === 'ar' && !brand.ar ? <bdi>{brandName(brand, locale)}</bdi> : brandName(brand, locale)}</h1>
        </header>
      ) : <h1 id="catalog-h" className="h-page">{c.h1}</h1>}

      <form className="cat-search search-box" role="search" action={`/${locale}/market/catalog`}>
        {brand ? <input type="hidden" name="brand" value={brand.id} /> : null}
        <label className="visually-hidden" htmlFor="cat-q">{c.searchLabel}</label>
        <input id="cat-q" name="q" type="search" defaultValue={q} placeholder={c.searchPh} maxLength={60} />
        <button className="btn btn-primary" type="submit">{t.search.submit}</button>
      </form>

      <details className="cat-filters" open={filtering}>
        <summary>{c.filtersH}</summary>
        <div className="filter-row" role="group" aria-label={c.fuel}>
          <span className="label">{c.fuel}</span>
          <Link className="chip" href={href({ fuel: null })} aria-current={!fuel ? 'true' : undefined}>{c.allFuels}</Link>
          {present.map(f => <Link key={f} className="chip" href={href({ fuel: f })} aria-current={fuel === f ? 'true' : undefined} data-fuel={f}>{t.pt[f]}</Link>)}
        </div>
        <div className="filter-row" role="group" aria-label={t.compare.rows.body}>
          <span className="label">{t.compare.rows.body}</span>
          <Link className="chip" href={href({ body: null })} aria-current={!body ? 'true' : undefined}>{c.allFuels}</Link>
          {BODIES.filter(b => all.some(x => x.body === b)).map(b => <Link key={b} className="chip" href={href({ body: b })} aria-current={body === b ? 'true' : undefined} data-body={b}>{t.body[b]}</Link>)}
        </div>
        <div className="filter-row" role="group" aria-label={c.price}>
          <span className="label">{c.price}</span>
          <Link className="chip" href={href({ min: null, max: null })} aria-current={min == null && max == null ? 'true' : undefined}>{c.allFuels}</Link>
          {t.bands.map(b => <Link key={b.key} className="chip" href={href({ min: b.min ?? null, max: b.max ?? null })} aria-current={bandOn(b) ? 'true' : undefined}>{b.label}</Link>)}
        </div>
        {mode !== 'brands' ? (
          <div className="filter-row" role="group" aria-label={c.sort}>
            <span className="label">{c.sort}</span>
            {(['name', 'price_asc', 'price_desc'] as const).map(s => (
              <Link key={s} className="chip" href={href({ sort: s === 'name' ? null : s })} aria-current={sort === s ? 'true' : undefined} data-sort={s}>
                {s === 'name' ? c.sortName : s === 'price_asc' ? c.sortPriceAsc : c.sortPriceDesc}
              </Link>
            ))}
          </div>
        ) : null}
      </details>

      {mode === 'brands' ? (
        <section aria-labelledby="cat-brands-h">
          <h2 id="cat-brands-h" className="h-section">{t.market.brandsH}</h2>
          <BrandGrid brands={brands} locale={locale} />
        </section>
      ) : (
        <section aria-live="polite">
          <p className="small tnum" data-result-count={rows.length}>{c.results(num(rows.length))}</p>
          {shown.length ? <ul className="mc-grid">{shown.map(x => <ModelCard key={x.id} car={x} locale={locale} withBrand={mode !== 'brand'} />)}</ul> : <p className="notice">{c.empty}</p>}
          {mode === 'results' && pages > 1 ? (
            <nav className="pager" aria-label={c.pages}>
              {page > 1 ? <Link className="btn btn-ghost" href={href({ page: page - 1 })} rel="prev">{c.prev}</Link> : null}
              <span className="small tnum">{c.pageOf(num(page), num(pages))}</span>
              {page < pages ? <Link className="btn btn-ghost" href={href({ page: page + 1 })} rel="next">{c.next}</Link> : null}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
