import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, monthLabel, num, price } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { alternatives } from '@/server/vehicles/query';
import { takes } from '@/server/take/provider';
import { content } from '@/server/cms/provider';
import { CarCard, CarMedia, CarName, PriceFigure, PriceState, carNameText } from '@/components/car';
import TrackOnMount from '@/components/TrackOnMount';

type P = { params: Promise<{ locale: string; brand: string; model: string }> };

export function generateStaticParams() {
  return vehicles().all().flatMap(c => LOCALES.map(locale => ({ locale, brand: c.id.split('/')[0], model: c.id.split('/')[1] })));
}
export const dynamicParams = true; // unknown slugs -> notFound() below (avoids NoFallbackError log noise)

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, brand, model } = await params;
  const car = vehicles().get(`${brand}/${model}`);
  if (!isLocale(locale) || !car) return {};
  const t = dict(locale);
  const desc = car.price ? `${carNameText(car, locale)}: ${t.car.from} ${price(car.price.min, locale)}. ${t.state[car.price.state]}, ${date(car.price.asOf, locale)}.` : undefined;
  return pageMeta(locale, `/cars/${car.id}`, carNameText(car, locale), desc);
}

export default async function CarDetail({ params }: P) {
  const { locale: l, brand, model } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const car = vehicles().get(`${brand}/${model}`);
  if (!car) notFound();
  const t = dict(locale), c = t.car;
  const meta = vehicles().meta();
  const take = await takes().forModel(car.id);
  const alts = alternatives(car);
  const related = (await content().relatedTo(car.id)).slice(0, 3);
  const pr = car.price;
  const srcLabel = pr ? (pr.state === 'official' ? c.officialSrc : pr.state === 'listing' ? c.listingSrc : c.mixedSrc) : '—';
  const years = Object.entries(car.registrations?.yearly ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const maxYear = Math.max(1, ...years.map(([, v]) => v));
  const L = (p: string) => `/${locale}${p}`;
  const specs: [string, React.ReactNode][] = [
    [c.spec.body, t.body[car.body]],
    [c.spec.powertrain, car.powertrains.length ? car.powertrains.map(p => t.pt[p]).join(' / ') : t.state.unknown],
    [c.spec.hp, car.hp ? <span className="tnum">{car.hp.length > 1 ? `${car.hp[0]}–${car.hp[car.hp.length - 1]}` : car.hp[0]} {locale === 'ar' ? 'حصان' : 'hp'}</span> : t.state.unknown],
    [c.spec.seats, car.seats ? <span className="tnum">{car.seats.join(' / ')}</span> : t.state.unknown],
    [c.spec.drive, car.awdConfirmed ? c.awdYes : c.awdUnknown],
    [c.spec.warranty, car.warranty ? <>{car.warranty.text ? <bdi>{car.warranty.text}</bdi> : `${car.warranty.years}`}{!car.warranty.verified ? <span className="small" style={{ display: 'block', fontWeight: 400 }}>{c.warrantyUnverified}</span> : null}</> : t.state.unknown],
    [c.spec.modelYear, car.modelYear ? <span className="tnum">{car.modelYear}</span> : t.state.unknown],
    [c.spec.origin, car.origin ? <bdi>{car.origin}</bdi> : t.state.unknown],
    [c.spec.distributor, car.distributor ? <bdi>{car.distributor}</bdi> : t.state.unknown],
  ];

  return (
    <div className="wrap section" style={{ paddingBlockStart: 24 }} data-model-id={car.id}>
      <TrackOnMount event="car_view" props={{ model_id: car.id }} />
      <nav className="breadcrumb" aria-label="breadcrumb"><Link href={L('/cars')}>{t.nav.cars}</Link> / <Link href={L(`/cars?brand=${car.brandId}`)}>{locale === 'ar' ? car.brand.ar ?? car.brand.en : car.brand.en}</Link></nav>

      <section className="cd-hero" aria-labelledby="car-h">
        <div className="cd-media"><CarMedia car={car} locale={locale} eager /></div>
        <div className="cd-info">
          {pr ? <PriceState state={pr.state} locale={locale} /> : null}
          <h1 id="car-h" className="h-page" style={{ margin: 0 }}><CarName car={car} locale={locale} /></h1>
          <p className="small" style={{ margin: 0 }}>{[t.body[car.body], car.powertrains.map(p => t.pt[p]).join(' / '), pr ? c.versions(pr.trims.length) : null].filter(Boolean).join(' · ')}</p>
          {pr ? (
            <div>
              <div className="cd-price"><span className="small" style={{ fontWeight: 400 }}>{c.from} </span><PriceFigure value={pr.min} official={pr.trims[0].state === 'official'} locale={locale} /></div>
              {pr.max > pr.min ? <div className="small tnum">{locale === 'ar' ? 'لحد' : 'up to'} {price(pr.max, locale)}</div> : null}
              <div className="small">{t.state[pr.state]} · {date(pr.asOf, locale)}</div>
            </div>
          ) : <PriceState state="unknown" locale={locale} />}
          <div className="cd-ctas">
            <Link className="btn btn-primary" href={L(`/find-my-car?model=${encodeURIComponent(car.id)}`)}>{c.fits}</Link>
            <Link className="btn btn-ghost" href={L(`/compare?ids=${encodeURIComponent(car.id)}`)}>{c.compare}</Link>
          </div>
        </div>
      </section>
      {car.image?.flags.includes('EXACT_CAR_UNCONFIRMED') ? <p className="small" style={{ marginBlockStart: 8 }}>{c.photoNote}{car.image.credit ? <> <bdi>{car.image.credit}</bdi></> : null}</p> : null}

      <section className="cd-section" aria-labelledby="take-h" data-slot="carindex-take" data-bound={take ? 'true' : 'false'}>
        <h2 id="take-h" className="h-section">{c.takeH}</h2>
        {take ? (
          <div className="take-grid">
            <div className="card"><h3>{c.bestFor}</h3><ul>{take.bestFor.map(s => <li key={s.code}>{s.text[locale]}</li>)}</ul></div>
            <div className="card"><h3>{c.thinkTwice}</h3><ul>{take.thinkTwice.map(s => <li key={s.code}>{s.text[locale]}</li>)}</ul></div>
          </div>
        ) : <div className="slot-empty">{c.takePending}</div>}
      </section>

      <section className="cd-section" aria-labelledby="prices-h">
        <h2 id="prices-h" className="h-section">{c.pricesH}</h2>
        {pr ? (
          <div className="table-scroll"><table className="t">
            <thead><tr><th scope="col">{c.grade}</th><th scope="col" className="t-num">{c.priceCol}</th><th scope="col">{c.stateCol}</th><th scope="col">{c.dateCol}</th></tr></thead>
            <tbody>{pr.trims.map(tr => (
              <tr key={`${tr.label}-${tr.price}`}>
                <td><bdi>{tr.label}</bdi>{tr.powertrain && car.powertrains.length > 1 ? <span className="small"> · {t.pt[tr.powertrain]}</span> : null}</td>
                <td className="t-num"><PriceFigure value={tr.price} official={tr.state === 'official'} locale={locale} /></td>
                <td><PriceState state={tr.state} locale={locale} /></td>
                <td className="tnum">{date(tr.date, locale)}</td>
              </tr>))}
            </tbody>
          </table></div>
        ) : <div className="slot-empty">{c.noPrice}</div>}
      </section>

      <section className="cd-section" aria-labelledby="specs-h">
        <h2 id="specs-h" className="h-section">{c.specsH}</h2>
        <div className="spec-grid">{specs.map(([k, v]) => <div className="spec" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
      </section>

      <section className="cd-section" aria-labelledby="gal-h" data-asset-flags="PHOTO_NEEDS_ENRICHMENT">
        <h2 id="gal-h" className="h-section">{c.galleryH}</h2>
        {car.image ? (
          <div style={{ maxWidth: 640 }}><div className="cd-media" style={{ borderRadius: 10, overflow: 'hidden' }}><CarMedia car={car} locale={locale} /></div></div>
        ) : <div className="slot-empty">{c.noPhoto}</div>}
      </section>

      <section className="cd-section" aria-labelledby="mkt-h">
        <h2 id="mkt-h" className="h-section">{c.marketH}</h2>
        {car.registrations ? (
          <div className="grid grid-2">
            <div className="card">
              <div className="small">{c.regLast12}</div>
              <div className="cd-price tnum">{num(car.registrations.last12)}</div>
              {car.registrations.trend ? <div className="small">{c.trend[car.registrations.trend]}</div> : null}
              {car.registrations.rankInBody && car.registrations.ofBody ? <div className="small tnum">{c.rankBody(car.registrations.rankInBody, car.registrations.ofBody)}</div> : null}
              <div className="small">{monthLabel(meta.last12_window[0], locale)} – {monthLabel(meta.last12_window[1], locale)}</div>
            </div>
            <div className="card" aria-label={locale === 'ar' ? 'التسجيلات حسب السنة' : 'Registrations by year'}>
              <div className="bars">{years.map(([y, v]) => (
                <div className="b" key={y}><span className="tnum">{num(v)}</span><i style={{ height: `${Math.max(4, (v / maxYear) * 80)}px` }} /><span className="tnum">{y}</span></div>
              ))}</div>
            </div>
          </div>
        ) : <div className="slot-empty">{t.state.unknown}</div>}
      </section>

      {alts.length ? (
        <section className="cd-section" aria-labelledby="alt-h">
          <h2 id="alt-h" className="h-section">{c.altH}</h2>
          <div className="grid grid-3">{alts.map(a => <CarCard key={a.id} car={a} locale={locale} />)}</div>
          <p style={{ marginBlockStart: 16 }}><Link className="btn btn-ghost" href={L(`/compare?ids=${[car.id, ...alts.slice(0, 2).map(a => a.id)].join(',')}`)}>{c.compare}</Link></p>
        </section>
      ) : null}

      <section className="cd-section card" style={{ background: 'var(--ci-color-fog)' }} aria-labelledby="fmc-h">
        <h2 id="fmc-h" className="h-section">{c.fmcH}</h2>
        <p className="sub">{c.fmcBody}</p>
        <Link className="btn btn-primary" href={L(`/find-my-car?model=${encodeURIComponent(car.id)}`)}>{t.nav.fmc}</Link>
      </section>

      <section className="cd-section">
        <details className="evidence">
          <summary>{c.evidenceH}</summary>
          <p className="small">{c.evidence(srcLabel, pr ? date(pr.asOf, locale) : '—', meta.registry_version)}</p>
          <p className="small"><Link className="link" href={L('/methodology')}>{t.footer.methodology}</Link></p>
        </details>
      </section>

      {related.length ? (
        <section className="cd-section" aria-labelledby="rel-h">
          <h2 id="rel-h" className="h-section">{c.relatedH}</h2>
          <div className="grid grid-3">{related.map(r => (
            <Link key={r.slug} className="news-card" href={L(`/news/${r.slug}`)}><span className="tag">{t.news.types[r.type]}</span><h3>{r.title[locale]}</h3><p>{r.summary[locale]}</p></Link>
          ))}</div>
        </section>
      ) : null}
    </div>
  );
}
