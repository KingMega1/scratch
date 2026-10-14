// Realistic Egyptian buyer scenarios (EN/AR) on a dataset; prints a markdown table. Run: node tests/scenarios.js <dataset dir> [out.md]
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const ds = T.loadAcceptedDataset(process.argv[2] || T.LAUNCH_SNAPSHOT), U = ds.U, by = Object.fromEntries(U.models.map(m => [m.id, m]));
const S = [
  ['budget', 'en', 'Cheapest reliable sedan under 800 thousand'], ['budget', 'ar', 'عايز عربية سيدان رخيصة لحد 800 ألف'],
  ['budget', 'en', 'Small SUV around 1 million'], ['budget', 'ar', 'عربية عالية صغيرة في حدود مليون'],
  ['family', 'en', '7-seat family car, maximum EGP 2.2M'], ['family', 'ar', 'عايز ٧ راكب لمراتي والأولاد لحد 2.2 مليون'],
  ['family', 'en', 'Family SUV around EGP 1.5M, space matters'], ['family', 'ar', 'عربية عالية للعيلة في حدود 1.5 مليون والمساحة مهمة'],
  ['premium', 'en', 'Premium SUV around 5 million'], ['premium', 'ar', 'عربية عالية فخمة في حدود 5 مليون'],
  ['premium', 'en', "I'm considering the Mercedes GLC, budget 5.5M"], ['premium', 'en', 'Range Rover, budget 10 million'],
  ['premium', 'en', 'Luxury sedan around 6 million'],
  ['hybrid', 'en', 'Hybrid SUV around 1.5M'], ['hybrid', 'ar', 'عايز عربية عالية هايبرد في حدود 1.5 مليون'],
  ['hybrid', 'en', "I'm considering the Geely EX5 EM-i"], ['hybrid', 'en', 'BAIC X55e hybrid'], ['hybrid', 'en', 'Venucia V-Online'],
  ['hybrid', 'en', 'Plug-in hybrid SUV around 2M'],
  ['ev', 'en', 'Electric SUV around 2M'], ['ev', 'ar', 'عايز عربية كهربا في حدود 2 مليون'], ['ev', 'en', 'Electric car under 1.5M'],
];
const L = ['| Segment | Lang | Buyer says | Eligible | Result |', '|---|---|---|---|---|'];
for (const [seg, lang, t] of S) {
  let b = T.normalize(T.understand(t, ds), ds);
  if (!b.budget) b = T.normalize({ ...b, budget: 5000000, budgetMode: 'around' }, ds);
  const o = T.execute(b, ds, { locale: lang, asOf: '2026-10-14' }), r = E.recommend(U, b);
  const names = o.hero ? [o.hero, ...o.alternatives].map(x => x.name.text) : [];
  const sl = r.shortlist ? ' · named: ' + r.shortlist.rows.map(x => `${x.id} ${x.ok ? 'eligible' : 'not recommendable (' + x.why + ')'}`).join(', ') : '';
  const unk = Object.keys(r.unknown || {}).length ? ` (unknown: ${JSON.stringify(r.unknown)})` : '';
  L.push(`| ${seg} | ${lang.toUpperCase()} | ${t} | ${r.eligible}${unk} | ${o.mode}${o.confidence ? '/' + o.confidence.level : ''}: ${names.join(', ') || (o.no_match && o.no_match.nearest_above.length ? 'nearest above: ' + o.no_match.nearest_above.map(x => x.id).join(', ') : 'no match')}${sl} |`);
}
const out = L.join('\n') + '\n';
if (process.argv[3]) fs.writeFileSync(process.argv[3], out);
console.log(out);
