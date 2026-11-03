// CEO-observed recommendation failures (2026-11-03): exact input -> interpreted brief -> eligible candidates -> result.
// Each case asserts the chain, through the real flow (understand -> nextQuestion answers -> normalize/editBrief -> execute).
// Run: node tests/ceo_failures.test.js [dataset dir]
'use strict';
const path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const ds = T.loadAcceptedDataset(process.argv[2] || path.join(__dirname, '..', 'datasets/U12-CEO-2026-11-03'));
const by = Object.fromEntries(ds.U.models.map(m => [m.id, m]));
const AS_OF = '2026-11-03';
const DEF = { budget: { budget: 1500000, budgetMode: 'around' }, size: { sizePref: 'medium' }, pt: { pt: 'open' }, chinese: { chinese: 'open' },
  usage: { usage: 'mixed' }, priorities: { priorities: [] }, drive: { drive4: false }, attraction: { attraction: 'size' }, body: { body: ['suv'] }, seats: { seats: 5 } };
let n = 0, fails = 0; const fail = [];
const ok = (c, msg) => { n++; if (!c) { fails++; fail.push(msg); } };
function journey(text, { answers = {}, edits = [] } = {}) {
  const locale = /[؀-ۿ]/.test(text) ? 'ar' : 'en';
  let b = T.understand(text, ds, { locale }); const parsed = JSON.parse(JSON.stringify(b)); const asked = [];
  for (let q, g = 0; (q = T.nextQuestion(b, asked, ds)) && g < 12; g++) { asked.push(q); b = T.mergeAnswer(b, answers[q] || DEF[q] || {}, ds); }
  b = T.normalize(b, ds);
  for (const e of edits) b = T.editBrief(b, e, ds);
  const o = T.execute(b, ds, { locale, asOf: AS_OF }), r = E.recommend(ds.U, b);
  return { parsed, b, o, r, asked, cars: o.hero ? [o.hero, ...o.alternatives] : [] };
}
const terr = b => E.territory(b);
const allEligible = (J, id) => J.cars.forEach(c => ok(E.eligibility(by[c.id], J.b, terr(J.b)).status === 'eligible', `${id}: ${c.id} shown but not eligible`));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Budget ranges and the approved 10% flexibility
for (const [id, t] of [['range-en', 'SUV from 1.2M to 1.5M'], ['range-ar', 'من 1.2 مليون لـ 1.5 مليون عربية عالية'], ['between-en', 'SUV between 1.5 and 1.8 million']]) {
  const J = journey(t), lo = J.parsed.budgetMin, hi = J.parsed.budget;
  ok(J.parsed.budgetMode === 'range' && lo && hi > lo, `${id}: range not understood ${JSON.stringify([J.parsed.budgetMode, lo, hi])}`);
  ok(J.cars.length > 0, `${id}: no result`);
  J.cars.forEach(c => ok(c.versions.some(v => v.min >= lo * 0.95 && v.min <= hi * 1.1), `${id}: ${c.id} has no version inside the range`));
  allEligible(J, id);
}
{ const J = journey('budget 1.5M, can go up to 10% more', { answers: { body: { body: ['suv'] } } });
  ok(J.parsed.stretch === true, 'stretch-en: 10% flexibility lost'); ok(terr(J.b).ceil === 1650000, `stretch-en: ceiling ${terr(J.b).ceil} (want 1,650,000)`);
  J.cars.forEach(c => ok(c.versions.every(v => v.min <= 1650000), `stretch-en: ${c.id} above +10%`)); }
{ const J = journey('ميزانيتي 1.5 مليون وممكن ازيد ١٠٪', { answers: { body: { body: ['suv'] } } }); ok(J.parsed.stretch === true, 'stretch-ar: flexibility lost'); }
{ const J = journey('SUV, maximum 1.5M, no flexibility'); ok(terr(J.b).ceil === 1500000, `max-firm: ceiling ${terr(J.b).ceil}`);
  J.cars.forEach(c => ok(c.versions.every(v => v.min <= 1500000), `max-firm: ${c.id} above a firm max`)); }

