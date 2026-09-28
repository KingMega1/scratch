// P1.2 Step 0 — regression + diagnostic harness. Run from buyer-decision/:
//   node tests/regression/run.js            check invariants, diff against snapshot, write REPORT.md
//   node tests/regression/run.js --update   accept current outputs as the new snapshot
//   node tests/regression/run.js --strict   also fail on any output change vs snapshot
// Invariants fail the run. Diagnostics never fail it: they count the known P1.2 problems (market evidence,
// powertrain technology, manufactured confidence, evidence gaps) so each P1.2 step can show them going down.
// Diagnostic thresholds are provisional P1 probes, not policy: P2 owns market-status / evidence definitions.
const fs = require('fs'), path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../../data/p11_client.js'), 'utf8'));
const P = require('../../app/brief.js'), E = require('../../app/engine.js');
const { CASES, PAIRS, DEFAULT_ANSWERS } = require('./cases.js');
const U = window.CI_UNIVERSE, M = U.models, byId = {}; M.forEach(m => { byId[m.id] = m; });
const SNAP = path.join(__dirname, 'snapshot.json'), REPORT = path.join(__dirname, 'REPORT.md');
const UPDATE = process.argv.includes('--update'), STRICT = process.argv.includes('--strict');
const nm = id => (byId[id] ? `${byId[id].brand} ${byId[id].model}` : id);

// ---------- consultation replay (mirrors app.js question order) ----------
function consult(c) {
  let b = c.text ? P.parse(c.text, M) : {};
  const asked = [];
  if (c.script) { for (const a of c.script) { b = { ...b, ...a }; asked.push(Object.keys(a).join('+')); } return { b, asked }; }
  const persona = c.persona || {};
  const step = q => { const a = persona[q] || DEFAULT_ANSWERS[q]; b = { ...b, ...a }; asked.push(q); };
  const nb0 = E.normalizeBrief(b, byId);
  const derived = nb0.budgetFrom && nb0.budgetFrom !== 'shortlist';
  if (!b.budget && !derived) { if (nb0.budget && !persona.budget) { b.budget = nb0.budget; asked.push('budget(prefilled)'); } else step('budget'); }
  let nb = E.normalizeBrief(b, byId);
  if (nb.aspiration.length && !nb.attraction) step('attraction');
  nb = E.normalizeBrief(b, byId);
  if (!(nb.body && nb.body.length) && !nb.bodyAny && nb.seats !== 7) step('body');
  nb = E.normalizeBrief(b, byId);
  const fam = (nb.who || []).some(w => ['kids', 'family', 'parents'].includes(w));
  const b7 = !(nb.body && nb.body.length) || nb.body.some(x => x === 'suv' || x === 'mpv');
  if (nb.seats == null && b7 && (!c.text || fam) && E.material(U, nb, [{ seats: null }, { seats: 7 }])) step('seats');
  for (let i = 0, f = 0; i < 6 && f < 4; i++) {
    nb = E.normalizeBrief(b, byId);
    const q = nb.offroad && nb.drive4 == null && !asked.includes('drive') ? 'drive' : E.nextQuestion(U, nb, asked);
    if (!q) break; step(q); f++;
  }
  return { b, asked };
}

const recs = r => (r.hero ? [r.hero, ...r.alts] : []);
const mode = r => (!r.hero ? 'no_match' : r.shortlist && r.shortlist.allOut ? 'conflict' : r.heroFromShortlist ? 'shortlist' : r.equal ? 'equal' : 'clear');

// ---------- invariants (must hold now) ----------
let fails = 0, checks = 0;
const failures = [];
const ok = (cond, msg) => { checks++; if (!cond) { fails++; failures.push(msg); } };
function invariants(id, b, r, r2) {
  const nb = E.normalizeBrief(b, byId), t = E.territory(nb);
  ok(JSON.stringify(summary(r)) === JSON.stringify(summary(r2)), `${id}: non-deterministic output`);
  const list = recs(r);
  ok(list.length <= 3 && new Set(list.map(x => x.id)).size === list.length, `${id}: more than 3 or duplicate recommendations`);
  for (const x of list.concat(r.less ? [{ id: r.less.id, less: true }] : [])) {
    const m = byId[x.id], tr = E.currentTrims(m);
    ok(m.u, `${id}: ${x.id} not in universe`);
    ok(E.eligibility(m, nb, t).status === 'eligible', `${id}: ${x.id} not eligible`);
    ok(tr.some(v => v.min <= t.ceil), `${id}: ${x.id} no version within ceiling`);
    if (nb.seats === 7) ok(m.seats && m.seats.some(s => s >= 7), `${id}: ${x.id} lacks confirmed 7 seats`);
    if (nb.chinese === 'exclude') ok(m.chinese === false, `${id}: ${x.id} is Chinese`);
    if (nb.drive4 === true) ok(m.awd === true, `${id}: ${x.id} no confirmed 4WD`);
    if (nb.body && nb.body.length) ok(nb.body.includes(m.body), `${id}: ${x.id} wrong body`);
    if ((nb.brandsOnly || []).length) ok(nb.brandsOnly.includes(m.brand_id), `${id}: ${x.id} brand outside only-list`);
    if ((nb.brandsExclude || []).length) ok(!nb.brandsExclude.includes(m.brand_id), `${id}: ${x.id} excluded brand`);
    ok(!(nb.aspiration || []).includes(x.id), `${id}: aspiration ${x.id} recommended`);
    if (!x.less) ok(x.fit.every(v => v.min <= t.ceil), `${id}: ${x.id} shows a version above ceiling`);
  }
}

