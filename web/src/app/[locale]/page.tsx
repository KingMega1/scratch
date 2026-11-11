import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { showDrafts } from '@/lib/deploy-env';
import { vehicles } from '@/server/vehicles/read-model';
import { content } from '@/server/cms/provider';
import { CarCard, CarName, carNameText, photoSrcSet } from '@/components/car';
import { BrandMark, hasLogo, sortBrands } from '@/components/brand';

type P = { params: Promise<{ locale: string }> };

/* Evidence (P2 3b4b5ef, revision ad4cc5e906b4):
   mg-rx9     first registered Aug 2026 (72 in the Sep 2025–Aug 2026 window); Tier A, Al Mansour / MG Egypt list (15 Oct 2026)
   byd-ti-7   first registered May 2026 (476);  Tier A MY2027, BYD Egypt / Mandream list (22 Oct 2026)
   geely-ex2  first registered Apr 2026 (328);  Tier A MY2027, Abou Ghaly Motors list (18 Oct 2026)
   Each has an accepted HQ exact-model, current-generation hero photo (P2 media acceptance). */
const FEATURED_LAUNCHES = ['mg-rx9', 'byd-ti-7', 'geely-ex2'] as const;

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
  const reg = (c: (typeof cars)[number]) => c.registrations?.inWindow ?? -1;
  // "Car prices" shows cars that actually have a price (most registered first); unknown prices are not featured.
  const marketNow = [...cars].filter(c => c.priceFrom.state !== 'unknown').sort((a, b) => reg(b) - reg(a)).slice(0, 4);
  const brands = sortBrands(V.brands(), locale);
  // First fold: recent Egypt-market launches (CEO 5 Nov), each with accepted P2 evidence — first Egypt registration in the
  // current window with real volume, an official (Tier A) MY2027/current list price and an accepted exact-model photo.
  // Upcoming models without a confirmed launch are never featured. Newest first registration first.
  const heroCars = FEATURED_LAUNCHES.map(id => V.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c?.image && c.priceFrom.state === 'checked' && c.priceFrom.isOfficial !== false);
  const items = (await content().list({ includeDrafts: showDrafts() })).slice(0, 3);

  return (
    <>
      <section className="hero hero-v2 inverse" aria-labelledby="hero-h">
        <div className="wrap hero-grid">
          <div className="hero-content">
            <h1 id="hero-h" className="display">{h.h1}</h1>
            <p className="lede">{h.lede}</p>
            <div className="ctas">
              <Link prefetch={false} className="btn btn-primary btn-lg" href={`/${locale}/find-my-car`} data-cta="hero_fmc">{h.ctaFmc}</Link>
              <Link prefetch={false} className="btn btn-on-dark" href={`/${locale}/market/catalog`} data-cta="hero_cars">{h.ctaCars}</Link>
            </div>
          </div>
          {heroCars.length ? (
            <ul className="hero-cars" aria-label={t.nav.cars}>
              {heroCars.map((c, i) => (
                <li key={c.id}>
                  <Link prefetch={false} href={`/${locale}/cars/${c.id}`} data-hero-car={c.id}>
                    <img src={c.image!.src} srcSet={photoSrcSet(c.image!.src)} sizes="(max-width: 720px) 45vw, 300px" alt={carNameText(c, locale)} width={640} height={400} fetchPriority={i === 0 ? 'high' : 'auto'} data-verified-photo="true" />
                    <span><CarName car={c} locale={locale} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="section" aria-labelledby="why-h">
        <div className="wrap">
          <h2 id="why-h" className="h-section">{h.whyH}</h2>
          <div className="grid grid-3">
            {h.why.map(([title, body]) => (<div className="card" key={title}><h3>{title}</h3><p>{body}</p></div>))}
          </div>
        </div>
      </section>

      <section className="section surface" aria-labelledby="mn-h">
        <div className="wrap">
          <h2 id="mn-h" className="h-section">{h.marketH}</h2>
          <p className="sub">{h.marketSub}</p>
          <div className="grid grid-4">{marketNow.map(c => <CarCard key={c.id} car={c} locale={locale} />)}</div>
          <p style={{ marginBlockStart: 20 }}><Link prefetch={false} className="link" href={`/${locale}/market/catalog`}>{t.market.catalogCta} →</Link></p>
        </div>
      </section>

      <section className="section" aria-labelledby="disc-h">
        <div className="wrap">
          <h2 id="disc-h" className="h-section">{t.market.brandsH}</h2>
          <ul className="strip brand-strip" style={{ marginBlockStart: 16 }} data-brand-order={locale}>
            {brands.map(b => (
              <li key={b.id}>
                <Link prefetch={false} className="body-tile" href={`/${locale}/market/catalog?brand=${b.id}`} data-brand-id={b.id}>
                  <span className="bt-logo" aria-hidden={hasLogo(b.id) ? undefined : 'true'} data-logo={hasLogo(b.id) ? 'yes' : 'none'}><BrandMark id={b.id} label={b.en} /></span>
                  <b className="bt-name">{locale === 'ar' ? b.ar ?? <bdi>{b.en}</bdi> : b.en}</b>
                  <span className="n tnum">{t.market.models(b.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="chips" style={{ marginBlockStart: 16 }}>
            {t.bands.map(b => (
              <Link prefetch={false} key={b.key} className="chip" href={`/${locale}/cars?${new URLSearchParams({ ...(b.min != null ? { min: String(b.min) } : {}), ...(b.max != null ? { max: String(b.max) } : {}) })}`}>{b.label}</Link>
            ))}
          </div>
        </div>
      </section>

      {items.length ? (
      <section className="section" style={{ paddingBlockStart: 0 }} aria-labelledby="news-h">
        <div className="wrap">
          <h2 id="news-h" className="h-section">{h.newsH}</h2>
          <div className="grid grid-3" style={{ marginBlockStart: 16 }}>
            {items.map(c => (
              <Link prefetch={false} key={c.slug} className="news-card" href={`/${locale}/news/${c.slug}`}>
                <span className="tag">{t.news.types[c.type]}</span>
                {c.status === 'draft' ? <span className="tag tag-draft">{t.news.draft}</span> : null}
                <h3>{c.title[locale]}</h3>
                <p>{c.summary[locale]}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      ) : null /* no published editorial yet (drafts are preview-only) */}

    </>
  );
}
