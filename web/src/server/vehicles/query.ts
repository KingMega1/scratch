import 'server-only';
import type { Body, Powertrain, PublicCar } from '@/lib/vehicles/types';
import { vehicles } from './read-model';

export interface CarQuery { body?: Body; brand?: string; min?: number; max?: number; pt?: Powertrain; official?: boolean; sort?: 'popular' | 'price_asc' | 'price_desc'; page?: number }
export const PAGE_SIZE = 24;
const BODIES: Body[] = ['suv', 'sedan', 'hatch', 'mpv'];
const PTS: Powertrain[] = ['petrol', 'hybrid', 'ev'];
const int = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n) : undefined; };

/* Parse untrusted query params into a closed set of values (server-side validation). */
export function parseCarQuery(sp: Record<string, string | string[] | undefined>): CarQuery {
  const one = (k: string) => { const v = sp[k]; return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined; };
  const body = one('body') as Body; const pt = one('pt') as Powertrain; const sort = one('sort');
  const brand = one('brand');
  return {
    body: BODIES.includes(body) ? body : undefined,
    brand: brand && /^[a-z0-9-]{1,40}$/.test(brand) ? brand : undefined,
    min: int(one('min')), max: int(one('max')),
    pt: PTS.includes(pt) ? pt : undefined,
    official: one('official') === '1',
    sort: sort === 'price_asc' || sort === 'price_desc' ? sort : 'popular',
    page: Math.max(1, Math.min(100, int(one('page')) || 1)),
  };
}

export function queryCars(q: CarQuery): { items: PublicCar[]; total: number; pages: number } {
  let list = vehicles().all().filter(c =>
    (!q.body || c.body === q.body) && (!q.brand || c.brandId === q.brand) && (!q.pt || c.powertrains.includes(q.pt)) &&
    (!q.official || !!c.price?.trims.some(t => t.state === 'official')) &&
    (q.min == null || (c.price && c.price.max >= q.min)) && (q.max == null || (c.price && c.price.min <= q.max)));
  const reg = (c: PublicCar) => c.registrations?.last12 ?? -1;
  const p = (c: PublicCar) => c.price?.min ?? Number.MAX_SAFE_INTEGER;
  list = [...list].sort(q.sort === 'price_asc' ? (a, b) => p(a) - p(b) || a.id.localeCompare(b.id)
    : q.sort === 'price_desc' ? (a, b) => (b.price?.min ?? -1) - (a.price?.min ?? -1) || a.id.localeCompare(b.id)
    : (a, b) => reg(b) - reg(a) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(q.page || 1, pages);
  return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: list.length, pages };
}

/* Nearest-price alternatives in the same body type. Presentation helper, not a recommendation. */
export function alternatives(car: PublicCar, n = 3): PublicCar[] {
  if (!car.price) return [];
  const base = car.price.min;
  return vehicles().all().filter(c => c.id !== car.id && c.body === car.body && c.price)
    .sort((a, b) => Math.abs(a.price!.min - base) - Math.abs(b.price!.min - base) || a.id.localeCompare(b.id)).slice(0, n);
}