// ---------- diagnostics (known P1.2 problems; counted, never failing) ----------
const W = { premium: 1.2, budget: 1, ref: 1.4, sizePref: 1.2, space: 1, easy: 0.8, pocket: 1, popular: 0.8, economy: 0.8, pt: 1.2, usage: 0.5, brand: 0.9, origin: 0.6, attr: 1 }; // copy of engine.js W
const BINARY = ['premium', 'brand', 'origin', 'attr'];
function curTrims(m) { return E.currentTrims(m); }
function diagnostics(b, r) {
  const nb = E.normalizeBrief(b, byId), out = [];
  const list = recs(r);
  for (const x of list) {
    const m = byId[x.id], g = m.reg || {}, tr = curTrims(m);
    const sources = new Set(tr.flatMap(t => t.sources || []));
    const official = tr.some(t => t.official);
    // market evidence (provisional probe; P2 will own status + thresholds)
    if ((g.last12 || 0) < 10) out.push({ k: 'market_low_registrations', id: x.id, v: g.last12 || 0 });
    if (!official && sources.size <= 1) out.push({ k: 'market_single_unofficial_price', id: x.id, v: [...sources].join('/') || 'none' });
    if (tr.length && tr.every(t => /unspecified/i.test(t.label || ''))) out.push({ k: 'market_unspecified_trim_only', id: x.id });
    // powertrain technology: 'hybrid' is not resolved into HEV / PHEV / REEV
    const fitPts = x.fit.map(t => t.pt || ((m.powertrains || []).length === 1 ? m.powertrains[0] : null));
    if ((nb.pt || (nb.ptNo || []).length) && x.fit.some((t, i) => fitPts[i] === 'hybrid' && !t.plugin)) out.push({ k: 'pt_hybrid_technology_unresolved', id: x.id });
    // rows the comparison table shows as '—' (seats, horsepower, official warranty)
    const gaps = [];
    if (!(m.seats && m.seats.length)) gaps.push('seats');
    if (!(m.hp && m.hp.length)) gaps.push('hp');
    if (!(m.warranty_years && m.warranty_verified)) gaps.push('warranty');
    if (gaps.length) out.push({ k: 'evidence_gap', id: x.id, v: gaps.join('+') });
  }
  // confidence: a "clear" winner whose lead over the next car comes from one binary factor
  if (mode(r) === 'clear' && r.alts[0] && r.alts[0].parts) {
    const h = r.hero.parts, a = r.alts[0].parts, keys = Object.keys(h), sw = keys.reduce((s, k) => s + W[k], 0);
    const margin = r.hero.score - r.alts[0].score;
    const contrib = keys.map(k => [k, (W[k] * ((h[k] || 0) - (a[k] || 0))) / sw]).sort((p, q) => q[1] - p[1]);
    const [k0, c0] = contrib[0];
    if (BINARY.includes(k0) && margin - c0 < 0.02) out.push({ k: 'confidence_single_binary_factor', id: r.hero.id, v: `${k0} ${c0.toFixed(3)} of ${margin.toFixed(3)} lead` });
  }
  // how much of the result rests on the binary registration-segment "premium" flag: rerun without that priority
  if ((nb.priorities || []).includes('premium') && list.length) {
    const alt = E.recommend(U, { ...b, priorities: nb.priorities.filter(p => p !== 'premium') });
    const kept = recs(alt).filter(x => list.some(y => y.id === x.id)).length;
    out.push({ k: 'premium_flag_swing', v: `${list.length - kept}/${list.length} cars change without it` });
  }
  // buyer concerns the engine records but cannot score (no evidence yet)
  for (const ch of nb.checks || []) out.push({ k: 'unscored_buyer_check', v: ch });
  return out;
}

function summary(r) {
  return { mode: mode(r), hero: r.hero ? r.hero.id : null, alts: r.alts ? r.alts.map(a => a.id) : [], less: r.less ? r.less.id : null,
    tier: r.tier || 0, eligible: r.eligible || 0, factors: r.factors || [] };
}
const briefKey = b => { const n = E.normalizeBrief(b, byId); return JSON.stringify({ budget: n.budget, mode: n.budgetMode, body: n.body, seats: n.seats, chinese: n.chinese, pt: n.pt, ptNo: n.ptNo, drive4: n.drive4, sizePref: n.sizePref, usage: n.usage, priorities: n.priorities, shortlist: n.shortlist, aspiration: n.aspiration }); };

