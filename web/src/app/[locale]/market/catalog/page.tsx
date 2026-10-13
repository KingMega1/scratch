import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { brandSlug, vehicles } from '@/server/vehicles/read-model';
import { PriceFrom, arModel } from '@/components/car';
import { BrandMark, brandName, sortBrands } from '@/components/brand';
import type { Powertrain, PublicCar } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/market/catalog', dict(locale).catalog.h1);
}

type Sort = 'brand' | 'price_asc' | 'price_desc';
const FUELS: Powertrain[] = ['petrol', 'diesel', 'hybrid', 'phev', 'reev', 'ev'];
// legacy ?sort=name|price|regs links keep working
const LEGACY: Record<string, Sort> = { name: 'brand', regs: 'brand', price: 'price_asc' };
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined);

function ModelCard({ car, locale, withBrand }: { car: PublicCar; locale: Locale; withBrand: boolean }) {
  const t = dict(locale);
  const model = locale === 'ar' ? arModel(car) ?? car.model.en : car.model.en;
  const brand = locale === 'ar' ? car.brand.ar ?? car.brand.en : car.brand.en;
  const specs = [car.body ? t.body[car.body] : null, car.powertrains.map(p => t.pt[p]).join(' / ') || null].filter(Boolean).join(' · ');
  return (
    <li>
      <Link className="mc" href={`/${locale}/cars/${car.id}`} data-model-id={car.id} data-price-state={car.priceFrom.state}>
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

/* All cars and prices: Brand -> Model -> Price -> key specs. Mobile-first cards (no wide table).
   Data: the website catalogue serving release (read model). Unknown prices and conflicts stay explicit. */
export default async function Catalog({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), c = t.catalog;
  const sp = await searchParams;
  const rawSort = one(sp.sort) ?? 'brand';
  const sort: Sort = (['brand', 'price_asc', 'price_desc'] as const).includes(rawSort as Sort) ? rawSort as Sort : LEGACY[rawSort] ?? 'brand';
  const fuelParam = one(sp.fuel) as Powertrain | undefined;
  const fuel = fuelParam && FUELS.includes(fuelParam) ? fuelParam : undefined;
  const all = vehicles().all();
  const present = FUELS.filter(f => all.some(x => x.powertrains.includes(f)));
  const rows = all.filter(x => !fuel || x.powertrains.includes(fuel));
  const col = new Intl.Collator(locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base', numeric: true });
  const modelName = (x: PublicCar) => (locale === 'ar' ? arModel(x) ?? x.model.en : x.model.en);
  const href = (o: { sort?: Sort; fuel?: Powertrain | null }) => {
    const q = new URLSearchParams();
    const s = o.sort ?? sort, f = o.fuel === null ? undefined : o.fuel ?? fuel;
    if (s !== 'brand') q.set('sort', s);
    if (f) q.set('fuel', f);
    const qs = q.toString();
    return `/${locale}/market/catalog${qs ? `?${qs}` : ''}`;
  };

  const groups = sortBrands(vehicles().brands(), locale)
    .map(b => ({ b, cars: rows.filter(x => brandSlug(x.brand.en) === b.id).sort((x, y) => col.compare(modelName(x), modelName(y))) }))
    .filter(g => g.cars.length);
  const priceOf = (x: PublicCar) => x.priceFrom.sortValue;
  const flat = sort === 'brand' ? [] : [...rows].sort((x, y) => {
    const a = priceOf(x), b = priceOf(y);
    if (a == null && b == null) return col.compare(`${x.brand.en} ${modelName(x)}`, `${y.brand.en} ${modelName(y)}`);
    if (a == null) return 1; if (b == null) return -1; // unknown prices last, never guessed
    return sort === 'price_asc' ? a - b : b - a;
  });

  return (
    <div className="wrap section catalog" style={{ paddingBlockStart: 32 }}>
      <nav className="breadcrumb"><Link href={`/${locale}/market`}>{c.back}</Link></nav>
      <h1 id="catalog-h" className="h-page">{c.h1}</h1>

      <div className="cat-controls">
        <div className="filter-row" role="group" aria-label={c.fuel}>
          <span className="label">{c.fuel}</span>
          <Link className="chip" href={href({ fuel: null })} aria-current={!fuel ? 'true' : undefined}>{c.allFuels}</Link>
          {present.map(f => <Link key={f} className="chip" href={href({ fuel: f })} aria-current={fuel === f ? 'true' : undefined} data-fuel={f}>{t.pt[f]}</Link>)}
        </div>
        <div className="filter-row" role="group" aria-label={c.sort}>
          <span className="label">{c.sort}</span>
          {(['brand', 'price_asc', 'price_desc'] as const).map(s => (
            <Link key={s} className="chip" href={href({ sort: s })} aria-current={sort === s ? 'true' : undefined} data-sort={s}>
              {s === 'brand' ? c.sortBrand : s === 'price_asc' ? c.sortPriceAsc : c.sortPriceDesc}
            </Link>
          ))}
        </div>
      </div>

      {!rows.length ? <p className="notice">{c.empty}</p> : null}

      {sort === 'brand' && groups.length ? (
        <>
          <nav className="brand-jump" aria-label={c.jump}>
            {groups.map(({ b }) => (
              <a key={b.id} href={`#brand-${b.id}`} className="chip">{locale === 'ar' && !b.ar ? <bdi>{brandName(b, locale)}</bdi> : brandName(b, locale)}</a>
            ))}
          </nav>
          {groups.map(({ b, cars }) => (
            <section key={b.id} id={`brand-${b.id}`} className="cat-brand" aria-labelledby={`bh-${b.id}`} data-brand-id={b.id}>
              <header className="cat-brand-head">
                <BrandMark id={b.id} label={b.en} size={36} />
                <h2 id={`bh-${b.id}`}>{locale === 'ar' && !b.ar ? <bdi>{brandName(b, locale)}</bdi> : brandName(b, locale)}</h2>
                <span className="small tnum">{c.models(cars.length)}</span>
              </header>
              <ul className="mc-grid">{cars.map(x => <ModelCard key={x.id} car={x} locale={locale} withBrand={false} />)}</ul>
            </section>
          ))}
        </>
      ) : null}

      {sort !== 'brand' && flat.length ? <ul className="mc-grid" style={{ marginBlockStart: 16 }}>{flat.map(x => <ModelCard key={x.id} car={x} locale={locale} withBrand />)}</ul> : null}
    </div>
  );
}
