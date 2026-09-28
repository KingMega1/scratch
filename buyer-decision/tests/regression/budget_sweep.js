// P1.2 budget-curve sensitivity sweep. Run from buyer-decision/: node tests/regression/budget_sweep.js
// Sweeps budgets 0.8M–6M for fixed buyer profiles and budget modes, under the current price-fit curve and under
// test-only variants of it (the engine source is loaded with the curve constants replaced; app code is untouched).
// Writes tests/regression/BUDGET_SWEEP.md. Nothing here picks cars; it measures how the curve behaves.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../../data/p11_client.js'), 'utf8'));
const U = window.CI_UNIVERSE;
const SRC = fs.readFileSync(path.join(__dirname, '../../app/engine.js'), 'utf8');

// the current curve, exactly as in engine.js (asserted below so a change there breaks this sweep loudly)
const CUR = {
  lo: "const B = terr.budget, lo = terr.mode === 'max' ? 0.7 * B : 0.9 * B;",
  below: 'return Math.max(0, 1 - (lo - p) / B * 0.5);',
  above: 'if (p > B) return 1 - (p - B) / B * 2;',
  floor: 'const floor = b.budgetMin ? b.budgetMin * 0.95 : B * 0.7;',
};
for (const [k, v] of Object.entries(CUR)) if (!SRC.includes(v)) throw new Error(`engine.js curve changed (${k}); update the sweep`);
const VARIANTS = {
  current: {},
  'below slope ×2 (1.0)': { below: 'return Math.max(0, 1 - (lo - p) / B * 1.0);' },
  'below slope ÷2 (0.25)': { below: 'return Math.max(0, 1 - (lo - p) / B * 0.25);' },
  'around: flat from 80%': { lo: "const B = terr.budget, lo = terr.mode === 'max' ? 0.7 * B : 0.8 * B;" },
  'max: flat from 80%': { lo: "const B = terr.budget, lo = terr.mode === 'max' ? 0.8 * B : 0.9 * B;" },
  'max: flat from 90%': { lo: "const B = terr.budget, lo = terr.mode === 'max' ? 0.9 * B : 0.9 * B;" },
  'stretch penalty ÷2 (1)': { above: 'if (p > B) return 1 - (p - B) / B * 1;' },
  'spend-less floor 60%': { floor: 'const floor = b.budgetMin ? b.budgetMin * 0.95 : B * 0.6;' },
  'spend-less floor 80%': { floor: 'const floor = b.budgetMin ? b.budgetMin * 0.95 : B * 0.8;' },
};
function engine(v) {
  let src = SRC;
  for (const [k, rep] of Object.entries(v)) src = src.replace(CUR[k], rep);
  const m = { exports: {} };
  vm.runInNewContext(src, { module: m, globalThis: {}, Math, Set, Object, JSON, Array, Number, String, Infinity });
  return m.exports;
}

const PROFILES = {
  'SUV, open': { body: ['suv'], chinese: 'open', pt: 'open' },
  'SUV, space': { body: ['suv'], chinese: 'open', pt: 'open', priorities: ['space'] },
  'SUV, premium': { body: ['suv'], chinese: 'open', pt: 'open', priorities: ['premium'] },
  'SUV, hybrid': { body: ['suv'], chinese: 'open', pt: 'hybrid' },
  'SUV, no Chinese': { body: ['suv'], chinese: 'exclude', pt: 'open' },
  'Sedan, open': { body: ['sedan'], chinese: 'open', pt: 'open' },
  '7 seats': { seats: 7, chinese: 'open', pt: 'open' },
};
const MODES = { around: { budgetMode: 'around' }, max: { budgetMode: 'max' }, 'max+stretch': { budgetMode: 'max', stretch: true } };
const BUDGETS = []; for (let x = 800000; x <= 6000000; x += 100000) BUDGETS.push(x);

