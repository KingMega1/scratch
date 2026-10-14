/* P2 accepted customer content (catalogue serving release `accepted.*`) -> customer-facing shapes.
   Pure functions, no imports: also exercised directly by tests/unit/p2-content.test.mjs.
   Rules: show only P2-accepted values; never average, pick or infer between disagreeing values; every value keeps its
   trim scope and named source; internal field codes and malformed values never reach the page. */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;
type Loc = 'en' | 'ar';

export interface ContentSource { name: string; url: string | null; official: boolean }
export interface Scope { kind: 'model' | 'trims' | 'named'; trims: string[]; text: string }
export interface SpecLine { value: string; scopes: Scope[]; sources: ContentSource[] }
export interface SpecRow { field: string; label: { en: string; ar: string }; lines: SpecLine[]; variation: 'none' | 'by-trim' | 'sources-differ' }
export type WarrantyKind = 'vehicle' | 'battery' | 'range-extender' | 'extended' | 'maintenance';
export interface WarrantyItem { kind: WarrantyKind; years: number | null; km: number | null; upTo: boolean; termsApply: boolean; scopes: Scope[]; sources: ContentSource[] }
export interface GalleryImage { src: string; width: number; height: number; credit: string | null; page: string | null }
export interface BrochureLink { url: string; title: string; issuer: string; scope: string | null; host: string }

/* Customer label per accepted spec field (unit in the label). Fields not listed here are never shown. */
export const SPEC_FIELDS: [string, string, string][] = [
  ['engine', 'Engine', 'المحرك'],
  ['engine_cc', 'Engine capacity (cc)', 'سعة المحرك (سي سي)'],
  ['engine_l', 'Engine capacity (L)', 'سعة المحرك (لتر)'],
  ['cylinders', 'Cylinders', 'الأسطوانات'],
  ['power_hp', 'Power (hp)', 'القوة (حصان)'],
  ['system_power_hp', 'Combined system power (hp)', 'القوة المجمّعة للنظام (حصان)'],
  ['system_power_kw', 'Combined system power (kW)', 'القوة المجمّعة للنظام (كيلوواط)'],
  ['motor_power_hp', 'Electric motor power (hp)', 'قوة المحرك الكهربائي (حصان)'],
  ['motor_power_kw', 'Electric motor power (kW)', 'قوة المحرك الكهربائي (كيلوواط)'],
  ['torque_nm', 'Torque (Nm)', 'عزم الدوران (نيوتن متر)'],
  ['system_torque_nm', 'Combined system torque (Nm)', 'العزم المجمّع للنظام (نيوتن متر)'],
  ['motor_torque_nm', 'Electric motor torque (Nm)', 'عزم المحرك الكهربائي (نيوتن متر)'],
  ['transmission', 'Transmission', 'ناقل الحركة'],
  ['drive', 'Drive', 'نظام الدفع'],
  ['fuel_type', 'Fuel', 'الوقود'],
  ['fuel', 'Fuel', 'الوقود'],
  ['battery_kwh', 'Battery capacity (kWh)', 'سعة البطارية (كيلوواط ساعة)'],
  ['ev_range_km', 'Electric range (km)', 'المدى الكهربائي (كم)'],
  ['total_range_km', 'Total range (km)', 'المدى الإجمالي (كم)'],
  ['max_ac_kw', 'Max AC charging (kW)', 'أقصى شحن متردد AC (كيلوواط)'],
  ['max_dc_kw', 'Max DC fast charging (kW)', 'أقصى شحن سريع DC (كيلوواط)'],
  ['energy_consumption_kwh100', 'Energy consumption (kWh/100 km)', 'استهلاك الطاقة (كيلوواط ساعة/100 كم)'],
  ['fuel_consumption_l100', 'Fuel consumption (L/100 km)', 'استهلاك الوقود (لتر/100 كم)'],
  ['accel_0_100_s', '0–100 km/h (s)', 'التسارع 0–100 كم/س (ثانية)'],
  ['top_speed_kmh', 'Top speed (km/h)', 'السرعة القصوى (كم/س)'],
  ['length_mm', 'Length (mm)', 'الطول (مم)'],
  ['width_mm', 'Width (mm)', 'العرض (مم)'],
  ['height_mm', 'Height (mm)', 'الارتفاع (مم)'],
  ['wheelbase_mm', 'Wheelbase (mm)', 'قاعدة العجلات (مم)'],
  ['ground_clearance_mm', 'Ground clearance (mm)', 'الخلوص الأرضي (مم)'],
  ['kerb_weight_kg', 'Kerb weight (kg)', 'الوزن الفارغ (كجم)'],
  ['seats', 'Seats', 'عدد المقاعد'],
  ['boot_l', 'Boot (L)', 'سعة الحقيبة (لتر)'],
  ['boot_max_l', 'Boot, rear seats folded (L)', 'سعة الحقيبة مع طي المقاعد الخلفية (لتر)'],
  ['fuel_tank_l', 'Fuel tank (L)', 'خزان الوقود (لتر)'],
  ['wheels_in', 'Wheel size (in)', 'مقاس العجلات (بوصة)'],
  ['airbags', 'Airbags', 'الوسائد الهوائية'],
];
const LABEL = new Map(SPEC_FIELDS.map(([k, en, ar]) => [k, { en, ar }]));
const TEXT_FIELDS = new Set(['engine', 'transmission', 'drive', 'fuel_type', 'fuel', 'cylinders', 'airbags']);
// Base unit already carried by the label: dropped from the value; any extra qualifier (e.g. "@5800 rpm", "WLTP") is kept.
const BASE_UNIT = /^(hp|nm|n\.?m|kw|kwh|km\/h|km|mm|l|kg|in|s|cc|count)\b/i;

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const norm = (s: string) => s.toLowerCase().replace(/[\s,]/g, '');
// Power/torque figures are compared on the figure itself: "160" and "160/ 5,500" (hp / rpm) are the same 160 hp.
const RPM_FIELDS = /^(power_hp|torque_nm|system_power_hp|system_torque_nm|motor_power_hp|motor_torque_nm)$/;
const figureKey = (field: string, v: string) => norm(RPM_FIELDS.test(field) ? v.replace(/\s*(\/|@).*$/, '') : v);

