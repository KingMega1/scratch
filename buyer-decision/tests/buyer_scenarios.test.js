// Realistic Egyptian buyer scenarios (EN/AR) with hard assertions on the released semantics. No ranking expectations are
// hard-coded (ranking is guarded by tests/regression); this checks that every result honours the brief and the data.
// Run: node tests/buyer_scenarios.test.js [dataset dir] [out.md]
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const ds = T.loadAcceptedDataset(process.argv[2] || path.join(__dirname, '..', 'datasets/U12-RC4-2026-10-21'));
const U = ds.U, by = Object.fromEntries(U.models.map(m => [m.id, m]));
const AS_OF = '2026-10-21';
// [group, lang, text, pair key (EN/AR twins must agree)]
const S = [
  ['budget', 'en', 'Cheapest new sedan, maximum 800 thousand', 'b1'], ['budget', 'ar', 'عايز ارخص عربية سيدان جديدة لحد 800 ألف', 'b1'],
  ['budget', 'en', 'Small SUV, maximum 1 million', 'b2'], ['budget', 'ar', 'عربية عالية صغيرة لحد مليون', 'b2'],
  ['budget', 'en', 'Sedan around 1.2 million'], ['budget', 'en', 'SUV between 1.5 and 1.8 million'],
  ['budget', 'en', 'Hatchback under 1 million for the city'], ['budget', 'en', 'First car for my daughter, max 900k'],
  ['family', 'en', '7 seater for my family, maximum 2.2M', 'f1'], ['family', 'ar', 'عايز ٧ راكب لمراتي والأولاد لحد 2.2 مليون', 'f1'],
  ['family', 'en', 'Family SUV around 1.5M, space matters'], ['family', 'ar', 'عربية عالية للعيلة في حدود 1.5 مليون والمساحة مهمة'],
  ['family', 'en', '7-seat MPV around 1.5M'], ['family', 'en', 'Big family SUV around 3 million, 7 seats'],
  ['ev', 'en', 'Electric SUV around 2M'], ['ev', 'ar', 'عايز عربية كهربا في حدود 2 مليون'], ['ev', 'en', 'Electric car, maximum 1.5M'],
  ['hev', 'en', 'Hybrid SUV around 1.8M'], ['hev', 'ar', 'عايز عربية عالية هايبرد في حدود 1.8 مليون'], ['hev', 'en', 'Hybrid sedan, maximum 1.6M, no Toyota'],
  ['phev', 'en', 'Plug-in hybrid SUV around 2M'], ['phev', 'en', 'PHEV around 1.6 million'],
  ['negation', 'en', 'SUV, maximum 1.5M, no Chinese brands', 'n1'], ['negation', 'ar', 'عايز عربية عالية مش صيني لحد 1.5 مليون', 'n1'],
  ['negation', 'en', 'Sedan around 1.2M, not electric'], ['negation', 'en', 'SUV around 2M, no hybrid and no EV'],
  ['negation', 'en', 'Petrol only, SUV around 1.5M'], ['negation', 'en', 'SUV around 1.3M, no Chery, no Jetour'],
  ['premium', 'en', 'Premium SUV around 5 million'], ['premium', 'ar', 'عربية عالية فخمة في حدود 5 مليون'],
  ['premium', 'en', 'Luxury sedan around 6 million'], ['premium', 'en', "I'm considering the Mercedes GLC, budget 5.5M"],
  ['tradeoff', 'en', 'SUV, maximum 1.5M, can stretch a bit for the right car'], ['tradeoff', 'en', 'Cheapest 7 seater possible'],
  ['tradeoff', 'en', 'Something like the Tucson but cheaper'], ['tradeoff', 'en', 'Reliable family car with good resale, around 1.4M'],
  ['tradeoff', 'en', '4x4 SUV around 2.5M for off-road trips'], ['tradeoff', 'ar', 'عايز عربية اوف رود دفع رباعي في حدود 2.5 مليون'],
  ['missing', 'en', 'Range Rover, budget 10 million'], ['missing', 'en', "I'm considering the Geely EX5 EM-i"],
  ['missing', 'en', 'Geely Emgrand 7, budget 1M'], ['missing', 'en', 'Kia Carnival, budget 3M'],
];
let n = 0, fails = 0; const fail = []; const rows = [];
const ok = (c, msg) => { n++; if (!c) { fails++; fail.push(msg); } };
const pairs = {};
for (const [g, lang, text, pair] of S) {
  let b = T.normalize(T.understand(text, ds), ds);
  if (!b.budget) b = T.normalize({ ...b, budget: 5000000, budgetMode: 'around' }, ds);
  const o = T.execute(b, ds, { locale: lang, asOf: AS_OF });
  const o2 = T.execute(b, ds, { locale: lang, asOf: AS_OF });
  const id = `${g}/${lang} "${text}"`;
  ok(JSON.stringify(o) === JSON.stringify(o2), `${id}: not deterministic`);
  const cars = o.hero ? [o.hero, ...o.alternatives] : [];
  const terr = E.territory(b);
  for (const c of cars) {
    const m = by[c.id];
    // eligibility under the brief: data present, constraints honoured (body, seats, chinese, brands, powertrain exclusions)
    ok(m && m.u && E.eligibility(m, b, terr).status === 'eligible', `${id}: ${c.id} shown but not eligible`);
    ok(!m.held, `${id}: held car ${c.id} shown`);
    // trim / model-year identity: every version shown is a current version of that car (latest model year)
    const cur = new Set(E.currentTrims(m).map(t => t.label));
    ok(c.versions.length && c.versions.every(v => cur.has(v.label)), `${id}: ${c.id} shows a non-current version`);
    // price limit: on a hard maximum, versions shown are within budget unless the result is an explicit stretch
    if (b.budgetMode === 'max' && !c.stretch) ok(c.versions.every(v => v.min <= b.budget), `${id}: ${c.id} version above max ${b.budget}`);
    if (c.stretch) ok(!!b.stretch || b.budgetMode !== 'max', `${id}: ${c.id} stretches a hard max without the buyer allowing it`);
    // negative constraints, checked straight on the data (independent of the engine)
    if (b.chinese === 'exclude') ok(m.chinese === false, `${id}: Chinese brand ${c.id} shown`);
    if ((b.brandsExclude || []).length) ok(!b.brandsExclude.includes(m.brand_id), `${id}: excluded brand ${c.id}`);
    const ex = new Set([...(b.ptNo || []), ...(b.pt === 'no_ev' ? ['ev'] : []), ...(b.pt === 'petrol' ? ['ev', 'hybrid'] : [])]);
    if (ex.size) ok(c.versions.some(v => { const pt = v.pt || (m.powertrains.length === 1 ? m.powertrains[0] : null); return pt && !ex.has(pt); }), `${id}: ${c.id} has no version outside the excluded powertrains`);
    if (b.seats === 7) ok((m.seats || []).some(s => s >= 7), `${id}: ${c.id} not 7 seats`);
    if ((b.body || []).length) ok(b.body.includes(m.body), `${id}: ${c.id} body ${m.body} not in ${b.body}`);
  }
  // confidence wording: one of the approved levels, never a "best" claim for an equal set
  if (o.confidence) ok(['clear', 'lean', 'tie', 'only'].includes(o.confidence.level), `${id}: confidence level ${o.confidence.level}`);
  if (o.mode === 'equal') ok(!/best|أحسن عربية/i.test(o.eyebrow ? o.eyebrow.text : ''), `${id}: equal set claims a best car`);
  // lower-cost alternative is actually cheaper than the lead
  if (o.less && o.hero) ok(o.less.price < Math.min(...o.hero.versions.map(v => v.min)), `${id}: spend-less card is not cheaper`);
  // missing evidence: named cars that cannot be recommended are reported, never shown as picks
  // missing evidence: a car without a price, held, or off sale is never shown as a pick (whatever the dataset says it is)
  ok(cars.every(c => by[c.id] && by[c.id].u && E.currentTrims(by[c.id]).length && !by[c.id].held), `${id}: unrecommendable car shown as a pick`);
  if (pair) (pairs[pair] = pairs[pair] || []).push({ lang, ids: cars.map(c => c.id).join(',') });
  rows.push(`| ${g} | ${lang.toUpperCase()} | ${text} | ${o.mode}${o.confidence ? '/' + o.confidence.level : ''} | ${cars.map(c => `${c.name.text} (${c.price_range.text})`).join('; ') || (o.no_match ? 'no match' : '-')}${o.less ? ` · spend less: ${o.less.id}` : ''}${o.notices.length ? ` · notice: ${o.notices[0].text.slice(0, 90)}` : ''} |`);
}
for (const [k, v] of Object.entries(pairs)) ok(v.length === 2 && v[0].ids === v[1].ids, `EN/AR pair ${k} differs: ${v.map(x => x.lang + '=' + x.ids).join(' / ')}`);
fail.forEach(f => console.log('FAIL ' + f));
console.log(`buyer scenarios: ${n - fails}/${n} checks pass, ${S.length} scenarios (${ds.universe_version})`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], ['| Group | Lang | Buyer says | Result | Cars (in-range price) |', '|---|---|---|---|---|', ...rows].join('\n') + '\n');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
