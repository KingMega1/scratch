// Engine invariants. Run: node tests/engine.test.js
const assert = require('node:assert');
const E = require('../app/engine.js');
const U = require('../data/p2_view.v1.json');

const answers = [];
for (const seats of ['five', 'seven']) for (const usage of ['city', 'mixed', 'long']) for (const charging of ['yes', 'no', 'unsure'])
  for (const powertrain of ['any', 'petrol', 'hybrid', 'ev']) for (const priorities of [[], ['pocket'], ['popular'], ['warranty'], ['pocket', 'popular']])
    for (const budget of [1_600_000, 2_000_000, 2_400_000]) for (const stretch of [false, true])
      answers.push({ budget, stretch, seats, usage, charging, powertrain, priorities });

let heroes = 0, noMatch = 0;
const modes = {}, heroCount = {};
for (const a of answers) {
  const r = E.recommend(U, a);
  if (!r.hero) { noMatch++; assert.ok(Array.isArray(r.relax)); continue; }
  heroes++;
  modes[r.mode] = (modes[r.mode] || 0) + 1;
  heroCount[r.hero.model.slug] = (heroCount[r.hero.model.slug] || 0) + 1;
  // hero fits the limit; alternatives are distinct and at most 3
  assert.ok(r.hero.pick.max <= E.limitOf(a), 'hero within limit');
  const ids = [r.hero.id, ...r.alternatives.map(x => x.id)];
  assert.strictEqual(new Set(ids).size, ids.length, 'distinct');
  assert.ok(r.alternatives.length <= 3);
  if (r.eligible >= 3) assert.ok(r.alternatives.length >= 2, `>=2 alternatives when >=3 eligible (${JSON.stringify(a)})`);
  // hard filters respected
  if (a.seats === 'seven') assert.ok(E.hasSeven(r.hero.model));
  if (a.charging === 'no') assert.notStrictEqual(r.hero.pick.powertrain, 'ev');
  if (a.powertrain === 'hybrid' || a.powertrain === 'ev') assert.strictEqual(r.hero.pick.powertrain, a.powertrain);
}

// Coverage neutrality: making every trim single-source, or every trim agreed, must not change any ranking.
const clone = JSON.parse(JSON.stringify(U));
const flip = st => { const u = JSON.parse(JSON.stringify(clone)); u.models.forEach(m => { m.gaps = []; m.trims.forEach(t => { t.status = st; t.sources = st === 'AGREED' ? ['a', 'b', 'c'] : ['a']; }); }); return u; };
const Ua = flip('AGREED'), Us = flip('SINGLE_SOURCE');
for (const a of answers.filter((_, i) => i % 7 === 0)) {
  const x = E.recommend(Ua, a).ranking, y = E.recommend(Us, a).ranking, z = E.recommend(U, a).ranking;
  assert.deepStrictEqual(x && x.map(r => r.id), y && y.map(r => r.id), 'ranking independent of source coverage');
  assert.deepStrictEqual(z && z.map(r => r.id), y && y.map(r => r.id), 'ranking independent of real coverage');
}

console.log(`OK ${answers.length} answer sets · heroes ${heroes} · no-match ${noMatch}`);
console.log('modes', modes);
console.log('hero distribution', Object.entries(heroCount).sort((a, b) => b[1] - a[1]));
