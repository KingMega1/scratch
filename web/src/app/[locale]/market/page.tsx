import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, monthLabel, num, price } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { BodyIcon, CarCard, CarName } from '@/components/car';
import { BrandGrid } from '@/components/brand';

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/market', dict(locale).market.h1, dict(locale).market.lede);
}

/* Market = customer discovery surface built from the public read model only (no QA queues, no confidence grades). */
export default async function Market({ params }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), m = t.market, v2 = t.v2;
  const V = vehicles(), cars = V.all(), meta = V.meta();
  const L = (p: string) => `/${locale}${p}`;
  const brands = V.brands();
  const inBand = (b: { min?: number; max?: number }) => cars.filter(c => c.priceFrom.sortValue != null && (b.min == null || c.priceFrom.sortValue >= b.min) && (b.max == null || c.priceFrom.sortValue < b.max)).length;
  const withReg = cars.filter(c => c.registrations?.inWindow != null);
  const popular = [...withReg].sort((a, b) => b.registrations!.inWindow! - a.registrations!.inWindow!).slice(0, 10);
  const window = withReg[0]?.registrations?.window ?? null;
  const launches = window ? withReg.filter(c => (c.registrations!.firstSeen ?? '') >= window[0]).sort((a, b) => (b.registrations!.firstSeen ?? '').localeCompare(a.registrations!.firstSeen ?? '')) : [];
  const gaining = withReg.filter(c => (c.registrations!.yoy ?? 0) > 0).sort((a, b) => b.registrations!.yoy! - a.registrations!.yoy!).slice(0, 6);
  const changes = cars.flatMap(c => c.changes.map(x => ({ car: c, x }))).sort((a, b) => b.x.effectiveDate.localeCompare(a.x.effectiveDate)).slice(0, 12);

  return (
    <>
      <div className="wrap section" style={{ paddingBlockEnd: 24, paddingBlockStart: 32 }}>
        <h1 className="h-page">{m.h1}</h1>
        <p className="lede">{m.lede}</p>
        <form role="search" action={L('/market/catalog')} className="search-box" style={{ maxWidth: 640 }}>
          <label className="visually-hidden" htmlFor="mq">{t.nav.search}</label>
          <input id="mq" name="q" type="search" placeholder={t.catalog.searchPh} maxLength={60} />
          <button className="btn btn-primary" type="submit">{t.search.submit}</button>
        </form>
        <p style={{ marginBlockStart: 20 }}><Link className="btn btn-dark" href={L('/market/catalog')} data-cta="catalog">{m.catalogCta}</Link></p>
      </div>

      <section id="brands" className="section" style={{ paddingBlockStart: 16 }} aria-labelledby="b-h">
        <div className="wrap">
          <h2 id="b-h" className="h-section">{m.brandsH}</h2>
          <BrandGrid brands={brands} locale={locale} />
        </div>
      </section>

      <section id="price" className="section surface" aria-labelledby="p-h">
        <div className="wrap">
          <h2 id="p-h" className="h-section">{m.bandsH}</h2>
          <div className="grid grid-4" style={{ marginBlockStart: 16 }}>
            {t.bands.map(b => (
              <Link key={b.key} className="band" href={L(`/cars?${new URLSearchParams({ ...(b.min != null ? { min: String(b.min) } : {}), ...(b.max != null ? { max: String(b.max) } : {}) })}`)}>
                <span className="n tnum">{num(inBand(b))}</span><span>{b.label}</span>
              </Link>
            ))}
          </div>
          <h2 id="body" className="h-section" style={{ marginBlockStart: 40 }}>{m.bodyH}</h2>
          <div className="chips" style={{ marginBlockStart: 12 }}>
            {(['suv', 'sedan', 'hatch', 'mpv'] as const).filter(k => cars.some(c => c.body === k)).map(k => (
              <Link key={k} className="body-tile" href={L(`/cars?body=${k}`)} data-body={k}><BodyIcon body={k} className="" /><b>{t.body[k]}</b><span className="n tnum">{m.models(cars.filter(c => c.body === k).length)}</span></Link>
            ))}
          </div>
        </div>
      </section>

      <section id="changes" className="section" aria-labelledby="ch-h">
        <div className="wrap">
          <h2 id="ch-h" className="h-section">{m.changedH}</h2>
          {changes.length ? (
            <div className="table-scroll"><table className="t">
              <thead><tr><th scope="col">{t.car.dateCol}</th><th scope="col">{t.catalog.model}</th><th scope="col" className="t-num">{locale === 'ar' ? 'من' : 'From'}</th><th scope="col" className="t-num">{locale === 'ar' ? 'إلى' : 'To'}</th><th scope="col">{v2.sources}</th></tr></thead>
              <tbody>{changes.map(({ car, x }, i) => (
                <tr key={i}>
                  <td className="tnum">{date(x.effectiveDate, locale)}</td>
                  <td><Link href={L(`/cars/${car.id}`)}><CarName car={car} locale={locale} /></Link> · <bdi>{x.trim}</bdi></td>
                  <td className="t-num tnum">{price(x.from, locale)}</td><td className="t-num tnum">{price(x.to, locale)}</td>
                  <td className="small">{x.source} · {x.kind === 'stated' ? v2.stated : v2.observed}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="notice">{m.changedFirst(meta.registry_version)}</div>}
        </div>
      </section>

      {launches.length ? (
        <section id="new" className="section" style={{ paddingBlockStart: 0 }} aria-labelledby="n-h">
          <div className="wrap">
            <h2 id="n-h" className="h-section">{m.newH}</h2>
            <p className="sub">{m.newSub(monthLabel(window![0], locale))}</p>
            <div className="grid grid-4">{launches.map(c => <CarCard key={c.id} car={c} locale={locale} />)}</div>
          </div>
        </section>
      ) : null}

      <section id="popular" className="section surface" aria-labelledby="pop-h">
        <div className="wrap grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <h2 id="pop-h" className="h-section">{m.popularH}</h2>
            <p className="sub">{window ? v2.regsWindow(monthLabel(window[0], locale), monthLabel(window[1], locale)) : ''}. {v2.regsNote}</p>
            <ol className="rank-list">{popular.map(c => (
              <li key={c.id}><Link href={L(`/cars/${c.id}`)}><CarName car={c} locale={locale} /></Link><span className="small tnum">{num(c.registrations!.inWindow!)} {m.regs}</span></li>
            ))}</ol>
          </div>
          <div>
            <h2 className="h-section">{m.gainingH}</h2>
            <p className="sub">{v2.yoy}</p>
            <ol className="rank-list">{gaining.map(c => (
              <li key={c.id}><Link href={L(`/cars/${c.id}`)}><CarName car={c} locale={locale} /></Link><span className="small tnum">+{(c.registrations!.yoy! * 100).toFixed(1)}%</span></li>
            ))}</ol>
          </div>
        </div>
      </section>

    </>
  );
}