const pct = (a, n) => (n ? Math.round((100 * a) / n) : 0);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function run(E) {
  const res = {};
  for (const [pn, p] of Object.entries(PROFILES)) for (const [mn, m] of Object.entries(MODES)) {
    const key = `${pn} | ${mn}`, list = [];
    for (const B of BUDGETS) {
      const r = E.recommend(U, { ...p, ...m, budget: B });
      list.push({ B, hero: r.hero ? r.hero.id : null, top: r.hero ? [r.hero.id, ...r.alts.map(a => a.id)] : [], ratio: r.hero ? r.hero.price / B : null,
        level: r.confidence ? r.confidence.level : null, equal: !!r.equal, less: r.less ? r.less.saves / B : null, widened: !!r.widened,
        ratios: r.hero ? [r.hero, ...r.alts].map(x => x.price / B) : [] });
    }
    res[key] = list;
  }
  return res;
}
function stats(list) {
  const ok = list.filter(x => x.hero), n = ok.length, ratios = ok.map(x => x.ratio), all = ok.flatMap(x => x.ratios);
  let churn = 0; for (let i = 1; i < list.length; i++) if (list[i].hero !== list[i - 1].hero) churn++;
  return {
    n, noMatch: list.length - n, med: med(ratios), min: n ? Math.min(...ratios) : null,
    under80: pct(all.filter(r => r < 0.8).length, all.length), under70: pct(all.filter(r => r < 0.7).length, all.length),
    over: pct(all.filter(r => r > 1).length, all.length),
    churn: pct(churn, list.length - 1), tie: pct(ok.filter(x => x.level === 'tie').length, n), clear: pct(ok.filter(x => x.level === 'clear').length, n),
    lean: pct(ok.filter(x => x.level === 'lean').length, n), less: pct(ok.filter(x => x.less != null).length, n), widened: pct(ok.filter(x => x.widened).length, n),
  };
}

const base = run(engine({}));
const L = ['# Budget-curve sensitivity sweep', '',
  `Budgets EGP ${BUDGETS[0] / 1e6}M–${BUDGETS[BUDGETS.length - 1] / 1e6}M in 0.1M steps (${BUDGETS.length}) × ${Object.keys(PROFILES).length} profiles × ${Object.keys(MODES).length} budget modes. Data ${U.meta.version}.`, '',
  'Price ratios are version price ÷ stated budget for all shown cars (main pick + alternatives). Churn = share of 0.1M steps where the main pick changes.', '',
  '## Current curve', '', '| Profile | Mode | Results | Median pick ratio | Cars <80% | Cars <70% | Cars >100% | Pick churn | Tie / lean / clear | Spend-less card | Widened |', '|---|---|---|---|---|---|---|---|---|---|---|'];
for (const [k, list] of Object.entries(base)) {
  const s = stats(list), [pn, mn] = k.split(' | ');
  L.push(`| ${pn} | ${mn} | ${s.n}${s.noMatch ? ` (+${s.noMatch} none)` : ''} | ${s.med != null ? s.med.toFixed(2) : '—'} | ${s.under80}% | ${s.under70}% | ${s.over}% | ${s.churn}% | ${s.tie}/${s.lean}/${s.clear}% | ${s.less}% | ${s.widened}% |`);
}
L.push('', '## Variants vs current', '', '| Variant | Main pick changes | Top-3 set changes | Cars <80% (cur → var) | Cars >100% (cur → var) | Pick churn (cur → var) | Spend-less card (cur → var) |', '|---|---|---|---|---|---|---|');
const agg = res => { const s = Object.values(res).map(stats), avg = k => Math.round(s.reduce((a, x) => a + x[k], 0) / s.length); return { u80: avg('under80'), over: avg('over'), churn: avg('churn'), less: avg('less') }; };
const A0 = agg(base);
for (const [vn, v] of Object.entries(VARIANTS)) {
  if (vn === 'current') continue;
  const res = run(engine(v)), A = agg(res);
  let heroCh = 0, topCh = 0, n = 0;
  for (const k of Object.keys(base)) base[k].forEach((x, i) => { const y = res[k][i]; n++; if (x.hero !== y.hero) heroCh++; if (x.top.slice().sort().join() !== y.top.slice().sort().join()) topCh++; });
  L.push(`| ${vn} | ${pct(heroCh, n)}% | ${pct(topCh, n)}% | ${A0.u80}% → ${A.u80}% | ${A0.over}% → ${A.over}% | ${A0.churn}% → ${A.churn}% | ${A0.less}% → ${A.less}% |`);
}
fs.writeFileSync(path.join(__dirname, 'BUDGET_SWEEP.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
