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
import { CarCard, CarMedia, CarName, OfficialFigure, PriceFrom, PriceState, carNameText } from '@/components/car';
import TrackOnMount from '@/components/TrackOnMount';
import type { PublicTrim } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() { return vehicles().all().flatMap(c => LOCALES.map(locale => ({ locale, slug: c.id }))); }
export const dynamicParams = true; // unknown slugs -> notFound()

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = await params;
  const car = vehicles().get(slug);
  if (!isLocale(locale) || !car) return {};
  return pageMeta(locale, `/cars/${car.id}`, carNameText(car, locale));
}

function TrimTable({ trims, locale }: { trims: PublicTrim[]; locale: Locale }) {
  const t = dict(locale), c = t.car;
  return (
    <div className="table-scroll" role="region" aria-label={c.grade} tabIndex={0}><table className="t">
      <thead><tr><th scope="col">{c.grade}</th><th scope="col" className="t-num">{c.priceCol}</th><th scope="col">{c.stateCol}</th><th scope="col" className="t-num">{t.v2.market}</th></tr></thead>
      <tbody>{trims.map(tr => (
        <tr key={tr.key} data-trim={tr.key} data-official-state={tr.official.state}>
          <td><bdi>{tr.label}</bdi></td>
          <td className="t-num"><OfficialFigure o={tr.official} locale={locale} /></td>
          <td>
            <PriceState state={tr.official.state} locale={locale} />
            {tr.official.sources.length ? (
              <ul className="src-list">{tr.official.sources.map((s, i) => (
                <li key={i}>{s.url ? <a href={s.url} rel="nofollow noopener noreferrer" target="_blank">{s.name}</a> : s.name} · {date(s.observedAt, locale)}{s.effectiveDate ? ` (${date(s.effectiveDate, locale)})` : ''}</li>
              ))}</ul>
            ) : null}
          </td>
          <td className="t-num">{tr.market ? <><span className="tnum">{price(tr.market.value, locale)}</span><div className="small">{tr.market.source} · {date(tr.market.observedAt, locale)}</div></> : '—'}</td>
        </tr>))}
      </tbody>
    </table></div>
  );
}

