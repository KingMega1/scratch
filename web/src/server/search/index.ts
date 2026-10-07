import 'server-only';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { priceShort } from '@/lib/format';
import type { Body } from '@/lib/vehicles/types';
import { vehicles } from '../vehicles/read-model';
import { content } from '../cms/provider';

/* Public search consumes a SHAPED index built from the public read model + published CMS content.
   It never queries canonical data or internal fields. Results carry only display fields and hrefs. */

export interface SearchHit { group: 'actions' | 'cars' | 'brands' | 'market' | 'content'; title: string; href: string; meta?: string; id?: string }
export interface SearchResult { q: string; total: number; groups: Partial<Record<SearchHit['group'], SearchHit[]>> }

export function norm(s: string): string {
  return String(s || '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, ' ').trim();
}

type Doc = { group: SearchHit['group']; keys: string; title: Record<Locale, string>; href: (l: Locale) => string; meta?: Record<Locale, string>; id?: string; weight: number };
let DOCS: Doc[] | null = null;

const BODY_WORDS: Record<Body, string[]> = {
  suv: ['suv', 'اس يو في', 'كروس اوفر', 'crossover', 'جيب', 'عاليه'],
  sedan: ['sedan', 'سيدان', 'صالون'],
  hatch: ['hatchback', 'hatch', 'هاتشباك', 'هاتش'],
  mpv: ['mpv', 'minivan', 'van', 'ميني فان', 'فان', '7 seats', '7 seat', 'سبع ركاب', '7 راكب'],
};

function build(): Doc[] {
  const V = vehicles();
  const docs: Doc[] = [];
  for (const c of V.all()) {
    const ar = `${c.brand.ar ?? c.brand.en} ${c.model.ar ?? c.model.en}`;
    docs.push({
      group: 'cars', id: c.id, weight: Math.log10(10 + (c.registrations?.last12 ?? 0)),
      keys: norm([c.brand.en, c.model.en, c.brand.ar, c.model.ar, c.id.replace('/', ' '), ar].filter(Boolean).join(' ')),
      title: { en: `${c.brand.en} ${c.model.en}`, ar },
      meta: c.price ? { en: priceShort(c.price.min, 'en'), ar: priceShort(c.price.min, 'ar') } : undefined,
      href: l => `/${l}/cars/${c.id}`,
    });
  }
  for (const b of V.brands()) {
    docs.push({
      group: 'brands', id: b.id, weight: 2 + Math.log10(10 + b.registrationsLast12),
      keys: norm(`${b.en} ${b.ar ?? ''} ${b.id}`), title: { en: b.en, ar: b.ar ?? b.en },
      meta: { en: dict('en').market.models(b.count), ar: dict('ar').market.models(b.count) },
      href: l => `/${l}/cars?brand=${b.id}`,
    });
  }
  const M = (k: string, en: string, ar: string, href: string) => docs.push({ group: 'market', keys: norm(`${k} ${en} ${ar}`), title: { en, ar }, href: l => `/${l}${href}`, weight: 1 });
  M('market prices price prices اسعار سعر سوق', dict('en').market.h1, dict('ar').market.h1, '/market');
  M('new launches جديد اطلاق', dict('en').market.newH, dict('ar').market.newH, '/market#new');
  M('popular registrations best selling تسجيلات مبيعات', dict('en').market.popularH, dict('ar').market.popularH, '/market#popular');
  M('catalog table all models كتالوج جدول', dict('en').market.catalogH, dict('ar').market.catalogH, '/market/catalog');
  M('methodology sources مصادر طريقه', dict('en').footer.methodology, dict('ar').footer.methodology, '/methodology');
  return docs;
}

async function contentDocs(): Promise<Doc[]> {
  const items = await content().list({ includeDrafts: true });
  return items.map(c => ({
    group: 'content' as const, weight: 1, keys: norm(`${c.title.en} ${c.title.ar} ${c.summary.en} ${c.summary.ar} ${c.tags.join(' ')}`),
    title: c.title, href: (l: Locale) => `/${l}/news/${c.slug}`,
    meta: { en: dict('en').news.types[c.type], ar: dict('ar').news.types[c.type] },
  }));
}

function parsePrice(q: string): number | null {
  const m = /(?:under|below|less than|max|تحت|اقل من|في حدود|حدود)\s*([\d.,]+)\s*(m|million|mn|مليون|k|الف|ألف)?/.exec(q);
  if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(v)) return null;
  const u = m[2] || '';
  if (/^(m|million|mn|مليون)$/.test(u) || v < 100) v *= 1_000_000; else if (/^(k|الف|ألف)$/.test(u)) v *= 1000;
  return v >= 100_000 && v <= 100_000_000 ? Math.round(v) : null;
}

export async function search(qRaw: string, locale: Locale, limit = 8): Promise<SearchResult> {
  const q = norm(qRaw).slice(0, 120);
  if (!q) return { q: '', total: 0, groups: {} };
  DOCS ??= build();
  const docs = [...DOCS, ...(await contentDocs())];
  const tokens = q.split(' ').filter(Boolean);
  const scored: { d: Doc; s: number }[] = [];
  for (const d of docs) {
    let s = 0;
    for (const tk of tokens) {
      if (tk.length < 2 && !/\d/.test(tk)) continue;
      const i = d.keys.indexOf(tk);
      if (i < 0) continue;
      s += (i === 0 || d.keys[i - 1] === ' ') ? 2 : 1;
    }
    if (s > 0) scored.push({ d, s: s + d.weight * 0.2 });
  }
  scored.sort((a, b) => b.s - a.s || a.d.title[locale].localeCompare(b.d.title[locale]));
  const t = dict(locale).search;
  const actions: SearchHit[] = [];
  const max = parsePrice(q);
  const body = (Object.keys(BODY_WORDS) as Body[]).find(b => BODY_WORDS[b].some(w => q.includes(norm(w))));
  if (max) actions.push({ group: 'actions', title: t.actUnder(priceShort(max, locale)), href: `/${locale}/cars?max=${max}${body ? `&body=${body}` : ''}` });
  if (body) actions.push({ group: 'actions', title: t.actBody(dict(locale).body[body]), href: `/${locale}/cars?body=${body}` });
  const carHits = scored.filter(x => x.d.group === 'cars');
  if (/\b(vs|و|ولا|or|versus)\b/.test(q) && carHits.length >= 2) {
    const [a, b] = carHits;
    actions.push({ group: 'actions', title: t.actCompare(a.d.title[locale], b.d.title[locale]), href: `/${locale}/compare?ids=${a.d.id},${b.d.id}` });
  }
  const groups: SearchResult['groups'] = {};
  if (actions.length) groups.actions = actions;
  for (const g of ['cars', 'brands', 'market', 'content'] as const) {
    const hits = scored.filter(x => x.d.group === g).slice(0, limit).map(x => ({ group: g, title: x.d.title[locale], href: x.d.href(locale), meta: x.d.meta?.[locale], id: x.d.id }));
    if (hits.length) groups[g] = hits;
  }
  const total = Object.values(groups).reduce((a, h) => a + (h?.length || 0), 0);
  return { q: qRaw.slice(0, 120), total, groups };
}
