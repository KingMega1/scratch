import 'server-only';
import snapshot from '@data/registry/universe.snapshot.json';
import crosswalk from '@data/registry/display-crosswalk.TEMP.json';
import serving from '@data/registry/catalogue-serving.release.json';
import media from '@data/registry/media-verified.json';
import type { P2Content, P2Fact, AssetFlag, BrandSummary, OfficialPrice, PriceChange, PriceState, Powertrain, PublicCar, PublicImage, PublicTrim, RegistryMeta, SpecValue } from '@/lib/vehicles/types';

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

const brandId = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

/* P2 media contract: a serving-release entry may carry accepted.hero_image (or hero_image) =
   { src: '/media/models/<site_slug>.<ext>', credit, source_url }. Only same-origin files under /media/ are served
   (CSP img-src 'self'); anything else is ignored and the entry keeps the registry image or the unavailable treatment. */
export function p2Hero(e: Raw): PublicImage | null {
  const h = e?.accepted?.hero_image ?? e?.hero_image;
  if (!h || typeof h.src !== 'string' || !/^\/media\/[\w./-]+\.(webp|png|jpe?g|avif)$/i.test(h.src) || h.src.includes('..')) return null;
  return { src: h.src, credit: h.credit ?? h.issuer ?? null, sourcePage: h.source_url ?? h.source_page ?? null, flags: [] as AssetFlag[] };
}

/* P2 accepted price (RC2 accepted.price). Tier A = official Egypt OEM/importer source; Tier B = the same official EGP list
   price reported by >=2 independent sites (P2 rule PB-1). Shown as the official figure with every named source and its
   date; nothing is averaged, inferred or carried over from another model. */
