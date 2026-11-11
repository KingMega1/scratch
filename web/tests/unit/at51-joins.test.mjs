import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const crosswalk = read('data/registry/display-crosswalk.TEMP.json').map;
const site = new Map(read('data/registry/universe.snapshot.json').view.models.map(m => [m.slug, m]));
const p1 = new Map(read('p1-release/buyer-decision/datasets/U11-2026-09-26/recommendation_view.json').models.map(m => [m.id, m]));
const key = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

test('AT-51 exact P1/site joins: 21 on-sale, 3 off-sale, no missing/mismatched names', () => {
  let on = 0, off = 0;
  for (const [slug, row] of Object.entries(crosswalk)) {
    const m = p1.get(row.matched_old_id), car = site.get(slug);
    assert.ok(m, 'missing P1 ID: ' + row.matched_old_id);
    assert.ok(car, 'missing site slug: ' + slug);
    assert.equal(key(car.brand + car.model), key(m.brand + m.model), slug);
    if (m.u === true) on++; else off++;
  }
  assert.equal(on, 21);
  assert.equal(off, 3);
  assert.equal(Object.keys(crosswalk).length, 24);
  for (const [id, slug] of [['soueast/s-06','soueast-s06'],['soueast/s-09','soueast-s09'],['deepal/s-05','deepal-s05']]) {
    assert.equal(crosswalk[slug].matched_old_id, id);
    assert.equal(p1.get(id).u, true);
  }
});
