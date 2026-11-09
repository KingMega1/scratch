import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

/* Minimal TS/TSX loader for src/ modules: '@/x' -> src/x, '@data/x' -> data/x; react and react-dom from node_modules. */
const cache = new Map();
function load(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs).exports;
  const mod = { exports: {} }; cache.set(abs, mod);
  const out = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = id => {
    if (id.startsWith('@/') || id.startsWith('./') || id.startsWith('../')) {
      const base = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(abs), id);
      for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(base + ext)) return load(base + ext);
    }
    if (id.startsWith('@data/')) return JSON.parse(fs.readFileSync(path.resolve('data', id.slice(6)), 'utf8'));
    return require(id);
  };
  new Function('require', 'module', 'exports', out)(req, mod, mod.exports);
  return mod.exports;
}
const M = load('src/lib/spare-parts/model.ts');
const S = load('src/lib/spare-parts/sample.ts');
const D = load('src/lib/i18n/dictionaries.ts');
const G = load('src/lib/analytics/gtm.ts');

test('price state rule: a figure only with a cited dealer source or a dated confirmation; otherwise no number', () => {
  assert.deepEqual(M.priceView({ state: 'dealer', value: 1200, source: { name: 'Toyota Egypt', url: 'https://example.com/list' } }),
    { state: 'dealer', figure: 1200, source: { name: 'Toyota Egypt', url: 'https://example.com/list' } });
  assert.equal(M.priceView({ state: 'dealer', value: 1200, source: { name: 'X', url: 'http://insecure' } }).source.url, null);
  for (const bad of [{ state: 'dealer', value: 1200, source: { name: ' ', url: null } }, { state: 'dealer', value: 1200 }, { state: 'dealer', value: NaN, source: { name: 'X', url: null } },
    { state: 'dealer', value: -5, source: { name: 'X', url: null } }, { state: 'confirmed', value: 900 }, { state: 'confirmed', value: 900, confirmedAt: '2026-13-01' },
    { state: 'confirmed', value: 0, confirmedAt: '2026-11-01' }, { state: 'weird' }, null, undefined])
    assert.deepEqual(M.priceView(bad), { state: 'unknown', figure: null }, JSON.stringify(bad));
  assert.deepEqual(M.priceView({ state: 'confirmed', value: 900, confirmedAt: '2026-11-01' }), { state: 'confirmed', figure: 900, date: '2026-11-01' });
  assert.deepEqual(M.priceView({ state: 'conflict', value: 5 }), { state: 'conflict', figure: null });
  assert.deepEqual(M.priceView({ state: 'unknown' }), { state: 'unknown', figure: null });
});

test('sample fixture is marked unverified: no part numbers, no figures, every category covered, both languages', () => {
  assert.equal(S.PARTS_DATA_STATUS, 'SAMPLE_UNVERIFIED');
  assert.equal(M.PART_CATEGORIES.length, 10);
  assert.ok(M.PART_CATEGORIES.includes('ev-cables') && M.PART_CATEGORIES.includes('home-chargers'));
  for (const p of S.SAMPLE_PARTS) {
    assert.equal(p.partNumber, null, p.id);
    assert.equal(M.priceView(p.price).figure, null, p.id);
    assert.ok(['unknown', 'conflict'].includes(p.price.state), p.id);
    assert.ok(M.PART_CATEGORIES.includes(p.category) && ['oem', 'aftermarket'].includes(p.kind) && p.name.ar && p.name.en, p.id);
  }
  for (const c of M.PART_CATEGORIES) assert.ok(S.SAMPLE_PARTS.some(p => p.category === c), c);
  for (const l of ['ar', 'en']) for (const c of M.PART_CATEGORIES) assert.equal(D.dict(l).parts.cats[c].length, 2, `${l} ${c}`);
  assert.equal(D.dict('ar').parts.state.dealer, 'سعر الوكيل'); assert.equal(D.dict('ar').parts.state.confirmed, 'آخر تأكيد');
  assert.equal(D.dict('ar').parts.state.unknown, 'لسه مش متأكدين'); assert.equal(D.dict('ar').parts.state.conflict, 'المصادر مختلفة');
  assert.equal(D.dict('ar').parts.oem, 'أصلي'); assert.equal(D.dict('ar').parts.aftermarket, 'بديل');
  assert.equal(D.dict('ar').nav.parts, 'قطع الغيار');
  // nothing that sells: no cart, checkout, buy or affiliate wording in the parts copy
  assert.doesNotMatch(JSON.stringify(D.dict('en').parts), /\b(cart|checkout|buy now|add to|affiliate|sponsored)\b/i);
});

