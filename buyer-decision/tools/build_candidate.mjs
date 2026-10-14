// Builds a CANDIDATE recommendation view (U12C) from the accepted U11 view + current P2-accepted fields. No engine change.
//   node tools/build_candidate.mjs <P2 catalogue-serving.release.json> <P2 commit>
// 1. P2-accepted overlay (P2 release entries[].accepted.specs), P2 wins on what it accepted:
//    seats  -> union of U11 seats and P2-accepted seat counts (per-trim observations; nothing dropped)
//    awd    -> P2-accepted drive: AWD/4WD/4x4 -> true; FWD/RWD/2WD only -> false
// 2. Universe inclusion (the `u` flag), corrected to the approved rule "unverified market status != unavailable;
//    discontinued excluded": a priced, current car of a passenger body is in the universe unless it is discontinued
//    (latest model year before 2025 AND no registrations in the last 12 months). Missing registrations alone, or a single
//    listing source, no longer exclude it (U11 build rule `no_sale_evidence`), and live registrations override an old
//    listed model year (U11 rule `stale_model_year`).
// Prices stay as in U11 (P2-accepted trim prices lack per-trim powertrain; differences reported in the manifest).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = require(path.join(ROOT, 'transport/reco.js')); const E = T._internals.E;
const [p2file, p2commit] = process.argv.slice(2);
if (!p2file || !p2commit) throw new Error('usage: build_candidate.mjs <catalogue-serving.release.json> <p2 commit>');
const p2raw = fs.readFileSync(p2file); const P2 = JSON.parse(p2raw);
const base = T.loadLaunchSnapshot();
const U = JSON.parse(JSON.stringify(base.U));
const VERSION = 'U12C-2026-10-14';
const log = { seats_added: [], seats_extended: [], awd_set: [], awd_corrected: [], included: [], held_for_p2_size_class: [], still_excluded: [] };

const AWD = /awd|4wd|4x4|all.?wheel|four.?wheel|xdrive|quattro|4matic|dual.?motor/i, TWO = /fwd|rwd|2wd|4x2|front|rear|\bff\b/i;
const byId = Object.fromEntries(U.models.map(m => [m.id, m]));
for (const e of P2.entries) {
  const m = byId[e.p1_id], sp = (e.accepted && e.accepted.specs) || {};
  if (!m) continue;
  const seats = [...new Set((sp.seats || []).flatMap(x => (String(x.value).match(/^\d+/) || []).map(Number)))].filter(n => n >= 2 && n <= 9);
  if (seats.length) {
    const before = m.seats || [];
    const after = [...new Set([...before, ...seats])].sort((a, b) => a - b);
    if (!before.length) log.seats_added.push(`${m.id}:${after.join('/')}`);
    else if (after.length !== before.length) log.seats_extended.push(`${m.id}:${before.join('/')}->${after.join('/')}`);
    m.seats = after;
  }
  const dv = (sp.drive || []).map(x => String(x.value));
  if (dv.length) {
    const awd = dv.some(v => AWD.test(v)) ? true : dv.every(v => TWO.test(v)) ? false : null;
    if (awd !== null && m.awd !== awd) { (m.awd == null ? log.awd_set : log.awd_corrected).push(`${m.id}:${m.awd}->${awd} (${dv.join(' | ')})`); m.awd = awd; }
  }
}
for (const m of U.models) {
  const live = ((m.reg && m.reg.last12) || 0) > 0;
  const current = (m.model_year || 0) >= 2025 || live;
  const ok = E.currentTrims(m).length > 0 && !!m.body && current;
  const tag = `${m.id} (MY${m.model_year}, reg12 ${(m.reg && m.reg.last12) || 0})`;
  if (m.u) continue;
  // a car without a size class would push the universe below the engine's 80% evidence coverage for space/size
  // (rankFit COVERAGE) and silently remove those factors for every buyer: held until P2 supplies identity + size class
  if (ok && E.size(m) == null) log.held_for_p2_size_class.push(tag);
  else if (ok) { log.included.push(tag); m.u = true; }
  else log.still_excluded.push(tag);
}
U.meta = { ...U.meta, version: VERSION, built: '2026-10-14', models_in_universe: U.models.filter(m => m.u).length };
const body = JSON.stringify(U);
const dir = path.join(ROOT, 'datasets', VERSION);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'recommendation_view.json'), body + '\n');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const manifest = {
  schema: 'ci.dataset.v1', dataset_id: `${VERSION}/recommendation_view`, universe_version: VERSION,
  kind: 'CANDIDATE recommendation view — test link only; production binding stays on U11 until P2 accepts the identities added below',
  file: 'recommendation_view.json', sha256: sha(body + '\n'), content_sha256: sha(body),
  models: U.models.length, models_in_universe: U.meta.models_in_universe,
  base: { dataset_id: base.id, content_sha256: base.sha256 },
  p2_input: { release_id: P2.release_id, state: P2.state, commit: p2commit, path: 'vehicle-data/views/catalogue-serving.release.json', sha256: sha(p2raw) },
  registry: { snapshot_id: null, registration_months: U.meta.registration_months, last12_window: U.meta.last12_window, note: 'registrations used as positive sale evidence only; absence never excludes' },
  rules: [
    'seats: union(U11 seats, P2-accepted seats)', 'awd: P2-accepted drive overrides (AWD/4WD -> true, 2WD only -> false)',
    'u: priced current trims AND passenger body AND (model_year >= 2025 OR registrations last 12 months > 0) AND size class known',
    'held: qualifying cars without a size class (would drop space/size factors for all buyers under the approved 80% coverage rule) until P2 supplies identity + size class',
  ],
  changes: Object.fromEntries(Object.entries(log).map(([k, v]) => [k, { count: v.length, items: v }])),
};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ universe: U.meta.models_in_universe, ...Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v.length])) }));
console.log('awd corrected:', log.awd_corrected); console.log('awd set:', log.awd_set);
