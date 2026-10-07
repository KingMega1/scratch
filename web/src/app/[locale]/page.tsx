import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, num } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { content } from '@/server/cms/provider';
import { CarCard, CarName, OfficialFigure, PriceState } from '@/components/car';

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '', dict(locale).nav.home, dict(locale).home.lede);
}

export default async function Home({ params }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), h = t.home;
  const V = vehicles();
  const cars = V.all();
  const official = cars.filter(c => c.priceFrom.state === 'checked').length;
  const reg = (c: (typeof cars)[number]) => c.registrations?.inWindow ?? -1;
  const marketNow = [...cars].sort((a, b) => reg(b) - reg(a)).slice(0, 4);
  const brands = V.brands().slice(0, 8);
  const exCar = marketNow.find(c => c.trims.some(x => x.official.state === 'checked')) ?? cars.find(c => c.trims.some(x => x.official.state === 'checked'));
  const exTrim = exCar?.trims.find(x => x.official.state === 'checked');
  const example = exCar && exTrim ? { car: exCar, trim: exTrim } : null;
  const items = (await content().list({ includeDrafts: true })).slice(0, 3);

  return (
    <>
      <section className="hero inverse" aria-labelledby="hero-h">
        {/* Hero photo: correct-generation Nissan Patrol placeholder; flagged for P2 replacement. */}
        <img className="hero-img" src="/media/patrol.png" alt="" fetchPriority="high" data-asset-flags="TEMP_UNVERIFIED EXACT_CAR_UNCONFIRMED PHOTO_NEEDS_ENRICHMENT WATERMARK_CROPPED" />
        <div className="wrap hero-content">
          <p className="kicker">{h.kicker}</p>
          <h1 id="hero-h" className="display">{h.h1}</h1>
          <p className="lede">{h.lede}</p>
          <div className="ctas">
            <Link className="btn btn-primary" href={`/${locale}/find-my-car`} data-cta="hero_fmc">{h.ctaFmc}</Link>
            <Link className="btn btn-on-dark" href={`/${locale}/cars`} data-cta="hero_cars">{h.ctaCars}</Link>
          </div>
          <p className="proof tnum">{h.proof(num(cars.length), num(official))}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="why-h">
        <div className="wrap">
          <h2 id="why-h" className="h-section">{h.whyH}</h2>
          <p className="sub">{h.whySub}</p>
          <div className="grid grid-3">
            {h.why.map(([title, body]) => (<div className="card" key={title}><h3>{title}</h3><p>{body}</p></div>))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBlockStart: 0 }} aria-labelledby="paths-h">
        <div className="wrap">
          <h2 id="paths-h" className="h-section">{h.pathsH}</h2>
          <div className="grid grid-2" style={{ marginBlockStart: 16 }}>
            <div className="path dark inverse">
              <div><div className="k">{h.pathFmcK}</div><h3>{h.pathFmcH}</h3></div>
              <div><Link className="btn btn-primary" href={`/${locale}/find-my-car`}>{h.pathFmcCta}</Link></div>
            </div>
            <div className="path light">
              <div><div className="k">{h.pathCarsK}</div><h3>{h.pathCarsH(num(cars.length))}</h3></div>
              <div><Link className="btn btn-dark" href={`/${locale}/cars`}>{h.pathCarsCta}</Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section surface" aria-labelledby="mn-h">
        <div className="wrap">
          <h2 id="mn-h" className="h-section">{h.marketH}</h2>
          <p className="sub">{h.marketSub}</p>
          <div className="grid grid-4">{marketNow.map(c => <CarCard key={c.id} car={c} locale={locale} />)}</div>
          <p style={{ marginBlockStart: 20 }}><Link className="link" href={`/${locale}/market`}>{t.nav.market} →</Link></p>
        </div>
      </section>

      <section className="section" aria-labelledby="disc-h">
        <div className="wrap">
          <h2 id="disc-h" className="h-section">{t.market.brandsH}</h2>
          <div className="strip" style={{ marginBlockStart: 16 }}>
            {brands.map(b => (
              <Link key={b.id} className="body-tile" href={`/${locale}/cars?brand=${b.id}`}>
                <b>{locale === 'ar' ? b.ar ?? <bdi>{b.en}</bdi> : b.en}</b>
                <span className="n tnum">{t.market.models(b.count)}</span>
              </Link>
            ))}
          </div>
          <div className="chips" style={{ marginBlockStart: 16 }}>
            {t.bands.map(b => (
              <Link key={b.key} className="chip" href={`/${locale}/cars?${new URLSearchParams({ ...(b.min != null ? { min: String(b.min) } : {}), ...(b.max != null ? { max: String(b.max) } : {}) })}`}>{b.label}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBlockStart: 0 }} aria-labelledby="news-h">
        <div className="wrap">
          <h2 id="news-h" className="h-section">{h.newsH}</h2>
          <div className="grid grid-3" style={{ marginBlockStart: 16 }}>
            {items.map(c => (
              <Link key={c.slug} className="news-card" href={`/${locale}/news/${c.slug}`}>
                <span className="tag">{t.news.types[c.type]}</span>
                {c.status === 'draft' ? <span className="tag tag-draft">{t.news.draft}</span> : null}
                <h3>{c.title[locale]}</h3>
                <p>{c.summary[locale]}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section surface" aria-labelledby="method-h">
        <div className="wrap">
          <h2 id="method-h" className="h-section">{h.methodH}</h2>
          <p className="sub">{h.methodBody}</p>
          {example ? (
            <p className="card" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Link className="link" href={`/${locale}/cars/${example.car.id}`}><CarName car={example.car} locale={locale} /> · <bdi>{example.trim.label}</bdi></Link>
              <OfficialFigure o={example.trim.official} locale={locale} />
              <PriceState state="checked" locale={locale} />
              <span className="small">{example.trim.official.sources.map(x => x.name).join(', ')} · {date(example.trim.official.sources[0]?.observedAt ?? '', locale)}</span>
            </p>
          ) : null}
          <div style={{ marginBlockStart: 16 }} />
          <Link className="btn btn-ghost" href={`/${locale}/methodology`}>{h.methodCta}</Link>
        </div>
      </section>
    </>
  );
}