// ---------- run ----------
const snap = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : {};
const understanding = [], rows = [], newSnap = {}, changes = [], diagCount = {}, byCase = {};
for (const c of CASES) {
  const { b, asked } = consult(c);
  if (c.expect) {
    const parsed = P.parse(c.text, M), miss = Object.entries(c.expect).filter(([k, v]) => JSON.stringify(parsed[k]) !== JSON.stringify(v));
    if (miss.length) understanding.push({ id: c.id, known: c.known || null, msg: miss.map(([k, v]) => `${k}: expected ${JSON.stringify(v)}, parsed ${JSON.stringify(parsed[k])}`).join('; ') });
  }
  const r = E.recommend(U, b), r2 = E.recommend(U, JSON.parse(JSON.stringify(b)));
  invariants(c.id, b, r, r2);
  const s = summary(r), d = diagnostics(b, r);
  newSnap[c.id] = s; byCase[c.id] = { b, s };
  if (c.observed) ok(true, ''); // recorded for traceability; live data may have moved since
  if (snap[c.id] && JSON.stringify(snap[c.id]) !== JSON.stringify(s)) changes.push({ id: c.id, before: snap[c.id], after: s });
  d.forEach(x => { diagCount[x.k] = (diagCount[x.k] || 0) + 1; });
  rows.push({ c, asked, s, d, r });
}
// EN/AR parity: same need should give the same confirmed brief; when it does, the result must match
const parity = [];
for (const [a, z] of PAIRS) {
  const A = byCase[a], Z = byCase[z];
  if (briefKey(A.b) === briefKey(Z.b)) ok(JSON.stringify(A.s) === JSON.stringify(Z.s), `${a}/${z}: same brief, different result`);
  else parity.push(`${a}/${z}: briefs differ — ${a} ${briefKey(A.b)} | ${z} ${briefKey(Z.b)}`);
}
if (parity.length) diagCount.parse_parity_brief_differs = parity.length;

// ---------- report ----------
const L = [];
L.push(`# Regression / diagnostic report`, '', `Engine ${E.ENGINE_VERSION} · data ${U.meta.version} · ${CASES.length} cases · invariants ${checks - fails}/${checks} pass · understanding failures ${understanding.length} (known ${understanding.filter(u => u.known).length})`, '');
L.push('Diagnostics are known P1.2 problems, counted per recommended car (thresholds provisional; P2 owns market-status definitions).', '');
L.push('| Diagnostic | Count |', '|---|---|');
Object.entries(diagCount).sort().forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
L.push('', '## Cases', '', '| Case | Group | Brief | Asked | Result (mode) | Diagnostics |', '|---|---|---|---|---|---|');
for (const { c, asked, s, d } of rows) {
  const res = s.hero ? [s.hero, ...s.alts].map(nm).join(' · ') + (s.less ? ` · less: ${nm(s.less)}` : '') : 'no match';
  const dd = d.map(x => `${x.k}${x.id ? ' ' + nm(x.id) : ''}${x.v != null ? ' (' + x.v + ')' : ''}`).join('; ');
  L.push(`| ${c.id} | ${c.group} | ${(c.text || '(guided)').replace(/\|/g, '/')} | ${asked.join(', ') || '—'} | ${res} (${s.mode}${s.mode === 'equal' ? ', ' + s.tier + ' tied' : ''}) | ${dd} |`);
}
if (understanding.length) { L.push('', '## Understanding failures', ''); understanding.forEach(u => L.push(`- ${u.id}: ${u.msg}${u.known ? ' — KNOWN ' + u.known : ''}`)); }
if (parity.length) { L.push('', '## EN/AR brief parity', ''); parity.forEach(p => L.push('- ' + p)); }
if (changes.length) { L.push('', '## Changes vs snapshot', ''); changes.forEach(x => L.push(`- ${x.id}: ${JSON.stringify(x.before)} → ${JSON.stringify(x.after)}`)); }
if (failures.length) { L.push('', '## Invariant failures', ''); failures.forEach(f => L.push('- ' + f)); }
fs.writeFileSync(REPORT, L.join('\n') + '\n');
if (UPDATE || !fs.existsSync(SNAP)) fs.writeFileSync(SNAP, JSON.stringify(newSnap, null, 1) + '\n');

console.log(`cases ${CASES.length} · invariants ${checks - fails}/${checks} pass · changes vs snapshot ${changes.length}`);
Object.entries(diagCount).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
failures.forEach(f => console.log('FAIL ' + f));
understanding.forEach(u => console.log(`${u.known ? 'KNOWN' : 'FAIL'} understanding ${u.id}: ${u.msg}`));
const newUnderstanding = understanding.filter(u => !u.known).length;
changes.forEach(x => console.log(`CHANGED ${x.id}: ${x.before.hero} → ${x.after.hero}`));
process.exit(fails || newUnderstanding || (STRICT && changes.length) ? 1 : 0);