/* A value is shown only if it is a value: numeric fields need a digit; nothing that reads like a column header. */
export function validValue(field: string, value: string): boolean {
  if (!value || value.length > 120) return false;
  if (/\((l|cc|mm|kg|hp|nm|kw|kwh|km)\)\s*$/i.test(value) || /^(engine|transmission|fuel|drive)\s+(capacity|type|mode)\b/i.test(value)) return false;
  if (/unknown|conflict|u11|todo|n\/a/i.test(value)) return false;
  return TEXT_FIELDS.has(field) || /\d/.test(value);
}

export function displayValue(value: string, unit: string): string {
  const u = clean(unit).replace(BASE_UNIT, '').replace(/^[\s(]+|[\s)]+$/g, '').trim();
  return u ? `${value} (${u})` : value;
}

export function parseScope(applicability: string): Scope {
  const a = clean(applicability);
  const m = a.match(/^market trim pages:\s*(.*)$/i);
  if (m) return m[1].toLowerCase() === 'model' ? { kind: 'model', trims: [], text: '' } : { kind: 'trims', trims: m[1].split(/\s*,\s*/).filter(Boolean), text: '' };
  if (/^model page$/i.test(a) || /^all trims\b/i.test(a)) return { kind: 'model', trims: [], text: '' };
  const g = a.match(/^ALL listed grades \((.*)\)/i);
  if (g) return { kind: 'trims', trims: [g[1]], text: '' };
  if (/^grade-scoped/i.test(a)) return { kind: 'named', trims: [], text: '' };
  return { kind: 'named', trims: [], text: a };
}
const scopeKey = (s: Scope) => `${s.kind}|${s.trims.join(',')}|${s.text}`;
const overlaps = (a: Scope, b: Scope) =>
  a.kind === 'model' || b.kind === 'model' || (a.kind === 'trims' && b.kind === 'trims' && a.trims.some(t => b.trims.includes(t))) ||
  (a.kind === 'named' && b.kind === 'named' && a.text === b.text);

