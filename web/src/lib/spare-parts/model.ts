/* Spare parts: types, categories and the price-state rule. CarIndexed does not sell parts: no cart, checkout, affiliate
   or paid placement. The UI never shows a figure it cannot source (see priceView). */

export const PART_CATEGORIES = ['filters', 'brakes', 'electrical', 'suspension', 'tyres', 'lighting', 'cooling', 'body', 'ev-cables', 'home-chargers'] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];
export type PartKind = 'oem' | 'aftermarket';

/* One price state per item:
   dealer    – «سعر الوكيل», only with a cited source (name required, URL optional)
   confirmed – «آخر تأكيد», with the confirmation date
   unknown   – «لسه مش متأكدين», the default
   conflict  – «المصادر مختلفة», sources disagree: no single figure is ever shown */
export type PartPrice =
  | { state: 'dealer'; value: number; source: { name: string; url: string | null } }
  | { state: 'confirmed'; value: number; confirmedAt: string }
  | { state: 'unknown' }
  | { state: 'conflict' };

export interface SparePart {
  id: string;
  category: PartCategory;
  kind: PartKind;
  name: { ar: string; en: string };
  note?: { ar: string; en: string };
  partNumber: string | null; // null until a verified number exists; never invented
  price: PartPrice;
}

export type PriceView =
  | { state: 'dealer'; figure: number; source: { name: string; url: string | null } }
  | { state: 'confirmed'; figure: number; date: string }
  | { state: 'unknown'; figure: null }
  | { state: 'conflict'; figure: null };

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const okFigure = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const okUrl = (u: unknown) => typeof u === 'string' && /^https:\/\//.test(u);

/* What the UI may display. Anything not fully sourced degrades to `unknown` (no figure). */
export function priceView(p: PartPrice | null | undefined): PriceView {
  if (!p) return { state: 'unknown', figure: null };
  switch (p.state) {
    case 'dealer':
      return okFigure(p.value) && typeof p.source?.name === 'string' && p.source.name.trim()
        ? { state: 'dealer', figure: p.value, source: { name: p.source.name.trim(), url: okUrl(p.source.url) ? p.source.url : null } }
        : { state: 'unknown', figure: null };
    case 'confirmed':
      return okFigure(p.value) && typeof p.confirmedAt === 'string' && ISO_DATE.test(p.confirmedAt)
        ? { state: 'confirmed', figure: p.value, date: p.confirmedAt }
        : { state: 'unknown', figure: null };
    case 'conflict':
      return { state: 'conflict', figure: null };
    default:
      return { state: 'unknown', figure: null };
  }
}
