import 'server-only';
import type { Powertrain, PublicCar } from '@/lib/vehicles/types';
import { brandSlug, vehicles } from './read-model';

export interface CarQuery { brand?: string; min?: number; max?: number; pt?: Powertrain; official?: boolean; sort?: 'popular' | 'price_asc' | 'price_desc'; page?: number }
export const PAGE_SIZE = 24;
const PTS: Powertrain[] = ['ice', 'hybrid', 'phev', 'reev', 'ev'];
const int = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n) : undefined; };

/* Parse untrusted query params into a closed set of values (server-side validation). */
export function parseCarQuery(sp: Record<string, string | string[] | undefined>): CarQuery {
  const one = (k: string) => { const v = sp[k]; return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined; };
  const pt = one('pt') as Powertrain; const sort = one('sort'); const brand = one('brand');
  return {
    brand: brand && /^[a-z0-9-]{1,40}$/.test(brand) ? brand : undefined,
    min: int(one('min')), max: int(one('max')),
    pt: PTS.includes(pt) ? pt : undefined,
    official: one('official') === '1',
    sort: sort === 'price_asc' || sort === 'price_desc' ? sort : 'popular',
    page: Math.max(1, Math.min(100, int(one('page')) || 1)),
  };
}

/* Price filters use the lowest figure the sources give (priceFrom.sortValue). Unknown prices are excluded from price filters. */
export function queryCars(q: CarQuery): { items: PublicCar[]; total: number; pages: number } {
  let list = vehicles().all().filter(c => {
    const p = c.priceFrom.sortValue;
    return (!q.brand || brandSlug(c.brand.en) === q.brand) && (!q.pt || c.powertrains.includes(q.pt)) &&
      (!q.official || c.priceFrom.state === 'checked') &&
      (q.min == null || (p != null && p >= q.min)) && (q.max == null || (p != null && p <= q.max));
  });
  const reg = (c: PublicCar) => c.registrations?.inWindow ?? -1;
  const p = (c: PublicCar) => c.priceFrom.sortValue ?? Number.MAX_SAFE_INTEGER;
  list = [...list].sort(q.sort === 'price_asc' ? (a, b) => p(a) - p(b) || a.id.localeCompare(b.id)
    : q.sort === 'price_desc' ? (a, b) => (b.priceFrom.sortValue ?? -1) - (a.priceFrom.sortValue ?? -1) || a.id.localeCompare(b.id)
    : (a, b) => reg(b) - reg(a) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(q.page || 1, pages);
  return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: list.length, pages };
}

/* Nearest-price models for side-by-side comparison. Presentation helper, not a recommendation. */
export function alternatives(car: PublicCar, n = 3): PublicCar[] {
  const base = car.priceFrom.sortValue;
  if (base == null) return [];
  return vehicles().all().filter(c => c.id !== car.id && c.priceFrom.sortValue != null)
    .sort((a, b) => Math.abs(a.priceFrom.sortValue! - base) - Math.abs(b.priceFrom.sortValue! - base) || a.id.localeCompare(b.id)).slice(0, n);
}
