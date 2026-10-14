import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specRows, warrantyItems, galleryImages, brochureLinks, validValue, parseScope, SPEC_FIELDS } from '../../src/server/vehicles/p2-content.ts';

const release = JSON.parse(readFileSync('data/registry/catalogue-serving.release.json', 'utf8'));
const manifest = JSON.parse(readFileSync('data/registry/p2-import.manifest.json', 'utf8'));
const sizes = new Map(manifest.files.map(f => [f.src, [f.width, f.height]]));
const E = id => release.entries.find(e => e.p1_id === id);

test('release is the imported P2 release and every referenced media file is present with its size', () => {
  assert.equal(release.release_id, manifest.release_id);
  for (const f of manifest.files) { assert.match(f.src, /^\/media\/p2\/(models|brands)\//); assert.ok(f.width > 0 && f.height > 0, f.src); readFileSync('public' + f.src); }
});

test('every accepted spec value is shown under a customer label, except malformed values (never an internal code)', () => {
  const labels = new Set(SPEC_FIELDS.map(f => f[0]));
  let shown = 0;
  for (const e of release.entries) for (const r of specRows(e.accepted, e.brand)) {
    assert.ok(labels.has(r.field)); assert.doesNotMatch(r.label.en + r.label.ar, /_/); shown++;
    for (const l of r.lines) { assert.ok(validValue(r.field, l.value.replace(/ \(.*\)$/, '')) || /\(/.test(l.value)); assert.ok(l.sources.length); assert.ok(l.scopes.length); }
  }
  assert.ok(shown > 1500, String(shown));
  // the one header string that leaked into P2 data is not shown
  assert.equal(specRows(E('changan/cs35-plus').accepted, 'Changan').find(r => r.field === 'engine'), undefined);
});

test('exact-trim differences stay separate; same figure from several sources is merged, not averaged', () => {
  const hs = specRows(E('mg/hs').accepted, 'MG');
  const tq = hs.find(r => r.field === 'torque_nm');
  assert.equal(tq.variation, 'by-trim');
  assert.deepEqual(tq.lines.map(l => l.value).sort(), ['275', '340']);
  const cs = specRows(E('changan/cs35-plus').accepted, 'Changan').find(r => r.field === 'power_hp');
  assert.equal(cs.lines.length, 1); assert.equal(cs.lines[0].value, '160'); assert.equal(cs.lines[0].sources.length, 3);
});

test('warranty types are separated and scoped; nothing is generalised across trims', () => {
  const g = warrantyItems(E('deepal/g318').accepted, 'Deepal');
  assert.deepEqual(g.map(w => [w.kind, w.years, w.km]), [['vehicle', 6, 250000], ['range-extender', 8, 250000]]);
  const bmw = warrantyItems(E('bmw/ix3').accepted, 'BMW');
  assert.deepEqual(bmw.map(w => [w.kind, w.upTo, w.termsApply]), [['extended', true, true], ['maintenance', false, true]]);
  const atto = warrantyItems(E('byd/atto-8').accepted, 'BYD');
  assert.deepEqual(atto.map(w => [w.kind, w.years, w.km]), [['vehicle', 6, 150000], ['battery', 8, 200000]]);
  const kia = warrantyItems(E('kia/ev3').accepted, 'Kia');
  assert.equal(kia[0].km, null); // source states no km: none is invented
  assert.equal(parseScope('market trim pages: model').kind, 'model');
});

test('gallery uses served files with real sizes; Drive brochures are not linked until verified public', () => {
  let n = 0;
  for (const e of release.entries) for (const g of galleryImages(e.accepted, sizes)) { n++; assert.match(g.src, /^\/media\/p2\/models\//); assert.deepEqual([g.width, g.height], sizes.get(g.src)); }
  assert.ok(n >= 150, String(n));
  for (const e of release.entries) for (const b of brochureLinks(e.accepted, new Set())) { assert.notEqual(b.host, 'drive.google.com'); assert.match(b.url, /^https:\/\//); }
  const drive = E('baic/x55').accepted.brochures[0].url;
  assert.equal(brochureLinks(E('baic/x55').accepted, new Set()).length, 0);
  assert.equal(brochureLinks(E('baic/x55').accepted, new Set([drive])).length, 1);
});
