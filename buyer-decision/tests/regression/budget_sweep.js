// P1.2 budget-curve sensitivity sweep. Run from buyer-decision/: node tests/regression/budget_sweep.js
// Compares price-fit curves over budgets 0.8M–6M, fixed buyer profiles and the three budget intentions
// (target/around, maximum, maximum + explicit stretch). Variants are test-only: engine.js is loaded with its
// curve replaced; the app and the engine are untouched. Nothing here picks or targets any car.
// Writes tests/regression/BUDGET_SWEEP.md.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../../data/p11_client.js'), 'utf8'));
const U = window.CI_UNIVERSE, byId = {}; U.models.forEach(m => { byId[m.id] = m; });
const SRC = fs.readFileSync(path.join(__dirname, '../../app/engine.js'), 'utf8');
const TIE = 0.02;

// current curve, verbatim from engine.js (a change there fails this sweep loudly)
const CUR_FIT = `  function priceFit(p, terr) {
    const B = terr.budget, lo = terr.mode === 'max' ? 0.7 * B : 0.9 * B;
    if (p > terr.ceil) return -1;
    if (p > B) return 1 - (p - B) / B * 2;          // +10% stretch -> 0.8
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);     // 80% of budget -> 0.95, 70% -> 0.90
  }`;
const CUR_CEIL = "const ceil = mode === 'max' ? (b.stretch ? B * 1.1 : B) : B * 1.1;";
const API = 'const api = {';
const CUR_PICK = 'const pick = fit.slice().sort((x, y) => priceFit(y.min, terr) - priceFit(x.min, terr) || y.min - x.min)[0];';
const CUR_MAIN = 'let main = scored.filter(s => s.F.price >= terr.floor), value = scored.filter(s => s.F.price < terr.floor);';
// earned-stretch rule (CEO 2026-09-28): a version above the stated budget is shown only when no in-budget version
// exists for that model AND its buyer-priority fit beats the best in-budget car by more than TIE.
const EARN_PICK = 'const inB = fit.filter(t => t.min <= terr.budget); const pick = (inB.length ? inB : fit).slice().sort((x, y) => priceFit(y.min, terr) - priceFit(x.min, terr) || y.min - x.min)[0];';
const EARN_MAIN = CUR_MAIN + ` {
      const pf = x => { const k = Object.keys(x.parts).filter(q => q !== 'budget'); if (!k.length) return null; const w = k.reduce((a, q) => a + W[q], 0); return k.reduce((a, q) => a + W[q] * x.parts[q], 0) / w; };
      const inb = scored.filter(x => x.F.price <= terr.budget).map(pf).filter(v => v != null), best = inb.length ? Math.max(...inb) : null;
      // nothing at all within budget: the nearest cars above it stay, shown as the only way to meet the brief
      const anyIn = scored.some(x => x.F.price <= terr.budget);
      const earned = x => x.F.price <= terr.budget || !anyIn || (pf(x) != null && (best == null || pf(x) - best > TIE));
      main = main.filter(earned); value = value.filter(earned);
    }`;
for (const s of [CUR_FIT, CUR_CEIL, API, CUR_PICK, CUR_MAIN]) if (!SRC.includes(s)) throw new Error('engine.js changed; update the sweep: ' + s.slice(0, 40));

// A stated maximum stays a hard ceiling in every variant unless stretch is allowed.
const VARIANTS = {
  'current (around 90–100, max 70–100)': {},
  '90–100 (both)': { fit: `  function priceFit(p, terr) {
    const B = terr.budget, lo = 0.9 * B;
    if (p > terr.ceil) return -1;
    if (p > B) return 1 - (p - B) / B * 2;
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);
  }` },
  '85–110 (flat to 110)': { fit: `  function priceFit(p, terr) {
    const B = terr.budget, lo = 0.85 * B;
    if (p > terr.ceil) return -1;
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);
  }` },
  '85–115 (flat to 110, steep 110–115)': { fit: `  function priceFit(p, terr) {
    const B = terr.budget, lo = 0.85 * B;
    if (p > terr.ceil) return -1;
    if (p > 1.1 * B) return 1 - (p - 1.1 * B) / B * 6;   // 115% -> 0.70
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);
  }`, ceil: "const ceil = mode === 'max' ? (b.stretch ? B * 1.15 : B) : B * 1.15;" },
  '90–100 + earned-stretch rule': { fit: `  function priceFit(p, terr) {
    const B = terr.budget, lo = 0.9 * B;
    if (p > terr.ceil) return -1;
    if (p > B) return 1 - (p - B) / B * 2;
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);
  }`, earn: true },
};
function engine(v) {
  let src = SRC.replace(API, 'const api = { _x: { features, rankFit, territory, normalizeBrief, eligibility }, ');
  if (v.fit) src = src.replace(CUR_FIT, v.fit);
  if (v.ceil) src = src.replace(CUR_CEIL, v.ceil);
  if (v.earn) src = src.replace(CUR_PICK, EARN_PICK).replace(CUR_MAIN, EARN_MAIN);
  const m = { exports: {} };
  vm.runInNewContext(src, { module: m, globalThis: {}, Math, Set, Object, JSON, Array, Number, String, Infinity });
  return m.exports;
}

