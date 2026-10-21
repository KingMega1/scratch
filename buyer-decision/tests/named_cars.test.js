// Named-car scenarios (EN/AR): what a buyer is told when they name a car. Run: node tests/named_cars.test.js [dataset dir]
// Invariants: a P2-identified market car is never described as "not sold in Egypt"; missing price / size / evidence is
// stated as such; the conflict heading never claims the buyer's requirements ruled the car out when data is missing.
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const ds = T.loadAcceptedDataset(process.argv[2] || path.join(__dirname, '..', 'datasets/U12C2-RC2-2026-10-14'));
const by = Object.fromEntries(ds.U.models.map(m => [m.id, m]));
let n = 0, fails = 0; const gaps = [];
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } };
const NOT_SOLD = [/isn’t sold new in Egypt/, /مش بتتباع جديدة في مصر/];
const run = (t, lang, extra = {}) => {
  let b = T.normalize({ ...T.understand(t, ds, { locale: lang }), ...extra }, ds);
  if (!b.budget) b = T.normalize({ ...b, budget: 5e6, budgetMode: 'around' }, ds);
  const o = T.execute(b, ds, { locale: lang, asOf: '2026-10-14' }), r = E.recommend(ds.U, b);
  const text = JSON.stringify(o.notices.map(x => x.text)) + (o.hero ? '' : JSON.stringify(o.no_match));
  return { b, o, r, text, rows: r.shortlist ? r.shortlist.rows : [] };
};
const cases = [
  // [buyer text, lang, expected named id, expected outcome: 'recommended' | reason key]
  ["I'm considering the Mercedes GLC, budget 5.5M", 'en', 'mercedes/glc', 'recommended'],
  ['بفكر في مرسيدس GLC وميزانيتي 5.5 مليون', 'ar', 'mercedes/glc', 'recommended'],
  ["I'm considering the Toyota Corolla, budget 1.6M", 'en', 'toyota/corolla', 'recommended'],
  ['بفكر في تويوتا كورولا في حدود 1.6 مليون', 'ar', 'toyota/corolla', 'recommended'],
  ["I'm considering the Geely EX5 EM-i", 'en', 'geely/ex5-em-i', by['geely/ex5-em-i'] && by['geely/ex5-em-i'].held === 'size' ? 'unknown_size' : 'unknown_price'],
  ['Range Rover, budget 10 million', 'en', 'land-rover/range-rover', 'unknown_price'],
  ['Toyota Corolla Hybrid, budget 2M', 'en', 'toyota/corolla-hybrid', by['toyota/corolla-hybrid'] && by['toyota/corolla-hybrid'].trims.length ? 'eligible' : 'unknown_price'],
  ['Toyota Land Cruiser, budget 8M', 'en', 'toyota/land-cruiser', 'unknown_price'],
  ['تويوتا لاند كروزر بميزانية 8 مليون', 'ar', 'toyota/land-cruiser', 'unknown_price'],
  ['Denza B3, budget 3M', 'en', 'denza/b3', 'unknown_price'],
  ['Denza B8, budget 4M', 'en', 'denza/b8', 'unknown_price'],
  ['بفكر في جيلي EX5 EM-i', 'ar', 'geely/ex5-em-i', by['geely/ex5-em-i'] && by['geely/ex5-em-i'].held === 'size' ? 'unknown_size' : 'unknown_price'],
  ['Denza B5, budget 3M', 'en', 'denza/b5', 'unknown_price'],
  ['BMW M4, budget 8M', 'en', 'bmw/m4', 'scope'],
];
for (const [t, lang, id, want] of cases) {
  const { o, rows, text } = run(t, lang);
  const row = rows.find(x => x.id === id);
  // full-Arabic text can only be recognised when P2 supplies an Arabic model name: report that gap (P2 handoff), don't hide it
  if (!row && lang === 'ar' && by[id] && !((by[id].ar || {}).model || []).length && !/[A-Za-z]/.test(t)) { gaps.push(`${id} (no Arabic model name from P2): ${t}`); continue; }
  ok(!!row, `${t}: named car ${id} recognised (named: ${rows.map(x => x.id).join(', ') || 'none'})`);
  if (!row) continue;
  if (want === 'recommended') ok(row.ok && o.hero && o.hero.id === id, `${t}: ${id} recommended (got ${o.hero && o.hero.id})`);
  else if (want === 'eligible') ok(row.ok, `${t}: ${id} eligible (got ${row.why})`);
  else ok(!row.ok && row.why === want, `${t}: ${id} reason ${row.why} (want ${want})`);
  ok(!NOT_SOLD.some(re => re.test(text)), `${t}: says "not sold in Egypt" for a market car`);
  if (want !== 'recommended' && o.notices.length) ok(!/rule out|بتستبعد/.test(o.notices[0].text), `${t}: heading claims requirements ruled it out`);
  console.log(`  ${lang} | ${t} -> ${row.ok ? (o.hero && o.hero.id === id ? 'recommended' : 'eligible') : row.why} | ${(o.notices[0] || { text: o.hero ? o.hero.name.text : '' }).text.slice(0, 150)}`);
}
// no P2-identified car anywhere in the view resolves to "not on sale"
// except cars P2 records as discontinued (manifest changes.off_sale): for those "not sold new in Egypt" is the truth
const dir0 = process.argv[2] || path.join(__dirname, '..', 'datasets/U12C2-RC2-2026-10-14');
const offSale = new Set(((JSON.parse(fs.readFileSync(path.join(dir0, 'manifest.json'), 'utf8')).changes || {}).off_sale) || []);
const bad = ds.U.models.filter(m => !m.u && !offSale.has(m.id) && E.eligibility(m, { budget: 1e9 }, E.territory({ budget: 1e9 })).reason === 'not_on_sale');
ok(!bad.length, `market cars still reported as not on sale: ${bad.map(m => m.id).join(', ')}`);
gaps.forEach(g => console.log('KNOWN DATA GAP ' + g));
console.log(`named cars: ${n - fails}/${n} checks pass (${ds.universe_version})`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