const MARKET: Record<string, string> = { contactcars: 'ContactCars', hatla2ee: 'Hatla2ee', egycar: 'EgyCar' };
/* Issuer string -> named sources. Market sites are named as such; everything else is an official Egypt site or importer
   document. Google Drive copies (`drive:<id>`) are internal storage, so they are named but never linked. */
export function parseSources(issuer: string, source: string, brand: string): ContentSource[] {
  const urls = clean(source).split('|').map(u => u.trim()).filter(u => /^https:\/\//.test(u));
  return clean(issuer).split('+').map(x => x.trim()).filter(Boolean).map(name => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (MARKET[key]) return { name: MARKET[key], url: urls.find(u => u.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key)) ?? null, official: false };
    const host = /^[\w-]+(\.[\w-]+)+$/.test(name) ? name.replace(/^www\./, '') : null;
    const label = /_eg_web$/i.test(name) ? `${brand} Egypt` : host ?? name.replace(/\s*\(.*\)\s*$/, '');
    const url = urls.find(u => !/contactcars|hatla2ee/i.test(u)) ?? null;
    return { name: label, url, official: true };
  });
}
function mergeSources(a: ContentSource[], b: ContentSource[]): ContentSource[] {
  const out = [...a];
  for (const s of b) if (!out.some(x => x.name === s.name && x.url === s.url)) out.push(s);
  return out;
}

export function specRows(accepted: Raw, brand: string): SpecRow[] {
  const specs = accepted?.specs ?? {};
  const rows: SpecRow[] = [];
  for (const [field] of SPEC_FIELDS) {
    const lines: SpecLine[] = [];
    for (const v of specs[field] ?? []) {
      const value = clean(v?.value);
      if (!validValue(field, value)) continue;
      const shown = displayValue(value, v?.unit ?? '');
      const scope = parseScope(v?.applicability ?? '');
      const sources = parseSources(v?.issuer ?? '', v?.source ?? '', brand);
      const same = lines.find(l => figureKey(field, l.value) === figureKey(field, shown));
      if (same) {
        if (!/[/@]/.test(shown) && /[/@]/.test(same.value)) same.value = shown; // keep the plain figure
        if (!same.scopes.some(s => scopeKey(s) === scopeKey(scope))) same.scopes.push(scope);
        same.sources = mergeSources(same.sources, sources);
      } else lines.push({ value: shown, scopes: [scope], sources });
    }
    if (!lines.length) continue;
    let variation: SpecRow['variation'] = 'none';
    if (lines.length > 1) {
      const clash = lines.some((a, i) => lines.some((b, j) => j > i && a.scopes.some(x => b.scopes.some(y => overlaps(x, y)))));
      variation = clash ? 'sources-differ' : 'by-trim';
    }
    rows.push({ field, label: LABEL.get(field)!, lines, variation });
  }
  // Two fuel fields carry the same fact under one label: keep the first.
  return rows.filter((r, i) => !(r.field === 'fuel' && rows.slice(0, i).some(x => x.field === 'fuel_type')));
}

