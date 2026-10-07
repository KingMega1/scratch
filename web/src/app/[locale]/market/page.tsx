import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { monthLabel, num, priceShort } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { BodyIcon, CarCard, CarName } from '@/components/car';
import type { Body } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/market', dict(locale).market.h1, dict(locale).market.lede);
}

/* Market = customer discovery surface. Built only from the public read model; no staging/QA/confidence fields. */
export default async function Market({ params }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), m = t.market;
  const V = vehicles(), cars = V.all(), meta = V.meta();
  const L = (p: string) => `/${locale}${p}`;
  const brands = V.brands();
  const inBand = (b: { min?: number; max?: number }) => cars.filter(c => c.price && (b.min == null || c.price.min >= b.min) && (b.max == null || c.price.min < b.max)).length;
  const bodies: Body[] = ['suv', 'sedan', 'hatch', 'mpv'];
  const withReg = cars.filter(c => c.registrations);
  const popular = [...withReg].sort((a, b) => b.registrations!.last12 - a.registrations!.last12).slice(0, 10);
  const newFrom = meta.last12_window[0];
  const launches = withReg.filter(c => (c.registrations!.firstMonth ?? '') >= newFrom).sort((a, b) => (b.registrations!.firstMonth ?? '').localeCompare(a.registrations!.firstMonth ?? '') || b.registrations!.last12 - a.registrations!.last12).slice(0, 8);
  const gaining = withReg.filter(c => c.registrations!.trend === 'gaining').sort((a, b) => b.registrations!.last12 - a.registrations!.last12).slice(0, 6);
  const official = cars.filter(c => c.price?.trims.some(x => x.state === 'official')).length;
  const chinese = cars.filter(c => c.chineseBrand).length;
  const hybrid = cars.filter(c => c.powertrains.includes('hybrid')).length;
  const ev = cars.filter(c => c.powertrains.length === 1 && c.powertrains[0] === 'ev').length;

  return (
    <>
      <div className="wrap section" style={{ paddingBlockEnd: 24, paddingBlockStart: 32 }}>
        <h1 className="h-page">{m.h1}</h1>
        <p className="lede">{m.lede}</p>
        <form role="search" action={L('/search')} className="search-box" style={{ maxWidth: 640 }}>
          <label className="visually-hidden" htmlFor="mq">{t.nav.search}</label>
          <input id="mq" name="q" type="search" placeholder={t.searchPlaceholder} />
          <button className="btn btn-primary" type="submit">{t.search.submit}</button>
        </form>
      </div>

      <section id="brands" className="section" style={{ paddingBlockStart: 16 }} aria-labelledby="b-h">
        <div className="wrap">
          <h2 id="b-h" className="h-section">{m.brandsH}</h2>
          <div className="brand-grid" style={{ marginBlockStart: 16 }}>
            {brands.slice(0, 18).map(b => (
              <Link key={b.id} className="brand-chip" href={L(`/cars?brand=${b.id}`)}>
                <b>{locale === 'ar' ? b.ar ?? <bdi>{b.en}</bdi> : b.en}</b><span className="tnum">{m.models(b.count)}</span>
              </Link>
            ))}
          </div>
          <details style={{ marginBlockStart: 12 }}>
            <summary className="link" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>{locale === 'ar' ? `كل الماركات (${brands.length})` : `All brands (${brands.length})`}</summary>
            <div className="chips" style={{ marginBlockStart: 8 }}>{brands.slice(18).map(b => <Link key={b.id} className="chip" href={L(`/cars?brand=${b.id}`)}>{locale === 'ar' ? b.ar ?? b.en : b.en}</Link>)}</div>
          </details>
        </div>
      </section>

      <section className="section surface" aria-labelledby="p-h">
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
          <div className="strip" style={{ marginBlockStart: 16 }}>
            {bodies.map(b => (
              <Link key={b} className="body-tile" href={L(`/cars?body=${b}`)} style={{ background: 'var(--ci-color-white)' }}>
                <BodyIcon body={b} className="" /><b>{t.body[b]}</b><span className="n tnum">{m.models(cars.filter(c => c.body === b).length)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="ch-h">
        <div className="wrap">
          <h2 id="ch-h" className="h-section">{m.changedH}</h2>
          <div className="notice" style={{ marginBlockStart: 12 }}>{m.changedFirst(meta.registry_version)}</div>
        </div>
      </section>

      <section id="new" className="section" style={{ paddingBlockStart: 0 }} aria-labelledby="n-h">
        <div className="wrap">
          <h2 id="n-h" className="h-section">{m.newH}</h2>
          <p className="sub">{m.newSub(monthLabel(newFrom, locale))}</p>
          <div className="grid grid-4">{launches.map(c => <CarCard key={c.id} car={c} locale={locale} />)}</div>
        </div>
      </section>

      <section id="popular" className="section surface" aria-labelledby="pop-h">
        <div className="wrap grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <h2 id="pop-h" className="h-section">{m.popularH}</h2>
            <p className="sub">{m.popularSub(monthLabel(meta.last12_window[0], locale), monthLabel(meta.last12_window[1], locale))}</p>
            <ol className="rank-list">{popular.map(c => (
              <li key={c.id}><Link href={L(`/cars/${c.id}`)}><CarName car={c} locale={locale} /></Link><span className="small tnum">{num(c.registrations!.last12)} {m.regs}</span></li>
            ))}</ol>
          </div>
          <div>
            <h2 className="h-section">{m.gainingH}</h2>
            <p className="sub">{t.car.trend.gaining}</p>
            <ol className="rank-list">{gaining.map(c => (
              <li key={c.id}><Link href={L(`/cars/${c.id}`)}><CarName car={c} locale={locale} /></Link><span className="small tnum">{c.price ? priceShort(c.price.min, locale) : t.state.unknown}</span></li>
            ))}</ol>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="in-h">
        <div className="wrap">
          <h2 id="in-h" className="h-section">{m.insightsH}</h2>
          <div className="grid grid-3" style={{ marginBlockStart: 16 }}>
            <div className="card"><p>{m.insightOfficial(num(official), num(cars.length))}</p></div>
            <div className="card"><p>{m.insightChinese(num(chinese), num(cars.length))}</p></div>
            <div className="card"><p>{m.insightElectrified(num(hybrid), num(ev))}</p></div>
          </div>
          <div className="card" style={{ marginBlockStart: 32, background: 'var(--ci-color-fog)' }}>
            <h2 className="h-section">{m.catalogH}</h2>
            <p className="sub">{m.catalogBody}</p>
            <Link className="btn btn-dark" href={L('/market/catalog')}>{m.catalogCta}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