const PROFILES = {
  'SUV, no priorities': { body: ['suv'], chinese: 'open', pt: 'open' },
  'SUV, space': { body: ['suv'], chinese: 'open', pt: 'open', priorities: ['space'] },
  'SUV, premium': { body: ['suv'], chinese: 'open', pt: 'open', priorities: ['premium'] },
  'SUV, economy': { body: ['suv'], chinese: 'open', pt: 'open', priorities: ['economy'] },
  'SUV, hybrid wanted': { body: ['suv'], chinese: 'open', pt: 'hybrid' },
  'SUV, no Chinese': { body: ['suv'], chinese: 'exclude', pt: 'open' },
  'Sedan, no priorities': { body: ['sedan'], chinese: 'open', pt: 'open' },
  '7 seats': { seats: 7, chinese: 'open', pt: 'open' },
};
const MODES = { target: { budgetMode: 'around' }, max: { budgetMode: 'max' }, 'max+stretch': { budgetMode: 'max', stretch: true } };
const BUDGETS = []; for (let x = 800000; x <= 6000000; x += 100000) BUDGETS.push(x);
const W = { premium: 1.2, budget: 1, ref: 1.4, sizePref: 1.2, space: 1, easy: 0.8, pocket: 1, popular: 0.8, economy: 0.8, pt: 1.2, usage: 0.5, brand: 0.9, origin: 0.6, attr: 1 }; // engine.js W
const prFit = parts => { const k = Object.keys(parts).filter(x => x !== 'budget'); if (!k.length) return null; const w = k.reduce((a, x) => a + W[x], 0); return k.reduce((a, x) => a + W[x] * parts[x], 0) / w; };

function run(E) {
  const X = E._x, out = {};
  for (const [pn, p] of Object.entries(PROFILES)) for (const [mn, md] of Object.entries(MODES)) {
    const key = `${pn} | ${mn}`, list = [];
    for (const B of BUDGETS) {
      const brief = { ...p, ...md, budget: B }, r = E.recommend(U, brief);
      const shown = r.hero ? [r.hero, ...r.alts] : [];
      // best buyer-priority fit available at or under the target (for "did the extra spend earn it?")
      let bestIn = null;
      if (shown.some(x => x.price > B)) {
        const nb = X.normalizeBrief(brief, byId), terr = X.territory(nb);
        const Fs = U.models.filter(m => m.u && X.eligibility(m, nb, terr).status === 'eligible').map(m => X.features(m, nb, terr));
        const rows = X.rankFit(Fs, nb, { terr, ref: null, byId }).rows.filter(x => x.F.entry <= B);
        const f = rows.map(x => prFit(x.parts)).filter(v => v != null);
        bestIn = f.length ? Math.max(...f) : null;
      }
      list.push({
        B, key, level: r.confidence ? r.confidence.level : null, lead: r.ranked && r.ranked[0],
        winner: r.confidence && r.confidence.level !== 'tie' ? r.ranked[0] : r.hero ? 'TIE' : null,
        top: shown.map(x => x.id).sort().join(), less: !!r.less,
        cars: shown.map(x => ({ id: x.id, ratio: x.price / B, fit: prFit(x.parts), earned: x.price > B ? (prFit(x.parts) == null || bestIn == null ? 'no_priority' : prFit(x.parts) - bestIn > TIE ? 'earned' : 'not_earned') : null, gain: x.price > B && prFit(x.parts) != null && bestIn != null ? prFit(x.parts) - bestIn : null })),
      });
    }
    out[key] = list;
  }
  return out;
}

