import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, price } from '@/lib/format';
import type { OfficialPrice, PriceState as PS, PublicCar } from '@/lib/vehicles/types';

export const carHref = (locale: Locale, id: string) => `/${locale}/cars/${id}`;

/* Brand before model (Brand V2). In Arabic, Latin names are bidi-isolated. Arabic display names come from a
   TEMP display crosswalk (non-canonical) until P2 publishes them. */
/* Brand V2: letter-and-number model codes stay in Latin letters inside Arabic (جيتور X70), never transliterated. */
export const isModelCode = (en: string) => !/[a-z]/.test(en);
export const arModel = (car: Pick<PublicCar, 'model'>) => (isModelCode(car.model.en) ? null : car.model.ar);
export function CarName({ car, locale }: { car: PublicCar; locale: Locale }) {
  if (locale === 'ar') {
    const m = arModel(car);
    return <>{car.brand.ar ?? <bdi>{car.brand.en}</bdi>} {m ?? <bdi>{car.model.en}</bdi>}</>;
  }
  return <>{car.brand.en} {car.model.en}</>;
}
export const carNameText = (car: PublicCar, locale: Locale) =>
  locale === 'ar' ? `${car.brand.ar ?? car.brand.en} ${arModel(car) ?? car.model.en}` : `${car.brand.en} ${car.model.en}`;

/* Brand V2 body-type icons (P3 pack); the neutral stand-in when no verified exact-model photo exists. */
const BODY_ICON: Record<string, string> = { suv: 'body-family-suv', sedan: 'body-sedan', hatch: 'body-hatchback', mpv: 'body-minivan' };
export function BodyIcon({ body, className = 'icon' }: { body?: string | null; className?: string }) {
  return <img className={className} src={`/brand/${BODY_ICON[body ?? ''] ?? 'body-compact-crossover'}-ink.svg`} alt="" width={112} height={64} />;
}

/* Verified exact-model photo only (data/registry/media-verified.json). Otherwise a clean "image not available yet"
   treatment with the body-type icon: never a different car, never a generated photo. */
export function CarMedia({ car, locale, eager = false }: { car: PublicCar; locale: Locale; eager?: boolean }) {
  if (!car.image) {
    return (
      <div className="no-photo" role="img" aria-label={`${carNameText(car, locale)} — ${dict(locale).car.noPhoto}`} data-no-photo="true">
        <BodyIcon body={car.body} />
        <span>{dict(locale).car.noPhoto}</span>
      </div>
    );
  }
  return (
    <img className="photo" src={car.image.src} alt={carNameText(car, locale)} loading={eager ? 'eager' : 'lazy'} decoding="async"
      data-verified-photo="true" />
  );
}

export function PriceState({ state, locale }: { state: PS; locale: Locale }) {
  return <span className={`state state-${state}`}>{dict(locale).state[state]}</span>;
}

/* Bracket (F2) only around a single official figure with a named, dated source. Ranges and conflicts never get one. */
export function Figure({ value, checked, locale }: { value: number; checked: boolean; locale: Locale }) {
  const p = <span className="price tnum">{price(value, locale)}</span>;
  return checked ? <span className="bracket">{p}</span> : p;
}

export function OfficialFigure({ o, locale }: { o: OfficialPrice; locale: Locale }) {
  if (o.state === 'checked' && o.value != null) return <Figure value={o.value} checked locale={locale} />;
  if (o.state === 'near' && o.min != null) return <span className="price tnum">{price(o.min, locale)}{o.max != null && o.max !== o.min ? ` – ${price(o.max, locale)}` : ''}</span>;
  if (o.state === 'conflict' && o.values.length) return <span className="price tnum">{o.values.map(v => price(v, locale)).join(' / ')}</span>;
  return <span className="state state-unknown">{dict(locale).state.unknown}</span>;
}

export function PriceFrom({ car, locale }: { car: PublicCar; locale: Locale }) {
  const t = dict(locale), f = car.priceFrom;
  if (f.state === 'checked' && f.value != null) return <><span className="small">{t.car.from}</span><Figure value={f.value} checked locale={locale} /></>;
  if (f.state === 'near' && f.min != null) return <><span className="small">{t.car.from}</span><span className="price tnum">{price(f.min, locale)}{f.max != null && f.max !== f.min ? ` – ${price(f.max, locale)}` : ''}</span></>;
  if (f.state === 'conflict') return <><PriceState state="conflict" locale={locale} />{f.min != null ? <span className="small tnum">{t.v2.lowestQuoted}: {price(f.min, locale)}</span> : null}</>;
  return <span className="price-na">{t.state.unknown}</span>;
}

export function CarCard({ car, locale, eager = false }: { car: PublicCar; locale: Locale; eager?: boolean }) {
  const t = dict(locale);
  const meta = [car.body ? t.body[car.body] : null, car.powertrains.map(p => t.pt[p]).join(' / ')].filter(Boolean).join(' · ');
  return (
    <Link className="cc" href={carHref(locale, car.id)} data-model-id={car.id}>
      <div className="cc-media"><CarMedia car={car} locale={locale} eager={eager} /></div>
      <div className="cc-body">
        <span className="cc-name"><CarName car={car} locale={locale} /></span>
        {meta ? <span className="cc-meta">{meta}</span> : null}
        <span className="cc-price"><PriceFrom car={car} locale={locale} /></span>
      </div>
    </Link>
  );
}
