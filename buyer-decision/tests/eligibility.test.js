// Eligibility audit (P1-ELIGIBILITY-01). Run from buyer-decision/: node tests/eligibility.test.js [dataset dir ...]
// For each accepted/candidate dataset (default: U11 launch snapshot and the U12C candidate):
// 1. every on-sale model passes every brief-independent gate (nothing excluded for missing optional data)
// 2. stripping optional data (photo, warranty, registrations, hp, distributor, model year, segment) never changes eligibility;
//    stripping seats / drive only matters for briefs that require 7 seats / 4WD (approved: hard constraints need confirmation)
// 3. registrations are neutral: identical recommendations with all registration data removed, unless the buyer asks for 'popular'
// 4. named buyer scenarios: mainstream, luxury (Mercedes GLC), EV, hybrid (Geely EX5 EM-i), 7 seats, 4WD (Nissan Patrol)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'transport/reco.js'));
const E = T._internals.E;
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : [T.LAUNCH_SNAPSHOT, path.join(ROOT, 'datasets/U12C-2026-10-14')].filter(d => fs.existsSync(d));
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/regression/corpus.json'), 'utf8'));
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } };
const ids = r => (r.hero ? [r.hero.id, ...r.alts.map(a => a.id)] : []).concat(r.less ? ['less:' + r.less.id] : []);
const OPTIONAL = ['image', 'warranty', 'warranty_years', 'warranty_verified', 'reg', 'hp', 'distributor', 'model_year', 'segment'];

for (const dir of dirs) {
  const ds = T.loadAcceptedDataset(dir), U = ds.U, v = ds.universe_version;
  const on = U.models.filter(m => m.u);
  // 1. brief-independent gates
  const terr = E.territory({ budget: 1e9, budgetMode: 'around' });
  const notOk = on.filter(m => E.eligibility(m, { budget: 1e9 }, terr).status !== 'eligible');
  ok(!notOk.length, `${v}: on-sale models failing a brief-independent gate: ${notOk.map(m => m.id).join(', ')}`);
  // 2. optional data never decides eligibility
  const briefs = [{ budget: 2e6 }, { budget: 2e6, body: ['suv'] }, { budget: 1.5e6, pt: 'hybrid' }, { budget: 5e6, chinese: 'exclude' }, { budget: 2.5e6, seats: 7 }, { budget: 3e6, drive4: true }];
  let changed = [];
  for (const m of on) {
    const bare = { ...m }; OPTIONAL.forEach(k => delete bare[k]);
    for (const b0 of briefs) {
      const b = E.normalizeBrief(b0, {}), t = E.territory(b);
      if (E.eligibility(m, b, t).status !== E.eligibility(bare, b, t).status) changed.push(`${m.id}@${JSON.stringify(b0)}`);
    }
  }
  ok(!changed.length, `${v}: optional data changed eligibility: ${changed.slice(0, 5).join(' ')}`);
  for (const m of on.slice(0, 400)) {
    const noSeats = { ...m, seats: undefined }, noDrive = { ...m, awd: undefined };
    const b = E.normalizeBrief({ budget: 1e9 }, {}), t = E.territory(b);
    ok(E.eligibility(noSeats, b, t).status === 'eligible' && E.eligibility(noDrive, b, t).status === 'eligible', `${v}: ${m.id} missing seats/drive excluded without a 7-seat/4WD requirement`);
  }
  // 3. registration neutrality
  const noReg = { meta: U.meta, models: U.models.map(m => { const x = { ...m }; delete x.reg; return x; }) };
  let regDiff = [];
  for (const c of corpus) {
    if (((c.brief.priorities || []).includes('popular'))) continue;
    const a = E.recommend(U, JSON.parse(JSON.stringify(c.brief))), b = E.recommend(noReg, JSON.parse(JSON.stringify(c.brief)));
    if (JSON.stringify(ids(a)) !== JSON.stringify(ids(b))) regDiff.push(c.id);
  }
  ok(!regDiff.length, `${v}: registrations changed recommendations without a 'popular' priority: ${regDiff.join(', ')}`);
  // 4. named scenarios
  const run = (t, extra = {}) => { const b = T.normalize({ ...T.understand(t, ds), ...extra }, ds); return { b, r: E.recommend(U, b) }; };
  const byId = Object.fromEntries(U.models.map(m => [m.id, m]));
  const elig = (id, b) => E.eligibility(byId[id], b, E.territory(b)).status;
  { const { b, r } = run("I'm considering the Mercedes GLC, budget 5.5M"); ok(r.hero && r.hero.id === 'mercedes/glc', `${v}: GLC shortlist leads`); ok(elig('mercedes/glc', b) === 'eligible', `${v}: GLC eligible`); }
  { const { b } = run('Premium SUV around 5M'); ok(elig('mercedes/glc', b) === 'eligible', `${v}: GLC eligible for a premium SUV ~5M`); }
  { const { r } = run('Family SUV around EGP 1.5M'); ok(r.hero && r.eligible >= 80, `${v}: mainstream SUV result (${r.eligible} eligible)`); }
  { const { r } = run('Electric SUV around 2M'); ok(r.hero && [r.hero, ...r.alts].every(x => x.ev || x.anyEv), `${v}: EV brief returns EVs`); }
  { const { r } = run('Hybrid SUV around 1.5M'); ok(r.hero && [r.hero, ...r.alts].every(x => x.hybrid), `${v}: hybrid brief returns hybrids`); }
  { const { b, r } = run('7-seat family car, maximum EGP 2.2M'); ok(r.hero && r.eligible >= 13, `${v}: 7-seat brief (${r.eligible} eligible)`); }
  { const b = E.normalizeBrief({ budget: 14e6, body: ['suv'], drive4: true }, byId); ok(elig('nissan/patrol', b) === (byId['nissan/patrol'].awd ? 'eligible' : 'ineligible'), `${v}: Patrol 4WD state`); }
  { const em = byId['geely/ex5-em-i']; const b = E.normalizeBrief({ budget: 1.5e6, body: ['suv'], pt: 'hybrid' }, byId);
    ok(em && (em.u ? elig('geely/ex5-em-i', b) === 'eligible' : true), `${v}: EX5 EM-i eligible when in universe`);
    console.log(`  ${v}: on sale ${on.length} · EX5 EM-i in universe: ${!!(em && em.u)} · Patrol 4WD: ${byId['nissan/patrol'].awd} · 7-seat confirmed: ${on.filter(m => E.seven(m)).length} · seats unknown: ${on.filter(m => !(m.seats || []).length).length}`); }
}
console.log(`eligibility: ${n - fails}/${n} checks pass (${dirs.length} datasets)`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