export default async function CarDetail({ params }: P) {
  const { locale: l, slug } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const car = vehicles().get(slug);
  if (!car) notFound();
  const t = dict(locale), c = t.car, v2 = t.v2;
  const meta = vehicles().meta();
  const take = await takes().forModel(car.id);
  const alts = alternatives(car);
  const related = (await content().relatedTo(car.id)).slice(0, 3);
  const r = car.registrations;
  const monthly = r?.monthly.slice(-12) ?? [];
  const maxM = Math.max(1, ...monthly.map(x => x.count));
  const L = (p: string) => `/${locale}${p}`;
  const specRows: [string, React.ReactNode][] = [
    [c.spec.powertrain, car.powertrains.length ? car.powertrains.map(p => t.pt[p]).join(' / ') : t.state.unknown],
    ...Object.entries(car.specs).map(([k, s]) => [c.spec[k] ?? k, <>{s.values.map((v, i) => <div key={i}><bdi>{v.value}</bdi>{s.multiple ? <span className="small"> · {v.sources.join(', ')}</span> : null}</div>)}</>] as [string, React.ReactNode]),
  ];

  return (
    <div className="wrap section" style={{ paddingBlockStart: 24 }} data-model-id={car.id}>
      <TrackOnMount event="car_view" props={{ model_id: car.id }} />
      <nav className="breadcrumb" aria-label="breadcrumb"><Link href={L('/cars')}>{t.nav.cars}</Link></nav>

      <section className="cd-hero" aria-labelledby="car-h">
        <div className="cd-media"><CarMedia car={car} locale={locale} eager /></div>
        <div className="cd-info">
          {car.priceFrom.state !== 'conflict' ? <PriceState state={car.priceFrom.state} locale={locale} /> : null}
          <h1 id="car-h" className="h-page" style={{ margin: 0 }}><CarName car={car} locale={locale} /></h1>
          <p className="small" style={{ margin: 0 }}>{[car.powertrains.map(p => t.pt[p]).join(' / '), car.trims.length ? c.versions(car.trims.length) : null, car.priceFrom.modelYear ? `${v2.modelYear} ${car.priceFrom.modelYear}` : null].filter(Boolean).join(' · ')}</p>
          <div className="cd-price"><PriceFrom car={car} locale={locale} /></div>
          {car.priceFrom.state === 'conflict' ? <p className="small" style={{ margin: 0 }}>{v2.conflictNote}</p> : null}
          {car.lastObserved ? <div className="small">{t.state.stale}: {date(car.lastObserved, locale)}</div> : null}
          <div className="cd-ctas">
            <Link className="btn btn-primary" href={L(`/find-my-car?model=${encodeURIComponent(car.id)}`)}>{c.fits}</Link>
            <Link className="btn btn-ghost" href={L(`/compare?ids=${encodeURIComponent(car.id)}`)}>{c.compare}</Link>
          </div>
        </div>
      </section>
      {car.image ? <p className="small" style={{ marginBlockStart: 8 }}>{c.photoNote}{car.image.credit ? <> <bdi>{car.image.credit}</bdi></> : null}</p> : null}

      {car.gaps.length || !car.inSlice ? (
        <section className="cd-section notice" aria-labelledby="gaps-h">
          <h2 id="gaps-h" style={{ marginBlockStart: 0, fontSize: 18 }}>{v2.gapsH}</h2>
          <ul className="gap-list">
            {!car.inSlice ? <li>{v2.outOfSlice}</li> : null}
            {car.gaps.map(g => <li key={g}>{v2.gaps[g] ?? g}</li>)}
          </ul>
        </section>
      ) : null}

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
        <h2 id="prices-h" className="h-section">{c.pricesH}{car.priceFrom.modelYear ? <span className="small"> · {v2.modelYear} {car.priceFrom.modelYear}</span> : null}</h2>
        {car.trims.length ? <TrimTable trims={car.trims} locale={locale} /> : <div className="slot-empty">{c.noPrice}</div>}
        <p className="small">{v2.marketNote}</p>
        {car.otherCohorts.length ? (
          <details style={{ marginBlockStart: 12 }}>
            <summary className="link" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>{v2.otherYears}</summary>
            {car.otherCohorts.map(co => (
              <div key={String(co.modelYear)} style={{ marginBlockStart: 12 }}>
                <h3 style={{ fontSize: 16 }}>{v2.modelYear} {co.modelYear ?? '—'}</h3>
                <TrimTable trims={co.trims} locale={locale} />
              </div>
            ))}
          </details>
        ) : null}
      </section>

      {car.changes.length ? (
        <section className="cd-section" aria-labelledby="chg-h">
          <h2 id="chg-h" className="h-section">{v2.changesH}</h2>
          <div className="table-scroll" role="region" aria-label={c.grade} tabIndex={0}><table className="t">
            <thead><tr><th scope="col">{c.dateCol}</th><th scope="col">{c.grade}</th><th scope="col" className="t-num">{locale === 'ar' ? 'من' : 'From'}</th><th scope="col" className="t-num">{locale === 'ar' ? 'إلى' : 'To'}</th><th scope="col">{v2.sources}</th></tr></thead>
            <tbody>{car.changes.slice(0, 12).map((x, i) => (
              <tr key={i}><td className="tnum">{date(x.effectiveDate, locale)}</td><td><bdi>{x.trim}</bdi>{x.modelYear ? <span className="small"> · {x.modelYear}</span> : null}</td>
                <td className="t-num tnum">{price(x.from, locale)}</td><td className="t-num tnum">{price(x.to, locale)}</td>
                <td className="small">{x.source} · {x.kind === 'stated' ? v2.stated : v2.observed}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : null}

      <section className="cd-section" aria-labelledby="specs-h">
        <h2 id="specs-h" className="h-section">{c.specsH}</h2>
        <div className="spec-grid">{specRows.map(([k, v]) => <div className="spec" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
      </section>

      <section className="cd-section" aria-labelledby="gal-h" data-asset-flags="PHOTO_NEEDS_ENRICHMENT">
        <h2 id="gal-h" className="h-section">{c.galleryH}</h2>
        {car.image ? <div style={{ maxWidth: 640 }}><div className="cd-media" style={{ borderRadius: 10, overflow: 'hidden' }}><CarMedia car={car} locale={locale} /></div></div> : <div className="slot-empty">{c.noPhoto}</div>}
      </section>

      <section className="cd-section" aria-labelledby="mkt-h">
        <h2 id="mkt-h" className="h-section">{c.marketH}</h2>
        {r && r.inWindow != null ? (
          <div className="grid grid-2">
            <div className="card">
              <div className="small">{r.window ? v2.regsWindow(monthLabel(r.window[0], locale), monthLabel(r.window[1], locale)) : c.regLast12}</div>
              <div className="cd-price tnum">{num(r.inWindow)}</div>
              {r.rank && r.ranked ? <div className="small tnum">{v2.rankSlice(r.rank, r.ranked)}</div> : null}
              {r.share != null ? <div className="small tnum">{v2.share}: {(r.share * 100).toFixed(1)}%</div> : null}
              {r.yoy != null ? <div className="small tnum">{r.yoy > 0 ? '+' : ''}{(r.yoy * 100).toFixed(1)}% {v2.yoy}</div> : null}
              {r.firstSeen ? <div className="small">{v2.firstSeen}: {monthLabel(r.firstSeen, locale)}</div> : null}
              <p className="small" style={{ marginBlockEnd: 0 }}>{v2.regsNote}{r.monthsMissing.length ? ` ${v2.monthsMissing(r.monthsMissing.map(m => monthLabel(m, locale)).join(', '))}` : ''}</p>
            </div>
            <div className="card" aria-label={locale === 'ar' ? 'التسجيلات الشهرية' : 'Monthly registrations'}>
              <div className="bars">{monthly.map(m => (
                <div className="b" key={m.month}><i style={{ height: `${Math.max(3, (m.count / maxM) * 80)}px` }} title={`${m.month}: ${m.count}`} /><span className="tnum" style={{ fontSize: 10 }}>{m.month.slice(5)}</span></div>
              ))}</div>
            </div>
          </div>
        ) : <div className="slot-empty">{v2.gaps.REGISTRATION_UNLINKED}</div>}
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
          <p className="small">{locale === 'ar' ? 'نسخة البيانات' : 'Data version'}: <bdi>{meta.registry_version}</bdi> · <bdi>{meta.snapshot_id}</bdi></p>
          <p className="small">{v2.marketNote} {v2.regsNote}</p>
          <p className="small"><Link className="link" href={L('/methodology')}>{t.footer.methodology}</Link></p>
        </details>
      </section>

      {related.length ? (
        <section className="cd-section" aria-labelledby="rel-h">
          <h2 id="rel-h" className="h-section">{c.relatedH}</h2>
          <div className="grid grid-3">{related.map(x => (
            <Link key={x.slug} className="news-card" href={L(`/news/${x.slug}`)}><span className="tag">{t.news.types[x.type]}</span><h3>{x.title[locale]}</h3><p>{x.summary[locale]}</p></Link>
          ))}</div>
        </section>
      ) : null}
    </div>
  );
}
