'use client';
/* GTM dataLayer contract (CEO GO 9 Nov): flat events the GTM-5WVQ2M7S container reads by name. Ids, bands and counts only:
   no personal data and no free text ever (every key is whitelisted below). GTM itself is loaded by the production layout only;
   these pushes land in window.dataLayer everywhere, so they can be checked in any build. */
declare global { interface Window { dataLayer?: unknown[] } }

export type GtmEvent =
  | { event: 'page_context'; site_language: 'ar' | 'en' }
  | { event: 'find_my_car_complete'; budget_band: string; result_count: number }
  | { event: 'lead' };

const ALLOWED: Record<GtmEvent['event'], readonly string[]> = {
  page_context: ['site_language'],
  find_my_car_complete: ['budget_band', 'result_count'],
  lead: [],
};

export function pushGtm(e: GtmEvent) {
  if (typeof window === 'undefined') return;
  const keys = ALLOWED[e.event];
  if (!keys) return;
  const out: Record<string, unknown> = { event: e.event };
  for (const k of keys) out[k] = (e as Record<string, unknown>)[k];
  (window.dataLayer = window.dataLayer || []).push(out);
}

/* Language from the path's locale segment; anything else falls back to the document language. */
export function siteLanguage(pathname: string): 'ar' | 'en' {
  const seg = pathname.split('/')[1];
  if (seg === 'ar' || seg === 'en') return seg;
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar';
}

/* Budget band label for find_my_car_complete: the site's own price bands (dictionary `bands`), English labels so the value
   is the same in both languages. A brief without a numeric budget is "unknown". */
export function budgetBand(amount: unknown): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
  if (n == null) return 'unknown';
  if (n < 1_000_000) return 'Under EGP 1M';
  if (n < 1_500_000) return 'EGP 1M – 1.5M';
  if (n < 2_500_000) return 'EGP 1.5M – 2.5M';
  return 'EGP 2.5M+';
}