const pct = (a, n) => (n ? `${Math.round((100 * a) / n)}%` : '—');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function measure(res, base) {
  const rows = Object.values(res).flat(), cars = rows.flatMap(x => x.cars), n = cars.length;
  const above = cars.filter(c => c.ratio > 1), stretch = above.map(c => c.ratio - 1);
  let win = 0, top = 0, cmp = 0;
  if (base) for (const k of Object.keys(res)) res[k].forEach((x, i) => { const y = base[k][i]; cmp++; if (x.winner !== y.winner) win++; if (x.top !== y.top) top++; });
  return {
    results: rows.filter(x => x.cars.length).length, none: rows.filter(x => !x.cars.length).length,
    under80: pct(cars.filter(c => c.ratio < 0.8).length, n), under70: pct(cars.filter(c => c.ratio < 0.7).length, n),
    above: pct(above.length, n), stretchMed: stretch.length ? `+${Math.round(100 * med(stretch))}%` : '—', stretchMax: stretch.length ? `+${Math.round(100 * Math.max(...stretch))}%` : '—',
    earned: pct(above.filter(c => c.earned === 'earned').length, above.length) + (above.some(c => c.earned === 'earned') ? ` (fit +${med(above.filter(c => c.earned === 'earned').map(c => c.gain)).toFixed(2)})` : ''), notEarned: pct(above.filter(c => c.earned === 'not_earned').length, above.length),
    noPrio: pct(above.filter(c => c.earned === 'no_priority').length, above.length),
    win: base ? pct(win, cmp) : '—', top: base ? pct(top, cmp) : '—', less: pct(rows.filter(x => x.less).length, rows.filter(x => x.cars.length).length),
    tie: pct(rows.filter(x => x.level === 'tie').length, rows.filter(x => x.cars.length).length),
  };
}
const byMode = (res, mode) => Object.fromEntries(Object.entries(res).filter(([k]) => k.endsWith('| ' + mode)));

const results = {}, names = Object.keys(VARIANTS);
for (const vn of names) results[vn] = run(engine(VARIANTS[vn]));
const base = results[names[0]];
const nm = id => `${byId[id].brand} ${byId[id].model}`;
const L = ['# Budget-curve sensitivity sweep', '',
  `Budgets EGP ${BUDGETS[0] / 1e6}M–${BUDGETS[BUDGETS.length - 1] / 1e6}M in 0.1M steps (${BUDGETS.length}) × ${Object.keys(PROFILES).length} profiles × 3 budget intentions, data ${U.meta.version}. Follow-up questions are not simulated (real journeys add priorities and tie less).`, '',
  'Earned shows the median buyer-priority fit gain in brackets (scale 0–1). Ratios = shown car price ÷ stated budget, over all shown cars (main + alternatives). "Earned" = an above-budget car whose buyer-priority fit beats the best car at or under budget by more than the tie margin (0.02); "no priority" = the brief has no priority that could justify extra spend. Winner = the main-ranking leader when not a tie ("TIE" otherwise).', ''];
for (const mode of Object.keys(MODES)) {
  L.push(`## ${mode}`, '', '| Variant | Results | Cars <80% | Cars <70% | Cars >100% | Stretch median / max | Above-budget earned / not earned / no priority | Winner changes vs current | Top-3 changes | Spend-less card | Tie |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const vn of names) {
    const s = measure(byMode(results[vn], mode), vn === names[0] ? null : byMode(base, mode));
    L.push(`| ${vn} | ${s.results}${s.none ? ` (+${s.none} none)` : ''} | ${s.under80} | ${s.under70} | ${s.above} | ${s.stretchMed} / ${s.stretchMax} | ${s.earned} / ${s.notEarned} / ${s.noPrio} | ${s.win} | ${s.top} | ${s.less} | ${s.tie} |`);
  }
  L.push('');
}
// pathological examples per variant: (a) extra spend not earned, (b) main car under 70% of budget, (c) lost a result
L.push('## Pathological examples (up to 4 per kind per variant)', '');
for (const vn of names) {
  const rows = Object.values(results[vn]).flat(), ex = { 'extra spend not earned': [], 'main car under 70% of budget': [], 'result lost vs current': [] };
  for (const x of rows) {
    for (const c of x.cars) {
      if (c.earned === 'not_earned' || c.earned === 'no_priority') ex['extra spend not earned'].push(`${x.key} @ ${x.B / 1e6}M: ${nm(c.id)} at ${Math.round(100 * c.ratio)}% (${c.earned === 'no_priority' ? 'no priority to justify it' : 'priority fit ' + (c.gain >= 0 ? '+' : '') + c.gain.toFixed(3) + ' vs best in budget'})`);
      if (c.ratio < 0.7) ex['main car under 70% of budget'].push(`${x.key} @ ${x.B / 1e6}M: ${nm(c.id)} at ${Math.round(100 * c.ratio)}%`);
    }
  }
  if (vn !== names[0]) for (const k of Object.keys(results[vn])) results[vn][k].forEach((x, i) => { if (!x.cars.length && base[k][i].cars.length) ex['result lost vs current'].push(`${k} @ ${x.B / 1e6}M`); });
  L.push(`### ${vn}`, '');
  for (const [k, list] of Object.entries(ex)) {
    if (!list.length) { L.push(`- ${k}: none`); continue; }
    // spread the examples across the list rather than taking the first few budgets
    const pick = [0, 1, 2, 3].map(i => list[Math.floor((i * list.length) / 4)]).filter((v, i, a) => v && a.indexOf(v) === i);
    L.push(`- ${k}: ${list.length} — e.g. ${pick.join('; ')}`);
  }
  L.push('');
}
fs.writeFileSync(path.join(__dirname, 'BUDGET_SWEEP.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
