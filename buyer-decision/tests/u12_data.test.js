// U12 data-consumption checks on a candidate recommendation view (P2 fc19238+). Run: node tests/u12_data.test.js [dataset dir] [p2 flat dir]
// Data invariants only: no ranking, parser or copy semantics are tested here (tests/regression does that).
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E, P = require('../app/brief.js');
const dir = process.argv[2] || path.join(__dirname, '..', 'datasets/U12-RC3-2026-10-15');
const ds = T.loadAcceptedDataset(dir), M = ds.U.models, by = Object.fromEntries(M.map(m => [m.id, m]));
const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const U11 = T.loadLaunchSnapshot().U.models, b11 = Object.fromEntries(U11.map(m => [m.id, m]));
let n = 0, fails = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } };
const elig = (m, b) => E.eligibility(m, E.normalizeBrief({ budget: 1e9, budgetMode: 'max', ...b }, by), E.territory({ budget: 1e9, budgetMode: 'max', ...b }));

// 1. no unpriced model is recommendable; every U11 universe model is still in the universe
for (const m of M) if (m.u && !E.currentTrims(m).length) ok(elig(m, {}).status !== 'eligible', `${m.id}: unpriced but eligible`);
ok(U11.filter(m => m.u).every(m => by[m.id] && by[m.id].u && by[m.id].trims.length), 'a U11 universe model left the universe');

// 2. EX5 Electric and EX5 EM-i are separate identities with disjoint versions and powertrains
const ex5 = by['geely/ex5'], emi = by['geely/ex5-em-i'];
ok(ex5 && emi, 'EX5 / EX5 EM-i present');
if (ex5 && emi) {
  ok(ex5.trims.length && ex5.trims.every(t => t.pt === 'ev'), 'EX5 versions are all EV');
  ok(emi.trims.length && emi.trims.every(t => t.pt === 'hybrid' && t.plugin), 'EX5 EM-i versions are all plug-in hybrid');
  // powertrain filters are exclusions in the approved engine ("no fully electric", "petrol only", explicit "no X")
  ok(elig(ex5, { pt: 'no_ev' }).status === 'ineligible', 'EX5 Electric must be excluded by "no fully electric"');
  ok(elig(ex5, { ptNo: ['ev'] }).status === 'ineligible', 'EX5 Electric must be excluded by "no EV"');
  ok(elig(ex5, { ptNo: ['hybrid'] }).status === 'eligible', 'EX5 Electric must not be excluded by "no hybrid" (EM-i facts leaking)');
  ok(elig(emi, { ptNo: ['hybrid'] }).status !== 'eligible', 'EX5 EM-i must not be eligible under "no hybrid"');
  ok(elig(emi, { pt: 'no_ev' }).status !== 'ineligible' || !emi.u, 'EX5 EM-i must not be excluded by "no fully electric"');
  ok(ex5.segment === 'SUV-C' && !emi.segment, 'EX5 EM-i does not inherit the EX5 Electric size class');
}

// 3. Tucson: the facts P1 serves are the P2-accepted market-page values, never the quarantined Venue-brochure rows
const tu = by['hyundai/tucson'], tu0 = b11['hyundai/tucson'];
ok(JSON.stringify(tu.hp) === JSON.stringify([180]) && tu.warranty_years === 5, `Tucson hp/warranty ${tu.hp}/${tu.warranty_years}`);
for (const k of ['hp', 'warranty', 'warranty_years', 'segment', 'seats', 'awd', 'powertrains']) ok(JSON.stringify(tu[k]) === JSON.stringify(tu0[k]), `Tucson ${k} changed vs U11`);
ok(!Object.keys(tu).some(k => /length|height|wheelbase|engine|torque/.test(k)), 'Tucson view carries no dimension/engine field');
const p2dir = process.argv[3];
if (p2dir && fs.existsSync(path.join(p2dir, 'catalogue-serving.release.json'))) {
  const S = JSON.parse(fs.readFileSync(path.join(p2dir, 'catalogue-serving.release.json'), 'utf8'));
  const a = S.entries.find(x => x.p1_id === 'hyundai/tucson').accepted;
  ok(!a.specs.length_mm && !a.specs.height_mm && !a.specs.engine, 'P2 serving release still exposes quarantined Tucson rows');
  ok((a.specs.power_hp || []).some(x => x.value === '180' && /ContactCars/.test(x.issuer)), 'Tucson power from market pages');
}

// 4. official dated price lists: list versions only, no invented model year, marked official
for (const o of man.changes.official_lists || []) {
  const m = by[o.id]; if (!m) { ok(false, `${o.id} missing`); continue; }
  ok(m.trims.length === o.versions.length && m.trims.every(t => t.year === null && t.official && t.date === o.effective), `${o.id}: official list not applied as the version set`);
}

// 5. Arabic model names from the P2 registry are recognised (brand + model in Arabic) and carry no foreign-model collision
for (const s of man.changes.arabic_names_added || []) {
  const [id, ar] = s.split('='); const m = by[id]; if (!m || !m.u) continue;
  const br = (m.ar && m.ar.brand && m.ar.brand[0]) || m.brand;
  const got = (P.parse(`عايز ${br} ${ar}`, M).mentions || []).map(x => x.id);
  ok(got.includes(id), `AR "${br} ${ar}" -> ${got.join(',') || 'none'} (want ${id})`);
  ok(got.every(g => g === id || g.split('/')[0] === id.split('/')[0]), `AR "${br} ${ar}" also matched ${got.join(',')}`);
}

// 6. no safety-feature field is served (12 P2 HOLD_SCHEMA proposals are not consumed)
ok(!M.some(m => Object.keys(m).some(k => /safety|airbag|abs|esc|stability/i.test(k))), 'a safety-feature field reached the view');

console.log(`u12 data: ${n - fails}/${n} checks pass (${ds.universe_version})`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