// 2. Explicit brand constraints
for (const [id, t, only] of [['byd-only-1', 'BYD only, 2M', ['byd']], ['byd-only-2', 'I only want a BYD, around 2M', ['byd']], ['byd-only-3', 'BYD, nothing else, 1.8M', ['byd']],
  ['byd-only-4', 'BYD exclusively, 2M', ['byd']], ['byd-only-ar1', 'عايز BYD بس في حدود 2 مليون', ['byd']], ['byd-only-ar2', 'مش عايز غير BYD في حدود 2 مليون', ['byd']],
  ['byd-mg-only', 'only BYD or MG, 2M', ['byd', 'mg']], ['byd-mg-only-ar', 'مش عايز غير BYD او MG في حدود 2 مليون', ['byd', 'mg']]]) {
  const J = journey(t);
  ok(eq(J.parsed.brandsOnly, only), `${id}: brandsOnly ${JSON.stringify(J.parsed.brandsOnly)} (want ${only})`);
  ok(J.cars.length > 0 && J.cars.every(c => only.includes(by[c.id].brand_id)), `${id}: other brand shown: ${J.cars.map(c => c.id)}`);
  ok(J.r.blocked && J.r.blocked.brand_only > 0, `${id}: other brands not blocked`);
}
for (const [id, t] of [['not-byd-ar', 'عايز اي حاجه غير BYD في حدود 2 مليون'], ['not-byd-en', 'anything but BYD, 2M'], ['no-byd', 'no BYD, 2M SUV']]) {
  const J = journey(t); ok(eq(J.parsed.brandsExclude, ['byd']) && !J.parsed.brandsOnly, `${id}: ${JSON.stringify([J.parsed.brandsOnly, J.parsed.brandsExclude])}`);
  ok(J.cars.every(c => by[c.id].brand_id !== 'byd'), `${id}: BYD shown`);
}
// the same phrasings for EVERY brand in the catalogue, by its Latin and its Arabic name (not a BYD special case).
// "جيب" is excluded by design: in Egyptian Arabic it means any SUV, not the Jeep brand (write "Jeep").
{ const brands = {}; for (const m of ds.U.models) if (!brands[m.brand_id]) brands[m.brand_id] = [m.brand, ...((m.ar && m.ar.brand) || []).slice(0, 1)];
  const tpl = [['{b} only, 2M', 'only'], ['I only want a {b}, 2M', 'only'], ['{b}, nothing else, 2M', 'only'], ['مش عايز غير {b} في حدود 2 مليون', 'only'],
    ['عايز {b} بس في حدود 2 مليون', 'only'], ['عايز اي حاجه غير {b} في حدود 2 مليون', 'excl'], ['مش عايز {b} في حدود 2 مليون', 'excl'], ['no {b}, 2M', 'excl']];
  let cases = 0; const bad = [];
  for (const [id, names] of Object.entries(brands)) for (const name of names) { if (name === 'جيب') continue;
    for (const [tp, want] of tpl) { const txt = tp.replace('{b}', name), b = T.understand(txt, ds); cases++;
      const inOnly = (b.brandsOnly || []).includes(id), inEx = (b.brandsExclude || []).includes(id), inPref = (b.brandsPrefer || []).includes(id);
      if (want === 'only' ? !(inOnly && !inEx && !inPref) : !(inEx && !inOnly)) bad.push(txt); } }
  ok(cases > 1000 && !bad.length, `all-brands: ${bad.length}/${cases} phrasings wrong: ${bad.slice(0, 5).join(' | ')}`);
  for (const [t, only] of [['Toyota or Hyundai only, 1.5M', ['hyundai', 'toyota']], ['تويوتا او هيونداي بس في حدود 1.5 مليون', ['hyundai', 'toyota']], ['Mercedes-Benz only, 5M', ['mercedes']]]) {
    const b = T.understand(t, ds); ok(eq([...(b.brandsOnly || [])].sort(), only) && !(b.brandsPrefer || []).length, `brand-list: ${t} -> ${JSON.stringify([b.brandsOnly, b.brandsPrefer])}`); }
  ok(eq(T.understand('Toyota or Hyundai, 1.5M', ds).brandsPrefer, ['toyota', 'hyundai']), 'brand-list: a plain "X or Y" became a hard filter');
}
{ const J = journey('I like BYD and MG, 1.5M SUV'); ok(eq(J.parsed.brandsPrefer, ['byd', 'mg']) && !J.parsed.brandsOnly, 'brand-prefer: a liked brand became a hard filter'); }

