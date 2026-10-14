import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import logos from '@data/registry/brand-logos.json';
import type { BrandSummary } from '@/lib/vehicles/types';
import { brandLogos } from '@/server/vehicles/read-model';

type Logo = { title: string; path: string };
const LOGOS = logos.brands as Record<string, Logo>;
export const hasLogo = (id: string) => Boolean(LOGOS[id] || brandLogos[id]);
export const brandName = (b: Pick<BrandSummary, 'en' | 'ar'>, locale: Locale) => (locale === 'ar' ? b.ar ?? b.en : b.en);

/* Alphabetical brand order: English A–Z; Arabic by Arabic collation of the Arabic name (Latin-only names follow). */
export function sortBrands<T extends Pick<BrandSummary, 'en' | 'ar'>>(list: T[], locale: Locale): T[] {
  const col = new Intl.Collator(locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base' });
  return [...list].sort((a, b) => col.compare(brandName(a, locale), brandName(b, locale)) || a.en.localeCompare(b.en));
}

/* Brand mark: the verified ink emblem (simple-icons, CC0; data/registry/brand-logos.json) where one exists, otherwise the
   P2-accepted official logo file (catalogue serving release accepted.logo). Brands with neither show their name only:
   no guessed, recoloured or initial-letter logos. */
export function BrandMark({ id, label, size = 32 }: { id: string; label: string; size?: number }) {
  const logo = LOGOS[id];
  if (!logo) {
    const p2 = brandLogos[id];
    if (!p2) return null;
    const u = (w: number) => `/_next/image?url=${encodeURIComponent(p2.src)}&w=${w}&q=85`;
    return <img className={`brand-mark brand-mark-img${p2.onInk ? ' on-ink' : ''}`} src={p2.src} srcSet={`${u(128)} 1x, ${u(256)} 2x`} alt={label} height={size} width={Math.round(size * 1.75)}
      loading="lazy" decoding="async" data-brand-logo={id} data-logo-source="p2" />;
  }
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label} data-brand-logo={id}>
      <path d={logo.path} fill="currentColor" />
    </svg>
  );
}

export function BrandGrid({ brands, locale, limit }: { brands: BrandSummary[]; locale: Locale; limit?: number }) {
  const t = dict(locale);
  const list = sortBrands(brands, locale).slice(0, limit ?? brands.length);
  return (
    <ul className="brand-grid" data-brand-order={locale}>
      {list.map(b => {
        const name = brandName(b, locale);
        return (
          <li key={b.id}>
            <Link className={`brand-chip${hasLogo(b.id) ? '' : ' no-logo'}`} href={`/${locale}/market/catalog?brand=${b.id}`} data-brand-id={b.id} data-count={b.count}>
              <BrandMark id={b.id} label={b.en} />
              <b>{locale === 'ar' && !b.ar ? <bdi>{name}</bdi> : name}</b>
              <span className="tnum">{t.market.models(b.count)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
