import 'server-only';
import snapshot from '@data/registry/universe.snapshot.json';
import type { AssetFlag, Body, BrandSummary, Powertrain, PublicCar, PublicImage, PublicTrim, RegistryMeta } from '@/lib/vehicles/types';

/* Serving read model.
   Canonical truth: GitHub accepted vehicle view (see data/registry/sync-manifest.json for commit + sha256).
   S1 adapter: the deterministic JSON projection produced by scripts/sync-vehicle-data.mjs.
   S2 adapter: PostgreSQL read model loaded by the same sync (schema in db/read-model.sql). Same interface.
   This module is read-only; nothing in the website can write vehicle truth. */

export interface VehicleReadModel {
  meta(): RegistryMeta;
  all(): PublicCar[];
  get(id: string): PublicCar | null;
  brands(): BrandSummary[];
}

type RawTrim = { label?: string; min: number; year?: number; official?: boolean; date?: string; pt?: string | null };
type RawModel = {
  id: string; brand_id: string; brand: string; model: string; ar?: { brand?: string[]; model?: string[] };
  origin?: string; chinese?: boolean; body: string; segment?: string; powertrains?: (string | null)[];
  warranty?: string[]; warranty_years?: number; warranty_verified?: boolean; model_year?: number;
  image?: { src: string; credit?: string; page?: string }; awd?: boolean; hp?: number[]; seats?: number[]; distributor?: string;
  reg?: { since_2021: number; last12: number; trend?: string | null; first_month?: string; yearly?: Record<string, number>; rank_in_body_last12?: number; of_body?: number };
  u?: boolean; trims: RawTrim[];
};

/* Curated temporary assets (until P2 delivers official exact-car imagery).
   Patrol: correct generation (Y63), source watermark is cropped by layout. Not a verified exact-trim match. */
const LOCAL_ASSETS: Record<string, PublicImage> = {
  'nissan/patrol': {
    src: '/media/patrol.png', credit: null, sourcePage: null,
    flags: ['TEMP_UNVERIFIED', 'EXACT_CAR_UNCONFIRMED', 'PHOTO_NEEDS_ENRICHMENT', 'WATERMARK_CROPPED'],
  },
};

const PT: Powertrain[] = ['petrol', 'hybrid', 'ev'];
const asPt = (x: unknown): Powertrain | null => (PT.includes(x as Powertrain) ? (x as Powertrain) : null);
const TRENDS = ['gaining', 'steady', 'declining', 'new'] as const;

function shapeTrims(m: RawModel): PublicTrim[] {
  const priced = m.trims.filter(t => t.min > 0);
  if (!priced.length) return [];
  const year = Math.max(...priced.map(t => t.year || 0));
  const seen = new Set<string>();
  const out: PublicTrim[] = [];
  for (const t of priced.filter(t => (t.year || 0) === year).sort((a, b) => a.min - b.min)) {
    const label = (t.label || '').trim() || '—';
    const key = `${label.toLowerCase()}|${t.min}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, price: t.min, year, state: t.official ? 'official' : 'listing', date: t.date || '', powertrain: asPt(t.pt) ?? (m.powertrains?.length === 1 ? asPt(m.powertrains[0]) : null) });
  }
  return out;
}

function shape(m: RawModel): PublicCar {
  const trims = shapeTrims(m);
  const states = new Set(trims.map(t => t.state));
  const image: PublicImage | null = LOCAL_ASSETS[m.id] ?? (m.image ? {
    src: m.image.src, credit: m.image.credit ?? null, sourcePage: m.image.page ?? null,
    // Scraped community photos: mapped to the right model by the registry, generation/trim not verified.
    flags: ['TEMP_UNVERIFIED', 'EXACT_CAR_UNCONFIRMED', 'PHOTO_NEEDS_ENRICHMENT'] as AssetFlag[],
  } : null);
  const trend = m.reg?.trend && (TRENDS as readonly string[]).includes(m.reg.trend) ? (m.reg.trend as NonNullable<PublicCar['registrations']>['trend']) : null;
  return {
    id: m.id,
    brandId: m.brand_id,
    brand: { en: m.brand, ar: m.ar?.brand?.[0] ?? null },
    model: { en: m.model, ar: m.ar?.model?.[0] ?? null },
    body: (['suv', 'sedan', 'hatch', 'mpv'].includes(m.body) ? m.body : 'sedan') as Body,
    segment: m.segment || null,
    origin: m.origin || null,
    chineseBrand: !!m.chinese,
    powertrains: [...new Set((m.powertrains || []).map(asPt).filter((x): x is Powertrain => !!x))],
    modelYear: m.model_year ?? null,
    hp: m.hp?.length ? m.hp : null,
    seats: m.seats?.length ? m.seats : null,
    awdConfirmed: m.awd === true,
    warranty: m.warranty?.length || m.warranty_years ? { text: m.warranty?.[0] ?? null, years: m.warranty_years ?? null, verified: !!m.warranty_verified } : null,
    distributor: m.distributor ?? null,
    price: trims.length ? {
      min: trims[0].price, max: trims[trims.length - 1].price,
      state: states.size > 1 ? 'mixed' : [...states][0],
      asOf: trims.map(t => t.date).sort().at(-1) || '',
      trims,
    } : null,
    registrations: m.reg ? {
      last12: m.reg.last12, since2021: m.reg.since_2021, trend,
      firstMonth: m.reg.first_month ?? null, rankInBody: m.reg.rank_in_body_last12 ?? null, ofBody: m.reg.of_body ?? null,
      yearly: m.reg.yearly ?? {},
    } : null,
    image,
  };
}

class JsonSnapshotReadModel implements VehicleReadModel {
  private cars: PublicCar[];
  private byId: Map<string, PublicCar>;
  private brandList: BrandSummary[];
  constructor(private snap: { meta: RegistryMeta; models: RawModel[] }) {
    // Only models accepted into the public universe are served.
    this.cars = snap.models.filter(m => m.u).map(shape);
    this.byId = new Map(this.cars.map(c => [c.id, c]));
    const b = new Map<string, BrandSummary>();
    for (const c of this.cars) {
      const x = b.get(c.brandId) ?? { id: c.brandId, en: c.brand.en, ar: c.brand.ar, count: 0, registrationsLast12: 0 };
      x.count++; x.registrationsLast12 += c.registrations?.last12 ?? 0;
      b.set(c.brandId, x);
    }
    this.brandList = [...b.values()].sort((x, y) => y.registrationsLast12 - x.registrationsLast12 || x.en.localeCompare(y.en));
  }
  meta() { return this.snap.meta; }
  all() { return this.cars; }
  get(id: string) { return this.byId.get(id) ?? null; }
  brands() { return this.brandList; }
}

let instance: VehicleReadModel | null = null;
export function vehicles(): VehicleReadModel {
  if (!instance) instance = new JsonSnapshotReadModel(snapshot as unknown as { meta: RegistryMeta; models: RawModel[] });
  return instance;
}

/* Raw registry access for the P1 engine adapter only (engine needs the universe it was built for). Never exposed. */
export function rawUniverseForEngine(): { meta: { version: string }; models: RawModel[] } {
  const s = snapshot as unknown as { meta: RegistryMeta; models: RawModel[] };
  return { meta: { version: s.meta.registry_version }, models: s.models };
}