// 3/4. Negations, fuel preferences, priorities and revised answers survive parsing, editing, ranking and results
{ const J = journey('Sedan max 1.6M for long highway drives, not electric');
  ok(eq(J.parsed.ptNo, ['ev']) && J.b.pt === 'no_ev', 'neg-ev: not understood');
  J.cars.forEach(c => ok(c.versions.some(v => { const t = E.currentTrims(by[c.id]).find(x => x.label === v.label); const pt = t && (t.pt || ((by[c.id].powertrains || []).length === 1 ? by[c.id].powertrains[0] : null)); return pt && pt !== 'ev'; }), `neg-ev: ${c.id} has no non-electric version`));
  const R = journey('Sedan max 1.6M for long highway drives, not electric', { edits: [{ pt: 'open' }] });
  ok(R.b.pt === 'open' && !(R.b.ptNo || []).length, `revise-pt: exclusion survived the buyer removing it ${JSON.stringify([R.b.pt, R.b.ptNo])}`);
  ok(!T.summary(R.b, ds).some(x => x.key === 'pt_no'), 'revise-pt: summary still says "Not: Electric"'); }
{ const J = journey('SUV around 1.8M, space and fuel economy matter most, no Chinese brands');
  ok(eq(J.b.priorities, ['space', 'economy']) && J.b.chinese === 'exclude', `prio: ${JSON.stringify([J.b.priorities, J.b.chinese])}`);
  ok(J.r.factors.includes('space') && J.r.factors.includes('economy'), `prio: not used in ranking ${J.r.factors}`);
  J.cars.forEach(c => ok(by[c.id].chinese === false, `prio: Chinese brand ${c.id} shown`));
  const R = journey('SUV around 1.8M, space and fuel economy matter most, no Chinese brands', { edits: [{ priorities: ['space'] }, { budget: 2200000, budgetMode: 'max' }] });
  ok(eq(R.b.priorities, ['space']) && !R.r.factors.includes('economy'), `revise-prio: removed priority still ranks ${JSON.stringify([R.b.priorities, R.r.factors])}`);
  ok(R.b.budget === 2200000 && R.b.budgetMode === 'max' && R.b.chinese === 'exclude', 'revise-budget: edit lost or other answers dropped'); }
{ const J = journey('SUV 2M, I care most about resale value and low running costs');
  ok((J.parsed.priorities || []).includes('economy') && (J.parsed.checks || []).includes('resale'), `running-costs: ${JSON.stringify([J.parsed.priorities, J.parsed.checks])}`); }
{ const J = journey('عايز عربية عالية للعيلة في حدود 1.8 مليون، الأهم عندي البنزين والمساحة، ومش عايز صيني');
  ok(J.parsed.pt !== 'petrol' && (J.parsed.priorities || []).includes('economy') && (J.parsed.priorities || []).includes('space'), `fuel-ar: "البنزين" as a priority became ${JSON.stringify([J.parsed.pt, J.parsed.priorities])}`); }
{ const J = journey('بنزين بس، عربية عالية 1.5 مليون'); ok(J.parsed.pt === 'petrol', 'petrol-only-ar: lost'); }
{ const R = journey('BYD only, 2M', { edits: [{ brandsOnly: [] }] }); ok(!(R.b.brandsOnly || []).length && R.cars.some(c => by[c.id].brand_id !== 'byd'), 'revise-brand: removed only-brand still filters'); }

