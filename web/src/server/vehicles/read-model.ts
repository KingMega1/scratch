import 'server-only';
import snapshot from '@data/registry/universe.snapshot.json';
import crosswalk from '@data/registry/display-crosswalk.TEMP.json';
import type { AssetFlag, BrandSummary, OfficialPrice, PriceChange, PriceState, Powertrain, PublicCar, PublicImage, PublicTrim, RegistryMeta, SpecValue } from '@/lib/vehicles/types';

/* Serving read model.
   Canonical: KingMega1/scratch vehicle-data/views/p1_suv_2m.json (carindex.p1.buyer_view/v2) at the commit pinned in
   data/registry/sync-manifest.json. GitHub accepted vehicle truth wins over any projection.
   S1 adapter: deterministic JSON projection (scripts/sync-vehicle-data.mjs). S2: Postgres read model, same interface.
   Read-only: nothing in the website writes vehicle truth. No value is averaged or imputed here. */

export interface VehicleReadModel {
  meta(): RegistryMeta;
  all(): PublicCar[];
  get(id: string): PublicCar | null;
  brands(): BrandSummary[];
  priceHistory(): { snapshots: string[]; latest: string; changes: Record<string, number> };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

const SOURCE_NAME: Record<string, string> = { contactcars: 'ContactCars', egycar: 'EgyCar', hatla2ee: 'Hatla2ee' };
const srcName = (s: string) => SOURCE_NAME[s?.toLowerCase?.()] ?? s;
const PT: Record<string, Powertrain> = { ICE: 'ice', Hybrid: 'hybrid', HEV: 'hybrid', PHEV: 'phev', REEV: 'reev', BEV: 'ev' };

function official(o: Raw): OfficialPrice {
  const obs: Raw[] = o?.observations ?? [];
  const sources = obs.filter(x => x.value_status === 'OK' || x.value != null).map(x => ({
    name: x.source, url: x.url ?? null, observedAt: (x.observed_at || '').slice(0, 10), effectiveDate: x.source_effective_date ?? null,
  }));
  const base = { values: [] as number[], agreedBySources: (o?.sources ?? []).length, sources };
  switch (o?.status) {
    case 'AGREED':
    case 'SINGLE_SOURCE':
      return o.value != null ? { ...base, state: 'checked', value: o.value, min: null, max: null } : { ...base, state: 'unknown', value: null, min: null, max: null };
    case 'NEAR_AGREEMENT':
      return { ...base, state: 'near', value: null, min: o.value_min ?? null, max: o.value_max ?? null };
    case 'CONFLICT': {
      const values = [...new Set<number>((o.conflicting_values ?? []).filter((v: unknown) => typeof v === 'number'))].sort((a, b) => a - b);
      return { ...base, state: 'conflict', value: null, min: values[0] ?? null, max: values.at(-1) ?? null, values };
    }
    default:
      return { ...base, state: 'unknown', value: null, min: null, max: null };
  }
}

function trim(t: Raw, modelYear: number | null): PublicTrim {
  const m = (t.market_observations ?? []).find((x: Raw) => typeof x.value === 'number');
  return {
    key: t.trim_key, label: (t.labels?.[0] ?? t.trim_key) as string, modelYear,
    official: official(t.official),
    market: m ? { value: m.value, source: m.source, observedAt: (m.observed_at || '').slice(0, 10) } : null,
  };
}
const trimSort = (a: PublicTrim, b: PublicTrim) =>
  (a.official.value ?? a.official.min ?? Infinity) - (b.official.value ?? b.official.min ?? Infinity) || a.label.localeCompare(b.label);

function priceFrom(p: Raw): PublicCar['priceFrom'] {
  const f = p?.price_from;
  if (!f) return { state: 'unknown', value: null, min: null, max: null, sortValue: null, modelYear: null };
  if (f.status === 'RESOLVED') return { state: 'checked', value: f.value, min: null, max: null, sortValue: f.value, modelYear: f.model_year ?? null };
  if (f.status === 'RESOLVED_RANGE') return { state: 'near', value: null, min: f.value_min, max: f.value_max, sortValue: f.value_min, modelYear: f.model_year ?? null };
  if (f.status === 'CONFLICT') return { state: 'conflict', value: null, min: f.candidate_min ?? null, max: null, sortValue: f.candidate_min ?? null, modelYear: f.model_year ?? null };
  return { state: 'unknown', value: null, min: null, max: null, sortValue: null, modelYear: null };
}

function changes(m: Raw): PriceChange[] {
  const out: PriceChange[] = [];
  for (const c of m.price?.source_stated_changes?.changes ?? []) {
    if (typeof c.old_official !== 'number' || typeof c.new_official !== 'number') continue;
    out.push({ modelYear: c.model_year ?? null, trim: c.trim_label ?? c.trim_key, from: c.old_official, to: c.new_official, effectiveDate: c.effective_date, source: c.source, url: c.url ?? null, kind: 'stated' });
  }
  for (const co of m.price?.cohorts ?? []) for (const t of co.trims ?? []) for (const h of t.history ?? []) {
    if (h.change !== 'CHANGED' || h.price_type !== 'official') continue; // market moves are reported separately, never as official
    out.push({ modelYear: co.model_year ?? null, trim: t.labels?.[0] ?? t.trim_key, from: h.prev.value, to: h.latest.value, effectiveDate: (h.latest.observed_at || '').slice(0, 10), source: srcName(h.source), url: null, kind: 'observed' });
  }
  return out.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.trim.localeCompare(b.trim));
}

