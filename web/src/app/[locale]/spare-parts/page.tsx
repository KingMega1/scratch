import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { vehicles, brandSlug } from '@/server/vehicles/read-model';
import { brandName, sortBrands } from '@/components/brand';
import { carNameText } from '@/components/car';
import Finder, { type FinderModel } from '@/components/parts/Finder';
import PartPrice from '@/components/parts/PartPrice';
import { PART_CATEGORIES, type PartCategory, type PartPrice as Price } from '@/lib/spare-parts/model';
import { PARTS_DATA_STATUS, SAMPLE_PARTS } from '@/lib/spare-parts/sample';
import type { PublicCar } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/* Noindex while the parts data is a sample (PARTS_DATA_STATUS); it is also left out of the sitemap. */
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const p = dict(locale).parts;
  return pageMeta(locale, '/spare-parts', p.title, p.lede, { noindex: PARTS_DATA_STATUS === 'SAMPLE_UNVERIFIED' });
}

/* Model years the vehicle data actually carries for this model (price cohorts); none -> the year is left open. */
const yearsOf = (c: PublicCar) => [...new Set([c.priceFrom.modelYear, ...c.trims.map(t => t.modelYear), ...c.otherCohorts.map(o => o.modelYear)]
  .filter((y): y is number => typeof y === 'number'))].sort((a, b) => b - a);
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined);
const STATES: Price['state'][] = ['dealer', 'confirmed', 'unknown', 'conflict'];

export default async function SpareParts({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), p = t.parts;
  const V = vehicles();
  const cars = V.all();
  const makes = sortBrands(V.brands(), locale).map(b => ({ id: b.id, label: brandName(b, locale) }));
  const col = new Intl.Collator(locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base' });
  const models: FinderModel[] = cars.map(c => ({ slug: c.id, make: brandSlug(c.brand.en), label: locale === 'ar' ? c.model.ar ?? c.model.en : c.model.en, years: yearsOf(c) }))
    .sort((a, b) => col.compare(a.label, b.label));

  // Untrusted query: keep only values the data knows.
  const sp = await searchParams;
  const make = makes.find(m => m.id === one(sp.make))?.id;
  const model = make ? models.find(m => m.slug === one(sp.model) && m.make === make) : undefined;
  const year = model && model.years.map(String).includes(one(sp.year) ?? '') ? one(sp.year) : undefined;
  const cat = PART_CATEGORIES.find(k => k === one(sp.cat)) as PartCategory | undefined;
  const car = model ? V.get(model.slug) : null; // every model in the finder comes from the read model, so its page exists
  const items = SAMPLE_PARTS.filter(x => !cat || x.category === cat);
  const href = (q: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ make, model: model?.slug, year, cat, ...q }).filter(([, v]) => v) as [string, string][]).toString();
    return `/${locale}/spare-parts${s ? `?${s}` : ''}#parts-results`;
  };

  return (
    <div className="parts">
      <section className="parts-hero" aria-labelledby="parts-h">
        <div className="wrap">
          <h1 id="parts-h" className="h-page">{p.h1}</h1>
          <p className="lede">{p.lede}</p>
          <Finder locale={locale} makes={makes} models={models} sel={{ make, model: model?.slug, year, cat }} />
          <p className="small parts-sample" role="note" data-parts-data={PARTS_DATA_STATUS}>{p.sample}</p>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="parts-cats-h">
        <h2 id="parts-cats-h" className="h-section">{p.catsH}</h2>
        <ul className="parts-cats">
          {PART_CATEGORIES.map(k => (
            <li key={k}>
              <Link className="parts-cat" href={href({ cat: cat === k ? undefined : k })} aria-current={cat === k ? 'true' : undefined} data-part-category={k}>
                <b>{p.cats[k][0]}</b><span className="small">{p.cats[k][1]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="parts-results" className="wrap section" aria-labelledby="parts-res-h" style={{ paddingBlockStart: 0 }}>
        <h2 id="parts-res-h" className="h-section">{p.resultsH}</h2>
        <p className="sub">{p.resultsSub}</p>
        {car ? (
          <p className="parts-car" data-parts-car={car.id}>
            <b>{p.forCar(carNameText(car, locale), year ?? '')}</b>{' · '}
            <Link className="link" href={`/${locale}/cars/${car.id}`} data-model-link={car.id}>{p.modelPage}</Link>
          </p>
        ) : <p className="notice" role="note">{p.pickCarFirst}</p>}
        {cat ? <p className="small">{p.cats[cat][0]} · <Link className="link" href={href({ cat: undefined })}>{p.allCats}</Link></p> : null}
        {items.length ? (
          <ul className="parts-grid">
            {items.map(x => (
              <li key={x.id} className="part" data-part-id={x.id} data-part-kind={x.kind}>
                <div className="part-photo" role="img" aria-label={p.photo}><span aria-hidden="true">{p.photo}</span></div>
                <div className="part-body">
                  <div className="part-chips">
                    <span className={`part-kind part-${x.kind}`}>{x.kind === 'oem' ? p.oem : p.aftermarket}</span>
                    <span className="small part-compat">{p.compatSample}</span>
                  </div>
                  <h3 className="part-name">{x.name[locale]}</h3>
                  {x.note ? <p className="small">{x.note[locale]}</p> : null}
                  <p className="small">{p.partNo}: <span data-part-number={x.partNumber ?? ''}>{x.partNumber ?? p.none}</span></p>
                  <PartPrice value={x.price} locale={locale} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="notice">{p.empty}</p>}
      </section>

      <section className="wrap section" aria-labelledby="parts-states-h" style={{ paddingBlockStart: 0 }}>
        <h2 id="parts-states-h" className="h-section">{p.statesH}</h2>
        <ul className="parts-states">
          {STATES.map(s => (
            <li key={s} data-state-key={s}>
              <span className={`pp-state pp-${s}`}>{p.state[s]}</span>
              <span className="small">{p.statesBody[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section surface" aria-labelledby="parts-why-h">
        <div className="wrap">
          <h2 id="parts-why-h" className="visually-hidden">{p.title}</h2>
          <div className="grid grid-3">
            {p.whyH.map((h, i) => (<div className="part-why" key={h}><h3>{h}</h3><p>{p.whyBody[i]}</p></div>))}
          </div>
          <p className="parts-help">{p.help} <Link className="btn btn-primary" href={`/${locale}/contact`} data-cta="parts_contact">{p.contact}</Link></p>
          <p className="small">{p.notSelling}</p>
        </div>
      </section>
    </div>
  );
}