// 5. Fully electric is distinct; hybrids and plug-ins are not misclassified
{ const J = journey('fully electric SUV around 2M');
  ok(J.parsed.pt === 'ev', 'ev: not understood'); ok(J.cars.length > 0 && J.cars.every(c => c.versions.every(v => { const t = E.currentTrims(by[c.id]).find(x => x.label === v.label); return (t && (t.pt || (by[c.id].powertrains.length === 1 && by[c.id].powertrains[0]))) === 'ev'; })), `ev: non-electric version shown ${J.cars.map(c => c.id)}`); }
{ const J = journey('عايز عربية عالية كهربا بالكامل في حدود 2 مليون'); ok(J.parsed.pt === 'ev', 'ev-ar: not understood'); }
{ const J = journey('plug-in hybrid SUV around 1.8M, no fully electric cars');
  ok(J.parsed.pt === 'hybrid' && eq(J.parsed.ptNo, ['ev']) && (J.parsed.checks || []).includes('plugin'), `phev: ${JSON.stringify([J.parsed.pt, J.parsed.ptNo, J.parsed.checks])}`);
  ok(J.cars.every(c => !c.versions.every(v => v.pt === 'ev')), 'phev: an electric-only car shown');
  ok(J.o.checks.some(x => /plug-in/i.test(x.text)), 'phev: plug-in check missing from results');
  ok(T.summary(J.b, ds).some(x => /Plug-in/.test(x.value.text)), 'phev: plug-in missing from the summary'); }
{ const J = journey('عايز SUV هايبرد بتتشحن بحوالي ١.٨ مليون جنيه ومش عايز عربية كهربا بالكامل'); ok((J.parsed.checks || []).includes('plugin') && J.parsed.pt === 'hybrid', 'phev-ar: lost'); }
{ const J = journey('hybrid SUV 1.8M'); ok(J.parsed.pt === 'hybrid' && !(J.parsed.checks || []).includes('plugin'), 'hev: a regular hybrid request became plug-in'); }

// CEO powertrain decisions (tools/ceo_fact_decisions.json): the cars now pass the matching powertrain filters
{ const F = require(path.join(__dirname, '..', 'tools/ceo_fact_decisions.json')).powertrain;
  for (const [id, f] of Object.entries(F)) { const m = by[id]; if (!m || !(m.u && E.currentTrims(m).length)) continue;
    const huge = { budget: 1e9, budgetMode: 'max' }, el = b => E.eligibility(m, E.normalizeBrief({ ...huge, ...b }, by), E.territory({ ...huge, ...b })).status;
    if (f.pt === 'petrol') { ok(el({ pt: 'petrol' }) === 'eligible', `fact ${id}: not eligible for petrol-only`); ok(el({ ptNo: ['ev'], pt: 'no_ev' }) === 'eligible', `fact ${id}: not eligible for "no electric"`); }
    if (f.pt === 'phev') { ok(el({ pt: 'petrol' }) === 'ineligible', `fact ${id}: plug-in shown as petrol-only`); ok(el({ ptNo: ['ev'], pt: 'no_ev' }) === 'eligible', `fact ${id}: plug-in excluded by "no electric"`); ok(el({ ptNo: ['hybrid'] }) === 'ineligible', `fact ${id}: plug-in passes "no hybrid"`); } }
  if (by['icaur/v27']) ok(!(by['icaur/v27'].powertrains || []).includes('ev'), 'fact icaur/v27: classified fully electric while the Egypt version is a range-extender (pending CEO)'); }

