/* GA4/GTM event `find_my_car_complete`: one dataLayer push when a visitor finishes the Find my car flow and results are shown.
   Params are deliberately coarse and non-personal: a budget band (never the exact figure, never any free text) and the number of cars shown.
   Pure helpers (no imports, erasable types only) so the unit tests can load this file directly. */
export const FMC_COMPLETE_EVENT = 'find_my_car_complete';

/* EGP budget -> band. Upper bounds are exclusive. */
const BANDS: readonly [number, string][] = [
  [1_000_000, 'lt_1m'],
  [1_500_000, '1m_1_5m'],
  [2_500_000, '1_5m_2_5m'],
  [4_000_000, '2_5m_4m'],
];

export function budgetBand(egp: unknown): string {
  const n = typeof egp === 'number' ? egp : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  for (const [max, name] of BANDS) if (n < max) return name;
  return 'gte_4m';
}

export function findMyCarCompletePayload(budgetEgp: unknown, resultCount: unknown) {
  const c = typeof resultCount === 'number' && Number.isFinite(resultCount) && resultCount >= 0 ? Math.floor(resultCount) : 0;
  return { event: FMC_COMPLETE_EVENT, budget_band: budgetBand(budgetEgp), result_count: c };
}

export function pushFindMyCarComplete(win: { dataLayer?: unknown[] }, budgetEgp: unknown, resultCount: unknown) {
  const payload = findMyCarCompletePayload(budgetEgp, resultCount);
  (win.dataLayer = win.dataLayer || []).push(payload);
  return payload;
}
