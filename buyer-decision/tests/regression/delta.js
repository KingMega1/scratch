// Delta report: compare the regression cases between the committed engine (git HEAD) and the working copy, and
// attribute every changed car to a rule. Run from buyer-decision/: node tests/regression/delta.js [git-ref]
// Writes tests/regression/DELTA.md. A change that no approved rule explains is listed as UNEXPLAINED.
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../../data/p11_client.js'), 'utf8'));
const U = window.CI_UNIVERSE, M = U.models, byId = {}; M.forEach(m => { byId[m.id] = m; });
const P = require('../../app/brief.js');
const NEW = require('../../app/engine.js');
const ref = process.argv[2] || 'HEAD';
const oldSrc = execSync(`git show ${ref}:buyer-decision/app/engine.js`, { cwd: path.join(__dirname, '../../..') }).toString();
const mod = { exports: {} };
vm.runInNewContext(oldSrc, { module: mod, globalThis: {}, Math, Set, Object, JSON, Array, Number, String, Infinity });
const OLD = mod.exports;
const { CASES, DEFAULT_ANSWERS } = require('./cases.js');
const nm = id => `${byId[id].brand} ${byId[id].model}`;

// same consultation replay as run.js, driven by a given engine (question flow can differ between engines)
function consult(E, c) {
  let b = c.text ? P.parse(c.text, M) : {};
  if (c.script) { for (const a of c.script) b = { ...b, ...a }; return b; }
  const persona = c.persona || {}, asked = [];
  const step = q => { b = { ...b, ...(persona[q] || DEFAULT_ANSWERS[q]) }; asked.push(q); };
  const nb0 = E.normalizeBrief(b, byId);
  if (!b.budget && !(nb0.budgetFrom && nb0.budgetFrom !== 'shortlist')) { if (nb0.budget && !persona.budget) b.budget = nb0.budget; else step('budget'); }
  let nb = E.normalizeBrief(b, byId);
  if (nb.aspiration.length && !nb.attraction) step('attraction');
  nb = E.normalizeBrief(b, byId);
  if (!(nb.body && nb.body.length) && !nb.bodyAny && nb.seats !== 7) step('body');
  nb = E.normalizeBrief(b, byId);
  const fam = (nb.who || []).some(w => ['kids', 'family', 'parents'].includes(w)), b7 = !(nb.body && nb.body.length) || nb.body.some(x => x === 'suv' || x === 'mpv');
  if (nb.seats == null && b7 && (!c.text || fam) && E.material(U, nb, [{ seats: null }, { seats: 7 }])) step('seats');
  for (let i = 0, f = 0; i < 6 && f < 4; i++) { nb = E.normalizeBrief(b, byId); const q = nb.offroad && nb.drive4 == null && !asked.includes('drive') ? 'drive' : E.nextQuestion(U, nb, asked); if (!q) break; step(q); f++; }
  return b;
}
const shown = r => (r.hero ? [r.hero, ...r.alts] : []);
const mode = r => (!r.hero ? (r.nearestAbove ? 'nearest_only' : 'no_match') : r.shortlist && r.shortlist.allOut ? 'conflict' : r.heroFromShortlist ? 'shortlist' : r.equal ? 'equal' : 'single');

const L = ['# Delta report', '', `Old engine: ${ref} · new engine: working copy · ${CASES.length} regression cases.`, ''];
let unexplained = 0, changed = 0;
for (const c of CASES) {
  const bo = consult(OLD, c), bn = consult(NEW, c);
  const ro = OLD.recommend(U, bo), rn = NEW.recommend(U, bn), B = NEW.territory(NEW.normalizeBrief(bn, byId)).budget;
  const so = shown(ro), sn = shown(rn), ido = so.map(x => x.id), idn = sn.map(x => x.id);
  const sameSet = ido.slice().sort().join() === idn.slice().sort().join();
  const sameBrief = JSON.stringify(NEW.normalizeBrief(bo, byId)) === JSON.stringify(NEW.normalizeBrief(bn, byId));
  if (sameSet && mode(ro) === mode(rn) && JSON.stringify(ido) === JSON.stringify(idn)) continue;
  changed++;
  const lines = [], why = new Set();
  if (!sameBrief) { lines.push('  - follow-up questions differ (question choice depends on the ranking)'); why.add('questions'); }
  const nbN = NEW.normalizeBrief(bn, byId), hasPrio = Object.keys((rn.hero || so[0] || {}).parts || {}).some(k => k !== 'budget');
  for (const x of so.filter(x => !idn.includes(x.id))) {
    const ratio = x.price / B;
    let r;
    if (x.price > B) { r = hasPrio ? 'stretch not earned (no better fit than the best car within budget)' : 'stretch not earned (brief has no priority that could justify it)'; why.add('stretch'); }
    else if (ro.equal && rn.equal) { r = `tie set re-sampled (tie of ${ro.tier} → ${rn.tier}; shown cars span the tied set)`; why.add('tie'); }
    else if (ratio < 0.9 && nbN.budgetMode === 'max') { r = `below the new 90% band (was ${Math.round(100 * ratio)}% of a maximum budget)`; why.add('band'); }
    else if (ratio < 0.9) { r = `below 90% of budget (${Math.round(100 * ratio)}%), displaced by a better-fitting car`; why.add('band'); }
    else { r = 'displaced'; why.add('displaced'); }
    lines.push(`  - out: ${nm(x.id)} at ${Math.round(100 * ratio)}% of budget — ${r}`);
  }
  for (const x of sn.filter(x => !ido.includes(x.id))) lines.push(`  - in: ${nm(x.id)} at ${Math.round((100 * x.price) / B)}% of budget${x.stretch ? ` — earned stretch (+${x.stretch.gain} fit on ${x.stretch.buys.join('+')})` : ''}`);
  if (sameSet && JSON.stringify(ido) !== JSON.stringify(idn)) { lines.push('  - same cars, different order'); why.add('order'); }
  if (mode(ro) !== mode(rn)) { lines.push(`  - presentation: ${mode(ro)} → ${mode(rn)}${rn.nearestAbove ? ` (nearest: ${rn.nearestAbove.map(x => `${nm(x.id)} +${Math.round((100 * x.over) / B)}%`).join(', ')})` : ''}`); why.add('mode'); }
  for (const x of sn) if (x.price > B && !x.stretch) { lines.push(`  - UNEXPLAINED: ${nm(x.id)} above budget without earned stretch`); why.add('UNEXPLAINED'); }
  // a car that left while other in-budget cars came in, with no approved cause and no question-flow change, is unexplained
  if (why.has('displaced') && !why.has('stretch') && !why.has('band') && !why.has('questions') && !why.has('tie')) why.add('UNEXPLAINED');
  if (why.has('UNEXPLAINED')) unexplained++;
  L.push(`- **${c.id}** (${c.text || 'guided'}): ${[...why].join(', ')}`, ...lines);
}
L.splice(3, 0, `Changed cases: ${changed} · unexplained: ${unexplained}`, '');
fs.writeFileSync(path.join(__dirname, 'DELTA.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
process.exit(unexplained ? 1 : 0);