// 6/7/8. One primary car when the evidence supports it, honest ties otherwise; alternatives with reasons; no false claims
for (const t of ['Family SUV around 1.8M, fuel economy and space matter most, no Chinese brands', 'SUV around 2M', 'Cheapest 7 seater possible, budget 2M', 'BYD only, 2M']) {
  const J = journey(t), lvl = J.o.confidence && J.o.confidence.level;
  if (J.o.mode === 'single') ok(lvl === 'clear' || lvl === 'lean' || lvl === 'only', `${t}: single result without a lead`);
  if (lvl === 'tie') ok(J.o.mode !== 'single' || J.cars.length === 1, `${t}: a tie presented as one winner`);
  ok(J.cars.every(c => c.why.length > 0), `${t}: a car without reasons`);
  ok(J.o.alternatives.every(a => !a.card || a.card.why.length > 0), `${t}: alternative without a reason`);
  J.cars.forEach(c => { if (!by[c.id].reg) ok(!c.trade_offs.some(x => /registered in the last 12 months/.test(x.text)), `${t}: ${c.id} claims a registration count it has no data for`); });
}
{ const J = journey('Family SUV around 1.8M, fuel economy and space matter most, no Chinese brands');
  if (J.o.hero && J.o.hero.versions.some(v => v.pt === 'ev' || (by[J.o.hero.id].powertrains || []).includes('ev')))
    ok(J.o.hero.why.some(w => /run|electric|كهربا/i.test(w.text)), 'reasons: electric lead ranked on economy without saying why'); }
// no car without registration data anywhere in the universe gets a registration-count claim
{ let bad = 0; for (const m of ds.U.models.filter(m => m.u && !m.reg && E.currentTrims(m).length).slice(0, 40)) {
    const pr = E.currentTrims(m).map(t => t.min).sort((a, b) => a - b)[0];
    const b = T.normalize({ budget: pr, budgetMode: 'around', shortlist: [m.id] }, ds);
    const o = T.execute(b, ds, { locale: 'en', asOf: AS_OF }); const c = [o.hero, ...o.alternatives].filter(Boolean).find(x => x.id === m.id);
    if (c && c.trade_offs.some(x => /registered in the last 12 months/.test(x.text))) bad++; }
  ok(bad === 0, `no-reg: ${bad} cars claim a registration count without data`); }

// 9. Clarification only when necessary: a complete brief asks nothing it already has
{ const J = journey('عايز عربية عالية للعيلة في حدود 1.8 مليون، الأهم عندي البنزين والمساحة، ومش عايز صيني');
  ok(!J.asked.includes('budget') && !J.asked.includes('body') && !J.asked.includes('chinese') && !J.asked.includes('priorities'), `ask: re-asked known answers ${J.asked}`); }
{ const J = journey('BYD only'); ok(J.asked[0] === 'budget', 'ask: budget not asked when missing'); }
// transport guard: no budget is refused, not a crash
{ let msg = ''; try { T.execute(T.normalize(T.understand('BYD only', ds), ds), ds, {}); } catch (e) { msg = e.message; } ok(/no budget/.test(msg), 'guard: execute without a budget did not refuse cleanly'); }

// 10. Refinement: the result offers to edit/relax and the share token reproduces the brief
{ const J = journey('SUV around 2M, no Chinese brands');
  ok(J.o.share && J.o.share.r, 'refine: no share token'); const back = T.decodeShare(J.o.share.r, ds);
  ok(back && back.chinese === 'exclude' && back.budget === 2000000, 'refine: share token lost the brief');
  const R = journey('SUV around 2M, no Chinese brands', { edits: [{ chinese: 'open' }] }); ok(R.b.chinese === 'open' && R.r.eligible > J.r.eligible, 'refine: relaxing a constraint did not widen the set'); }

fail.forEach(f => console.log('FAIL ' + f));
console.log(`ceo failures: ${n - fails}/${n} checks pass (${ds.universe_version})`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
