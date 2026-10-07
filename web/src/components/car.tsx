import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, price } from '@/lib/format';
import type { Body, PublicCar, PriceState as PS } from '@/lib/vehicles/types';

export const carHref = (locale: Locale, id: string) => `/${locale}/cars/${id}`;

/* Brand before model (Brand V2). In Arabic, Latin model names are bidi-isolated. */
export function CarName({ car, locale }: { car: PublicCar; locale: Locale }) {
  if (locale === 'ar') {
    const brand = car.brand.ar ?? car.brand.en;
    const model = car.model.ar ?? car.model.en;
    return <>{car.brand.ar ? brand : <bdi>{brand}</bdi>} {car.model.ar ? model : <bdi>{model}</bdi>}</>;
  }
  return <>{car.brand.en} {car.model.en}</>;
}
export const carNameText = (car: PublicCar, locale: Locale) =>
  locale === 'ar' ? `${car.brand.ar ?? car.brand.en} ${car.model.ar ?? car.model.en}` : `${car.brand.en} ${car.model.en}`;

const ICON: Record<Body, string> = {
  suv: '/brand/body-family-suv-ink.svg', sedan: '/brand/body-sedan-ink.svg', hatch: '/brand/body-hatchback-ink.svg', mpv: '/brand/body-minivan-ink.svg',
};
export function BodyIcon({ body, className = 'icon' }: { body: Body; className?: string }) {
  return <img className={className} src={ICON[body]} alt="" width={112} height={64} />;
}

/* Photo when the registry maps one to the model; otherwise the neutral body-type icon (never a guessed photo). */
export function CarMedia({ car, locale, eager = false, caption = false }: { car: PublicCar; locale: Locale; eager?: boolean; caption?: boolean }) {
  const t = dict(locale);
  if (!car.image) return <BodyIcon body={car.body} />;
  const img = (
    <img
      className="photo" src={car.image.src} alt={carNameText(car, locale)} loading={eager ? 'eager' : 'lazy'} decoding="async"
      referrerPolicy="no-referrer" data-asset-flags={car.image.flags.join(' ')}
    />
  );
  if (!caption) return img;
  return (
    <figure style={{ width: '100%', height: '100%' }}>
      {img}
      <figcaption>{car.image.flags.includes('EXACT_CAR_UNCONFIRMED') ? t.car.photoNote : null}{car.image.credit ? ` ${car.image.credit}` : ''}</figcaption>
    </figure>
  );
}

export function PriceState({ state, locale }: { state: PS | 'mixed' | 'unknown'; locale: Locale }) {
  return <span className={`state state-${state}`}>{dict(locale).state[state]}</span>;
}

/* Bracket only on figures backed by a dated official source (Brand V2 F2). */
export function PriceFigure({ value, official, locale }: { value: number; official: boolean; locale: Locale }) {
  const p = <span className="price tnum">{price(value, locale)}</span>;
  return official ? <span className="bracket">{p}</span> : p;
}

export function CarPrice({ car, locale }: { car: PublicCar; locale: Locale }) {
  const t = dict(locale);
  if (!car.price) return <PriceState state="unknown" locale={locale} />;
  const minTrim = car.price.trims[0];
  return (
    <>
      <span className="small">{t.car.from}</span>
      <PriceFigure value={car.price.min} official={minTrim.state === 'official'} locale={locale} />
      <PriceState state={minTrim.state} locale={locale} />
    </>
  );
}

export function CarCard({ car, locale, eager = false }: { car: PublicCar; locale: Locale; eager?: boolean }) {
  const t = dict(locale);
  const meta = [t.body[car.body], car.powertrains.map(p => t.pt[p]).join(' / '), car.price ? t.car.versions(car.price.trims.length) : null].filter(Boolean).join(' · ');
  return (
    <Link className="cc" href={carHref(locale, car.id)} data-model-id={car.id}>
      <div className="cc-media"><CarMedia car={car} locale={locale} eager={eager} /></div>
      <div className="cc-body">
        <span className="cc-name"><CarName car={car} locale={locale} /></span>
        <span className="cc-meta">{meta}</span>
        <span className="cc-price"><CarPrice car={car} locale={locale} /></span>
        {car.price ? <span className="small">{date(car.price.asOf, locale)}</span> : null}
      </div>
    </Link>
  );
}