const SPEC_KEYS = ['horsepower', 'torque', 'engine_capacity', 'transmission', 'drive_type', 'seats', 'trunk_capacity', 'fuel_consumption', 'length', 'wheelbase', 'battery_capacity', 'electric_range', 'warranty'];
function specs(m: Raw): Record<string, SpecValue> {
  const out: Record<string, SpecValue> = {};
  const attrs = m.specs?.attributes ?? {};
  for (const k of SPEC_KEYS) {
    const a = attrs[k];
    if (!a || a.status === 'MISSING' || !a.values?.length) continue;
    out[k] = { multiple: a.status === 'MULTIPLE_VALUES', values: a.values.map((v: Raw) => ({ value: String(v.value), sources: v.sources ?? [] })) };
  }
  return out;
}

function shape(m: Raw): PublicCar {
  const cohorts: Raw[] = m.price?.cohorts ?? [];
  const latestYear = m.price?.latest_priced_cohort ?? null;
  const latest = cohorts.find(c => c.model_year === latestYear) ?? null;
  const reg = m.registration;
  const cw = (crosswalk.map as Record<string, Raw>)[m.slug];
  const image: PublicImage | null = cw?.image ? {
    src: cw.image.src, credit: cw.image.credit ?? null, sourcePage: cw.image.page ?? null,
    flags: ['TEMP_UNVERIFIED', 'EXACT_CAR_UNCONFIRMED', 'PHOTO_NEEDS_ENRICHMENT'] as AssetFlag[],
  } : null;
  const lastObserved = (m.freshness?.price_snapshots ?? []).filter((s: Raw) => s.model_observed).map((s: Raw) => s.observed_at).sort().at(-1) ?? null;
  return {
    id: m.slug,
    brand: { en: m.brand, ar: cw?.ar?.brand ?? null },
    model: { en: m.model, ar: cw?.ar?.model ?? null },
    inSlice: !!m.in_slice,
    priceFrom: priceFrom(m.price),
    trims: latest ? latest.trims.map((t: Raw) => trim(t, latest.model_year)).sort(trimSort) : [],
    otherCohorts: cohorts.filter(c => c !== latest).map(c => ({ modelYear: c.model_year ?? null, trims: (c.trims ?? []).map((t: Raw) => trim(t, c.model_year)).sort(trimSort) }))
      .filter(c => c.trims.length).sort((a, b) => (b.modelYear ?? 0) - (a.modelYear ?? 0)),
    changes: changes(m),
    specs: specs(m),
    powertrains: [...new Set(Object.keys(reg?.powertrain_mix_in_window ?? {}).map(k => PT[k]).filter(Boolean))],
    registrations: reg ? {
      inWindow: reg.registrations_in_window ?? null, rank: reg.rank_in_slice ?? null, ranked: reg.slice_models_ranked ?? null,
      share: reg.share_of_slice_registrations ?? null,
      yoy: reg.momentum?.yoy_suppressed_reason ? null : reg.momentum?.yoy_change ?? null, yoyCaveat: reg.momentum?.caveat ?? null,
      firstSeen: reg.first_seen_month ?? null,
      window: reg.window ? [reg.window.start, reg.window.end] : null, monthsMissing: reg.window?.months_missing ?? [],
      monthly: Object.entries(reg.monthly ?? {}).map(([month, count]) => ({ month, count: count as number })).sort((a, b) => a.month.localeCompare(b.month)),
    } : null,
    gaps: (m.gaps ?? []).map((g: Raw) => g.type ?? g.code ?? String(g)),
    conflicts: (m.conflicts ?? []).length,
    lastObserved,
    image,
  };
}

const brandId = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

class JsonSnapshotReadModel implements VehicleReadModel {
  private cars: PublicCar[];
  private byId: Map<string, PublicCar>;
  private brandList: BrandSummary[];
  constructor(private snap: { meta: RegistryMeta; view: Raw }) {
    this.cars = snap.view.models.map(shape);
    this.byId = new Map(this.cars.map(c => [c.id, c]));
    const b = new Map<string, BrandSummary>();
    for (const c of this.cars) {
      const id = brandId(c.brand.en);
      const x = b.get(id) ?? { id, en: c.brand.en, ar: c.brand.ar, count: 0, registrations: 0 };
      x.count++; x.registrations += c.registrations?.inWindow ?? 0;
      b.set(id, x);
    }
    this.brandList = [...b.values()].sort((x, y) => y.registrations - x.registrations || x.en.localeCompare(y.en));
  }
  meta() { return this.snap.meta; }
  all() { return this.cars; }
  get(id: string) { return this.byId.get(id) ?? null; }
  brands() { return this.brandList; }
  priceHistory() { const h = this.snap.view.price_history; return { snapshots: h.snapshots, latest: h.latest, changes: h.changes }; }
}

let instance: VehicleReadModel | null = null;
export function vehicles(): VehicleReadModel {
  if (!instance) instance = new JsonSnapshotReadModel(snapshot as unknown as { meta: RegistryMeta; view: Raw });
  return instance;
}
export const brandSlug = brandId;
export type { PriceState };