function warrantySegment(seg: string): Omit<WarrantyItem, 'scopes' | 'sources'> | null {
  const s = clean(seg);
  const years = s.match(/(\d+)\s*years?/i), km = s.match(/(\d[\d,]*)\s*km/i);
  if (!years && !km) return null;
  const kind: WarrantyKind = /maintenance|service/i.test(s) ? 'maintenance' : /battery/i.test(s) ? 'battery'
    : /reev|range[- ]extender/i.test(s) ? 'range-extender' : /extended/i.test(s) ? 'extended' : 'vehicle';
  return { kind, years: years ? Number(years[1]) : null, km: km ? Number(km[1].replace(/,/g, '')) : null,
    upTo: /up to/i.test(s), termsApply: /terms apply/i.test(s) };
}

export function warrantyItems(accepted: Raw, brand: string): WarrantyItem[] {
  const out: WarrantyItem[] = [];
  const add = (v: Raw, forceKind?: WarrantyKind) => {
    const termsAll = /terms apply/i.test(v?.value ?? '');
    for (const seg of clean(v?.value).split(';')) {
      const w = warrantySegment(seg);
      if (!w) continue;
      const item: WarrantyItem = { ...w, kind: forceKind ?? w.kind, termsApply: w.termsApply || termsAll,
        scopes: [parseScope(v?.applicability ?? '')], sources: parseSources(v?.issuer ?? '', v?.source ?? '', brand) };
      const dup = out.find(x => x.kind === item.kind && x.years === item.years && x.km === item.km && x.upTo === item.upTo);
      if (dup) {
        if (!dup.scopes.some(s => scopeKey(s) === scopeKey(item.scopes[0]))) dup.scopes.push(item.scopes[0]);
        dup.sources = mergeSources(dup.sources, item.sources); dup.termsApply ||= item.termsApply;
      } else out.push(item);
    }
  };
  for (const v of accepted?.warranty ?? []) add(v);
  for (const v of accepted?.specs?.warranty_battery ?? []) add(v, 'battery');
  const order: WarrantyKind[] = ['vehicle', 'battery', 'range-extender', 'extended', 'maintenance'];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/* Accepted gallery images served from /media/p2/ only, with the served file's real pixel size (import manifest). */
export function galleryImages(accepted: Raw, sizes: Map<string, [number, number]>): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const g of accepted?.gallery ?? []) {
    if (g?.status !== 'ACCEPT' || typeof g.src !== 'string' || !/^\/media\/p2\/models\/[\w-]+\/[\w.-]+\.(webp|png|jpe?g)$/i.test(g.src)) continue;
    const wh = sizes.get(g.src);
    if (!wh || out.some(x => x.src === g.src)) continue;
    out.push({ src: g.src, width: wh[0], height: wh[1], credit: g.credit ?? null, page: /^https:\/\//.test(g.page ?? '') ? g.page : null });
  }
  return out;
}

/* Brochures: direct official documents (https, not a Drive copy) are linkable; Drive copies are internal storage. */
export function brochureLinks(accepted: Raw, allowDrive: Set<string>): BrochureLink[] {
  const out: BrochureLink[] = [];
  for (const b of accepted?.brochures ?? []) {
    const url = clean(b?.url);
    if (!/^https:\/\//.test(url)) continue;
    const host = new URL(url).hostname;
    if (host === 'drive.google.com' && !allowDrive.has(url)) continue;
    if (out.some(x => x.url === url)) continue;
    const scope = clean(b?.scope);
    out.push({ url, title: clean(b?.title), issuer: clean(b?.issuer).replace(/\s*\(.*\)\s*$/, ''), host,
      scope: scope && !/^download brochure$/i.test(scope) ? scope : null });
  }
  return out;
}

export function scopeText(s: Scope, locale: Loc): string {
  if (s.kind === 'model') return locale === 'ar' ? 'الموديل (الفئة غير محددة في المصدر)' : 'Model (trim not stated by the source)';
  if (s.kind === 'trims') return (locale === 'ar' ? 'الفئات: ' : 'Trims: ') + s.trims.join(', ');
  return s.text || (locale === 'ar' ? 'فئة واحدة (غير مسماة في المصدر)' : 'One trim (not named by the source)');
}
