import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { budgetBand, findMyCarCompletePayload, pushFindMyCarComplete, FMC_COMPLETE_EVENT } from '../../src/lib/analytics/fmc-complete.ts';

/* P5 11 Nov 2026: find_my_car_complete dataLayer event (GA4 key event). Coarse params only; no PII, no free text. */
test('event name is exactly find_my_car_complete', () => assert.equal(FMC_COMPLETE_EVENT, 'find_my_car_complete'));

test('budget bands: boundaries are exclusive upper bounds; bad input is "unknown"', () => {
  const cases = [[1, 'lt_1m'], [999_999, 'lt_1m'], [1_000_000, '1m_1_5m'], [1_499_999, '1m_1_5m'], [1_500_000, '1_5m_2_5m'],
    [2_499_999, '1_5m_2_5m'], [2_500_000, '2_5m_4m'], [3_999_999, '2_5m_4m'], [4_000_000, 'gte_4m'], [20_000_000, 'gte_4m'],
    [0, 'unknown'], [-5, 'unknown'], [NaN, 'unknown'], ['2000000', 'unknown'], [null, 'unknown'], [undefined, 'unknown']];
  for (const [v, band] of cases) assert.equal(budgetBand(v), band, String(v));
});

test('payload has exactly event, budget_band, result_count (no exact budget, no text, no ids)', () => {
  const p = findMyCarCompletePayload(2_050_000, 3);
  assert.deepEqual(p, { event: 'find_my_car_complete', budget_band: '1_5m_2_5m', result_count: 3 });
  assert.deepEqual(Object.keys(p).sort(), ['budget_band', 'event', 'result_count']);
  assert.equal(findMyCarCompletePayload(2_000_000, 0).result_count, 0); // no-match still counts as completed, with 0 cars
  assert.equal(findMyCarCompletePayload(2_000_000, -1).result_count, 0);
  assert.equal(findMyCarCompletePayload(2_000_000, 2.9).result_count, 2);
  assert.equal(findMyCarCompletePayload(2_000_000, 'x').result_count, 0);
});

test('push appends one object to window.dataLayer (creates it when missing)', () => {
  const w = {}; pushFindMyCarComplete(w, 1_200_000, 4);
  assert.deepEqual(w.dataLayer, [{ event: 'find_my_car_complete', budget_band: '1m_1_5m', result_count: 4 }]);
  pushFindMyCarComplete(w, 1_200_000, 4); assert.equal(w.dataLayer.length, 2);
});

test('wiring: FindMyCar pushes once per flow, skips shared links, and resets on restart', () => {
  const src = fs.readFileSync('src/components/fmc/FindMyCar.tsx', 'utf8');
  assert.match(src, /!completeSent\.current && body\.op !== 'shared'/);
  assert.match(src, /restart = \(\) => \{ completeSent\.current = false;/);
  assert.equal((src.match(/pushFindMyCarComplete\(/g) || []).length, 1);
});

test('the event never carries forbidden analytics keys', async () => {
  const { FORBIDDEN_KEYS } = await import('../../src/lib/analytics/contract.ts');
  for (const k of Object.keys(findMyCarCompletePayload(1e6, 1)).filter(k => k !== 'event')) assert.ok(!FORBIDDEN_KEYS.test(k), k);
});