test('PartPrice renders all four states; figures only for dealer (with source) and confirmed (with date)', () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const { jsx } = require('react/jsx-runtime');
  const PartPrice = load('src/components/parts/PartPrice.tsx').default;
  const html = (value, locale = 'ar') => renderToStaticMarkup(jsx(PartPrice, { value, locale }));
  const dealer = html({ state: 'dealer', value: 1250, source: { name: 'Example Motors', url: 'https://example.com/p' } });
  assert.match(dealer, /data-price-state="dealer"/); assert.match(dealer, /سعر الوكيل/); assert.match(dealer, /data-price-figure/); assert.match(dealer, /Example Motors/);
  const conf = html({ state: 'confirmed', value: 980, confirmedAt: '2026-11-01' }, 'en');
  assert.match(conf, /data-price-state="confirmed"/); assert.match(conf, /Last confirmed/); assert.match(conf, /datetime="2026-11-01"/i); assert.match(conf, /data-price-figure/);
  for (const [v, label] of [[{ state: 'unknown' }, 'لسه مش متأكدين'], [{ state: 'conflict' }, 'المصادر مختلفة'], [{ state: 'dealer', value: 1250, source: { name: '', url: null } }, 'لسه مش متأكدين']]) {
    const h = html(v);
    assert.match(h, new RegExp(label)); assert.doesNotMatch(h, /data-price-figure/); assert.doesNotMatch(h, /\d{3}/);
  }
});

test('GTM helpers: language from the path; English budget bands; only whitelisted keys are pushed', () => {
  assert.equal(G.siteLanguage('/en/cars'), 'en'); assert.equal(G.siteLanguage('/ar'), 'ar');
  assert.equal(G.budgetBand(900000), 'Under EGP 1M'); assert.equal(G.budgetBand(1000000), 'EGP 1M – 1.5M'); assert.equal(G.budgetBand(1500000), 'EGP 1.5M – 2.5M');
  assert.equal(G.budgetBand(2500000), 'EGP 2.5M+'); assert.equal(G.budgetBand(undefined), 'unknown'); assert.equal(G.budgetBand('2000000'), 'unknown');
  globalThis.window = { dataLayer: [] };
  try {
    G.pushGtm({ event: 'lead', email: 'x@y.z', phone: '010' });
    G.pushGtm({ event: 'page_context', site_language: 'en', text: 'hello' });
    G.pushGtm({ event: 'find_my_car_complete', budget_band: 'EGP 2.5M+', result_count: 3, brief: { text: 'x' } });
    G.pushGtm({ event: 'not_allowed', x: 1 });
    assert.deepEqual(window.dataLayer, [{ event: 'lead' }, { event: 'page_context', site_language: 'en' }, { event: 'find_my_car_complete', budget_band: 'EGP 2.5M+', result_count: 3 }]);
  } finally { delete globalThis.window; }
});

test('GTM loader is unchanged and still production-only', () => {
  const g = fs.readFileSync('src/components/GoogleTagManager.tsx', 'utf8');
  assert.match(g, /export const GTM_ID = 'GTM-5WVQ2M7S';/);
  const layout = fs.readFileSync('src/app/[locale]/layout.tsx', 'utf8');
  assert.match(layout, /\{env === 'production' \? <GtmHead \/> : null\}/); assert.match(layout, /\{env === 'production' \? <GtmNoScript \/> : null\}/);
});