const PRICE_GAPS = new Set(['NO_VERIFIED_PRICE', 'NO_ACCEPTED_PRICE', 'NO_OFFICIAL_PRICE', 'SINGLE_SOURCE_MODEL', 'FROM_PRICE_IN_CONFLICT', 'PRICE_RULE_NOT_MET', 'UNRESOLVED_TRIMS_IN_PRICED_COHORT']);
function issuerNames(issuer: string, brand: string): string[] {
  return issuer.split('+').map(x => x.trim()).filter(Boolean).map(x => (/_eg_web$/i.test(x) ? `${brand} Egypt` : srcName(x)));
}
function p2Official(price: number, issuer: string, evidence: string, asOf: string, eff: string | null, basis: string, brand: string): OfficialPrice {
  const urls = (evidence || '').split('|').map(u => u.trim()).filter(u => /^https?:\/\//.test(u));
  const names = issuerNames(issuer, brand);
  const raw = issuer.split('+').map(x => x.trim().toLowerCase().replace(/_eg_web$/, '').replace(/[^a-z0-9]/g, ''));
  const sources = names.map((name, i) => ({ name, url: urls.find(u => raw[i] && u.toLowerCase().replace(/[^a-z0-9]/g, '').includes(raw[i])) ?? urls[0] ?? null,
    observedAt: asOf, effectiveDate: basis === 'SOURCE_STATED' ? eff : null }));
  return { state: 'checked', value: price, min: null, max: null, values: [], agreedBySources: names.length, sources };
}
export function p2Price(e: Raw): { priceFrom: PublicCar['priceFrom']; trims: PublicTrim[]; otherCohorts: PublicCar['otherCohorts']; asOf: string } | null {
  const p = e?.accepted?.price;
  if (!p || typeof p.price_from !== 'number' || p.price_from <= 0) return null;
  const toTrim = (t: Raw): PublicTrim => ({ key: `${t.model_year ?? ''}-${t.label}`, label: String(t.label), modelYear: t.model_year ?? null,
    official: p2Official(t.price_egp, t.issuer, t.evidence_url, t.as_of, t.effective_date ?? null, t.date_basis, e.brand), market: null });
  const all: PublicTrim[] = (p.trims ?? []).filter((t: Raw) => typeof t.price_egp === 'number').map(toTrim);
  const years = [...new Set(all.map(t => t.modelYear))].sort((a, b) => (b ?? 0) - (a ?? 0));
  const latest = p.model_year ?? years[0] ?? null;
  return {
    priceFrom: { state: 'checked', value: p.price_from, min: null, max: null, sortValue: p.price_from, modelYear: p.model_year ?? null },
    trims: all.filter(t => t.modelYear === latest).sort(trimSort),
    otherCohorts: years.filter(y => y !== latest).map(y => ({ modelYear: y, trims: all.filter(t => t.modelYear === y).sort(trimSort) })),
    asOf: p.as_of,
  };
}

/* Customer spec keys shown from P2 accepted.specs (labels live in the dictionary). Anything else stays server-side. */
export const P2_SPEC_KEYS = ['power_hp', 'system_power_hp', 'system_power_kw', 'motor_power_hp', 'motor_power_kw', 'torque_nm', 'system_torque_nm', 'motor_torque_nm',
  'engine', 'engine_cc', 'engine_l', 'cylinders', 'transmission', 'drive', 'accel_0_100_s', 'top_speed_kmh', 'fuel_consumption_l100',
  'battery_kwh', 'ev_range_km', 'total_range_km', 'energy_consumption_kwh100', 'max_ac_kw', 'max_dc_kw',
  'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'ground_clearance_mm', 'kerb_weight_kg', 'seats', 'boot_l', 'boot_max_l', 'fuel_tank_l', 'wheels_in', 'airbags'] as const;
const firstUrl = (s: string) => (s || '').split('|').map(x => x.trim()).find(x => /^https?:\/\//.test(x)) ?? null;
/* Applicability as the customer should read it: whole-model statements carry no qualifier; trim lists keep the trims. */
function scopeOf(a: string): string | null {
  const x = (a || '').trim();
  if (!x || /^model page$/i.test(x) || /^market trim pages:\s*model$/i.test(x)) return null;
  const m = x.match(/^market trim pages:\s*(.+)$/i);
  return (m ? m[1] : x).trim();
}
// Plain unit tokens are implied by the spec key (shown localised); only qualifiers such as "km WLTP combined" are kept.
const PLAIN_UNIT = new Set(['', 'mm', 'hp', 'l', 'nm', 'count', 'kg', 'cc', 'kw', 's', 'km/h', 'in', 'kwh', 'km']);
const normValue = (v: unknown) => { const t = String(v).trim(); return /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t; }; // "4,770" == "4770"
const fact = (x: Raw, brand: string): P2Fact => ({
  value: normValue(x.value), unit: /U11|conflict/i.test(x.unit ?? '') || PLAIN_UNIT.has(String(x.unit ?? '').trim().toLowerCase()) ? '' : String(x.unit ?? '').trim(),
  scope: scopeOf(x.applicability), issuer: issuerNames(String(x.issuer ?? ''), brand).join(' + '), sourceUrl: firstUrl(x.source),
});
export function p2Content(e: Raw): P2Content | null {
  const a = e?.accepted ?? {};
  // Same value + unit from several sources is one fact (scopes and sources combined); different values stay separate.
  const merge = (fs: P2Fact[]): P2Fact[] => {
    const m = new Map<string, P2Fact>();
    for (const f of fs) {
      const k = `${f.value}|${f.unit}`, o = m.get(k);
      if (!o) { m.set(k, { ...f }); continue; }
      o.scope = o.scope === null || f.scope === null ? null : [...new Set([...o.scope.split(/,\s*/), ...f.scope.split(/,\s*/)])].join(', ');
      o.issuer = [...new Set([...o.issuer.split(' · '), f.issuer])].join(' · ');
    }
    return [...m.values()];
  };
  const specs = P2_SPEC_KEYS.filter(k => Array.isArray(a.specs?.[k]) && a.specs[k].length).map(k => ({ key: k as string, facts: merge((a.specs[k] as Raw[]).map(x => fact(x, e.brand))) }));
  const warranty: P2Content['warranty'] = [];
  for (const w of (a.warranty ?? []) as Raw[]) {
    // "6 years / 150000 km; battery 7 years / 150000 km" -> vehicle + battery entries, same source and scope
    for (const part of String(w.value).split(';').map(p => p.trim()).filter(Boolean)) {
      const battery = /^battery\b/i.test(part);
      warranty.push({ kind: battery ? 'battery' : 'vehicle', fact: { ...fact(w, e.brand), value: part.replace(/^battery\s*/i, '') } });
    }
  }
  for (const w of (a.specs?.warranty_battery ?? []) as Raw[]) warranty.push({ kind: 'battery', fact: fact(w, e.brand) });
  const gallery = ((a.gallery ?? []) as Raw[]).filter(g => typeof g.src === 'string' && /^\/media\/[\w./-]+\.(webp|png|jpe?g|avif)$/i.test(g.src) && !g.src.includes('..'))
    .map(g => ({ src: g.src, width: Number(g.width) || null, height: Number(g.height) || null, credit: g.credit ?? null, page: g.page ?? null }));
  // Drive links point at the CarIndex working archive (not public); only official public URLs reach customers.
  const brochures = ((a.brochures ?? []) as Raw[]).filter(b => /^https:\/\//.test(b.url ?? '') && !/drive\.google\.com/.test(b.url))
    .map(b => ({ title: String(b.title ?? ''), url: b.url, issuer: String(b.issuer ?? ''),
      scope: b.scope && !/^\s*(download|view|open)?\s*(the\s*)?brochure\s*$/i.test(b.scope) ? b.scope : null })); // link text is not a scope
  return specs.length || warranty.length || gallery.length || brochures.length ? { specs, warranty, gallery, brochures } : null;
}

/* P2 accepted brand logos (RC2 accepted.logo), same-origin files only. Keyed by the website brand id.
   White-on-transparent marks (made for dark backgrounds) may not be recoloured (Brand V2): they are shown unaltered on an
   ink tile instead (tests/unit/brand.test.mjs keeps this list exact against the files). */
export const LIGHT_ONLY_LOGOS = new Set(['/media/brands/byd.png', '/media/brands/nissan.png']);
export function p2Logos(entries: Raw[]): Record<string, { src: string; credit: string | null; onInk: boolean }> {
  const out: Record<string, { src: string; credit: string | null; onInk: boolean }> = {};
  for (const e of entries) {
    const l = e?.accepted?.logo, id = brandId(e.brand);
    if (out[id] || !l || typeof l.src !== 'string' || !/^\/media\/[\w./-]+\.(png|svg|webp)$/i.test(l.src) || l.src.includes('..')) continue;
    out[id] = { src: l.src, credit: l.credit ?? null, onInk: LIGHT_ONLY_LOGOS.has(l.src) };
  }
  return out;
}

function shape(m: Raw): PublicCar {
  const cohorts: Raw[] = m.price?.cohorts ?? [];
  const latestYear = m.price?.latest_priced_cohort ?? null;
  const latest = cohorts.find(c => c.model_year === latestYear) ?? null;
  const reg = m.registration;
  const cw = (crosswalk.map as Record<string, Raw>)[m.slug];
  // Images come only from the verified media registry (exact model, named source, usage basis). The TEMP display
  // crosswalk photos (TEMP_UNVERIFIED, not Egypt-market-checked) are no longer served.
  const vm = (media.entries as Raw[]).find(x => x.site_slug === m.slug);
  const image: PublicImage | null = vm ? { src: vm.src, credit: vm.credit ?? null, sourcePage: vm.source_url ?? null, flags: [] as AssetFlag[] } : null;
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
    p2: null,
    image,
  };
}

class JsonSnapshotReadModel implements VehicleReadModel {
  private cars: PublicCar[];
  private byId: Map<string, PublicCar>;
  private brandList: BrandSummary[];
  constructor(private snap: { meta: RegistryMeta; view: Raw }) {
    const rawById = new Map<string, Raw>(snap.view.models.map((m: Raw) => [m.model_id, m]));
    this.cars = serving.entries.map(e => {
      const raw = e.p2_model_id ? rawById.get(e.p2_model_id) : null;
      const car = shape(raw ?? {
        slug: e.site_slug, brand: e.brand, model: e.model, in_slice: true,
        price: {}, specs: {}, registration: null, gaps: e.missing_evidence, conflicts: [],
      });
      car.brand.ar = e.ar.brand;
      car.model.ar = e.ar.model;
      car.body = e.body;
      car.p1Id = e.p1_id;
      car.evidenceState = e.evidence_state;
      const hero = p2Hero(e as Raw);
      if (hero) car.image = hero; // P2-accepted hero (catalogue serving release) takes precedence over the P5 media registry
      const pp = p2Price(e as Raw);
      if (pp) {
        // P2-accepted price is canonical: it replaces the S6 view figure and clears price gaps that no longer apply.
        car.priceFrom = pp.priceFrom; car.trims = pp.trims; car.otherCohorts = pp.otherCohorts; car.lastObserved = pp.asOf;
        car.gaps = car.gaps.filter(g => !PRICE_GAPS.has(g));
      } else if (((e as Raw).accepted?.conflicts ?? []).length && car.priceFrom.state === 'unknown') {
        car.gaps = [...new Set([...car.gaps, 'FROM_PRICE_IN_CONFLICT'])]; // sources disagree: say so, show no number
      }
      car.p2 = p2Content(e as Raw);
      if (car.p2?.specs.length) car.gaps = car.gaps.filter(g => g !== 'NO_VERIFIED_SPECS' && g !== 'NO_ACCEPTED_SPECS');
      if (car.p2?.warranty.length) car.gaps = car.gaps.filter(g => g !== 'NO_VERIFIED_WARRANTY');
      if (raw) {
        // S6 registrations say only "ICE"; name the fuel only when the pinned U11 identity states it unambiguously.
        const fuels = ['petrol', 'diesel'].filter(f => (e.powertrains as string[]).includes(f)) as Powertrain[];
        if (fuels.length === 1) car.powertrains = car.powertrains.map(p => (p === 'ice' ? fuels[0] : p));
      }
      if (!raw) {
        // Facts explicitly attributed to the pinned U11 release. Prices/specs/images are never copied or inferred.
        const pt: Record<string, Powertrain> = {petrol:'petrol', diesel:'diesel', hybrid:'hybrid', phev:'phev', reev:'reev', ev:'ev'};
        car.powertrains = [...new Set(e.powertrains.map(p => pt[p]).filter(Boolean))];
        car.registrations = e.registration ? {
          inWindow:e.registration.last12, firstSeen:e.registration.first_month,
          window:e.registration.window as [string,string], rank:null, ranked:null, share:null,
          yoy:null, yoyCaveat:null, monthsMissing:[], monthly:[],
        } : null;
      }
      return car;
    });
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
  meta() { return { ...this.snap.meta, registry_version: serving.release_id,
    snapshot_id: serving.release_id + '@' + serving.identity_authority.commit.slice(0,12),
    models_total: serving.entries.length }; }
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
// Temporary display-only ID bridge. Source remains the audited P5 crosswalk, not P1 semantics.
const p1DisplaySlugs = new Map(serving.entries.map(row => [row.p1_id, row.site_slug]));
export const p1DisplaySlug = (p1Id: string): string | null => p1DisplaySlugs.get(p1Id) ?? null;
export const brandSlug = brandId;
export const brandLogos = p2Logos(serving.entries as Raw[]);
export type { PriceState };
