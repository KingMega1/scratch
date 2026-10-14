// Builds the U12 candidate recommendation view from the accepted U11 view + P2's corrected identities and accepted fields.
//   node tools/build_u12.mjs <p2 dir with catalogue-serving.release.json, market_universe.json, registration_models.csv> <p2 commit>
// No engine change, no new research: every value is either in the accepted U11 view or P2-accepted (commit pinned).
//
// Identity: P2 is the authority — the 283 catalogue entries + P2 market_additions (ADDITION / SPLIT). U11 ids P2 does not
//   identify (superseded spellings, duplicates, off-sale) and P2 OUT_OF_SCOPE/REVIEW ids are not in the universe.
// Splits: the parent's U11 versions with the split's powertrain move to the split identity (P2 conflation finding).
// Prices: P2-accepted trims update U11 versions with the same (normalised) name and are added otherwise; versions P2 has
//   not accepted stay (absent in P2 means UNKNOWN, not discontinued). The engine already uses the latest model year only.
// Seats / drive: P2-accepted (seats unioned with U11; drive AWD/4WD -> true, 2WD only -> false).
// Size class: U11 segment, else P2's accepted size_class segment, else the registration segment P2 matched (registration_models.csv).
// Brand facts (origin, chinese, Arabic brand names) for new identities: from the same brand's records in U11.
// In the universe when: passenger body (suv/sedan/hatch/mpv) AND priced current versions AND (model year >= 2025 OR
//   registrations in the last 12 months) AND size class known. Without a size class a car is HELD (not excluded for good):
//   adding it would push candidate pools below the engine's 80% size evidence coverage and drop space/size for every buyer.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = require(path.join(ROOT, 'transport/reco.js')); const E = T._internals.E;
const [p2dir, p2commit] = process.argv.slice(2);
if (!p2dir || !p2commit) throw new Error('usage: build_u12.mjs <p2 dir> <p2 commit>');
const rd = f => fs.readFileSync(path.join(p2dir, f));
const P2 = JSON.parse(rd('catalogue-serving.release.json')), MU = JSON.parse(rd('market_universe.json'));
const REG = {}; { const [h, ...rows] = rd('registration_models.csv').toString().trim().split('\n'); const k = h.split(',');
  for (const r of rows) { const v = r.split(','); const o = Object.fromEntries(k.map((x, i) => [x, v[i]])); REG[`${o.reg_brand}|${o.reg_model}`] = o; } }
const VERSION = process.env.CI_VERSION || 'U12C2-2026-10-14';
const base = T.loadLaunchSnapshot(), U11 = JSON.parse(JSON.stringify(base.U));
const V = Object.fromEntries(U11.models.map(m => [m.id, m]));
const IDN = Object.fromEntries(MU.identities.map(x => [x.id, x]));
const SEG = new Set(['SUV-B', 'SUV-C', 'SUV-D', 'SUV-E', 'Luxury SUV-2', 'Luxury SUV-3', 'Luxury SUV-4', 'Luxury SUV-5', 'Car-A', 'Car-B', 'Car-C', 'Car-D',
  'Luxury Car-2', 'Luxury Car-3', 'Luxury Car-4', 'Luxury Car-5', 'Car HB-A', 'Car HB-B', 'Car HB-C', 'Luxury HB', 'MPV-B', 'MPV-C', 'Luxury MPV']);
const BODY = { suv: 'suv', sedan: 'sedan', hatchback: 'hatch', hatch: 'hatch', mpv: 'mpv' };
const PT = p => (p === 'phev' || p === 'reev' ? { pt: 'hybrid', plugin: true } : p ? { pt: p, plugin: false } : { pt: null, plugin: false });
const nl = s => String(s || '').toLowerCase().replace(/\b(a\/t|m\/t|cvt|dct|at|mt)\b/g, ' ').replace(/\d\.\d\s*l?\b/g, ' ').replace(/[^a-z0-9]/g, '');
const brandOf = {}; U11.models.forEach(m => { if (!brandOf[m.brand_id]) brandOf[m.brand_id] = m; });
const log = { unknown_price: [], identities: 0, splits_moved: [], prices_updated: 0, versions_added: 0, seats: 0, awd: [], in_universe: [], held_no_size_class: [], excluded: {} };
const out = (id, reason) => { (log.excluded[reason] = log.excluded[reason] || []).push(id); };

// ---- identities ----
const recs = [];
for (const e of P2.entries) recs.push({ id: e.p1_id, p2: e, kind: 'core' });
for (const a of P2.market_additions) recs.push({ id: a.identity, p2: a, kind: a.universe === 'P2_SPLIT' ? 'split' : 'addition' });
const seen = new Set();
const models = [];
for (const r of recs) {
  if (seen.has(r.id)) continue; seen.add(r.id); log.identities++;
  const a = r.p2, u = V[r.id], idn = IDN[r.id] || {};
  const m = u ? JSON.parse(JSON.stringify(u)) : {
    id: r.id, brand_id: r.id.split('/')[0], brand: a.brand, model: a.model, ar: { brand: (brandOf[r.id.split('/')[0]] || {}).ar ? brandOf[r.id.split('/')[0]].ar.brand : [], model: [] },
    origin: (brandOf[r.id.split('/')[0]] || {}).origin, chinese: (brandOf[r.id.split('/')[0]] || {}).chinese, trims: [],
  };
  if (!u) { if (m.origin === undefined) delete m.origin; if (m.chinese === undefined) delete m.chinese; }
  const pts = (a.powertrains || []).map(p => PT(p).pt);
  if (!m.body && a.body) m.body = BODY[a.body] || a.body;
  if (!u) { m.body = BODY[a.body] || a.body || null; m.powertrains = [...new Set(pts)].filter(Boolean); }
  // split: move the parent's versions with the split's powertrain
  if (r.kind === 'split' && a.parent && V[a.parent]) {
    const want = new Set((a.powertrains || []).map(p => PT(p).pt));
    const par = models.find(x => x.id === a.parent) || V[a.parent];
    const moved = par.trims.filter(t => t.pt && want.has(t.pt));
    // only a powertrain split moves versions (a generation split with the same powertrain, e.g. Elantra AD/CN7, keeps the parent's)
    if (moved.length && moved.length < par.trims.length) { m.trims = moved.map(t => ({ ...t })); par.trims = par.trims.filter(t => !moved.includes(t)); log.splits_moved.push(`${a.parent} -> ${r.id}: ${moved.map(t => t.label).join(', ')}`); }
    for (const k of ['segment', 'seats', 'awd', 'origin', 'chinese', 'ar', 'distributor']) if (m[k] == null && par[k] != null) m[k] = JSON.parse(JSON.stringify(par[k]));
  }
  // prices
  const acc = (a.accepted && a.accepted.price && a.accepted.price.trims) || [];
  for (const t of acc) {
    if (!(t.price_egp > 0)) continue;
    const hit = m.trims.find(x => nl(x.label) && nl(x.label) === nl(t.label));
    const date = t.effective_date || t.as_of || null, official = t.tier === 'A';
    if (hit) { if (hit.min !== t.price_egp || hit.year !== t.model_year) log.prices_updated++; Object.assign(hit, { min: t.price_egp, year: t.model_year || hit.year, date, official }); }
    else { const single = (m.powertrains || []).length === 1 ? PT(a.powertrains && a.powertrains[0]) : { pt: null, plugin: false };
      m.trims.push({ label: t.label.trim(), min: t.price_egp, year: t.model_year || null, official, date, pt: single.pt, plugin: single.plugin }); log.versions_added++; }
  }
  // seats / drive (P2-accepted)
  const sp = (a.accepted && a.accepted.specs) || {};
  const seats = [...new Set((sp.seats || []).flatMap(x => (String(x.value).match(/^\d+/) || []).map(Number)))].filter(n => n >= 2 && n <= 9);
  if (seats.length) { const s0 = (m.seats || []).length; m.seats = [...new Set([...(m.seats || []), ...seats])].sort((x, y) => x - y); if (m.seats.length !== s0) log.seats++; }
  const dv = (sp.drive || []).map(x => String(x.value));
  if (dv.length) { const awd = dv.some(v => /awd|4wd|4x4|all.?wheel|four.?wheel|xdrive|quattro|4matic|dual.?motor/i.test(v)) ? true : dv.every(v => /fwd|rwd|2wd|4x2|front|rear|\bff\b/i.test(v)) ? false : null;
    if (awd !== null && m.awd !== awd) { log.awd.push(`${m.id}:${m.awd}->${awd}`); m.awd = awd; } }
  // size class + registrations for new identities (P2's registration match)
  const match = (idn.match || []).map(k => REG[k]).filter(Boolean);
  // P2-accepted size class (catalogue-serving accepted.size_class.segment, P2 b9fa5eb+); a length-only class is not mapped
  // to a segment here (that would be a new P1 size rule): the car stays held for size
  const psc = a.accepted && a.accepted.size_class;
  if (!m.segment && psc && SEG.has(psc.segment)) m.segment = psc.segment;
  if (!m.segment) { const s = match.map(x => x.segment_last12).find(x => SEG.has(x)); if (s) m.segment = s; }
  if (match.length && !((m.reg && m.reg.last12) > 0)) { const l12 = match.reduce((s, x) => s + (+x.last12 || 0), 0), all = match.reduce((s, x) => s + (+x.since_2021 || 0), 0); if (all) m.reg = { since_2021: all, last12: l12 }; }
  m.model_year = Math.max(0, ...m.trims.map(t => t.year || 0)) || null;
  models.push(m);
}
// ---- universe membership ----
for (const m of models) {
  const live = ((m.reg && m.reg.last12) || 0) > 0;
  let why = null;
  if (!['suv', 'sedan', 'hatch', 'mpv'].includes(m.body)) why = m.body ? `body_not_passenger_car:${m.body}` : 'no_body';
  else if (!E.currentTrims(m).length) {
    // P2-verified market identity without a price: in the universe as UNKNOWN PRICE (the engine's approved unknown-critical-data
    // state): never recommended, and when a buyer names it the result says "We don't have a current price for the X"
    // (approved copy) instead of the false "isn't sold new in Egypt".
    m.u = true; m.trims = []; log.unknown_price.push(m.id); continue;
  }
  else if (!((m.model_year || 0) >= 2025 || live)) why = 'discontinued';
  // `held` tells the engine WHY a known market car is outside the recommendation set, so a buyer who names it is told the
  // truth (never "not sold in Egypt"): 'scope' = a body type we don't recommend yet, 'size' = size class not yet confirmed
  if (why) { m.u = false; if (why.startsWith('body_not_passenger_car')) m.held = 'scope'; out(m.id, why); continue; }
  // the hold applies only to cars new to the universe: U11 members without a size class are already in today's pools
  if (E.size(m) == null && !(V[m.id] && V[m.id].u)) { m.u = false; m.held = 'size'; log.held_no_size_class.push(m.id); continue; }
  m.u = true; log.in_universe.push(m.id);
}
const U = { meta: { ...U11.meta, version: VERSION, built: '2026-10-14', models_in_universe: models.filter(m => m.u).length, models_priced_in_universe: models.filter(m => m.u && m.trims.length).length }, models: models.filter(m => m.body).sort((x, y) => x.id.localeCompare(y.id)) }; // identities without a body stay in the manifest only
const body = JSON.stringify(U), sha = s => crypto.createHash('sha256').update(s).digest('hex');
const dir = path.join(ROOT, 'datasets', VERSION); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'recommendation_view.json'), body + '\n');
const manifest = {
  schema: 'ci.dataset.v1', dataset_id: `${VERSION}/recommendation_view`, universe_version: VERSION,
  kind: 'CANDIDATE recommendation view — test link only; U11 stays the production binding until acceptance',
  file: 'recommendation_view.json', sha256: sha(body + '\n'), content_sha256: sha(body),
  identities: log.identities, models_in_universe: U.meta.models_in_universe,
  base: { dataset_id: base.id, content_sha256: base.sha256 },
  p2_input: { commit: p2commit, release_id: P2.release_id, files: Object.fromEntries(['catalogue-serving.release.json', 'market_universe.json', 'registration_models.csv'].map(f => [f, sha(rd(f))])) },
  registry: { snapshot_id: null, registration_months: U.meta.registration_months, last12_window: U.meta.last12_window, note: 'registrations: sale evidence and size class source only; their absence never excludes' },
  changes: { splits_moved: log.splits_moved, prices_updated: log.prices_updated, versions_added: log.versions_added, seats_changed: log.seats, awd: log.awd,
    unknown_price: log.unknown_price, held_no_size_class: log.held_no_size_class, excluded: log.excluded },
};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ identities: log.identities, in_universe: log.in_universe.length, unknown_price: log.unknown_price.length, held_no_size_class: log.held_no_size_class.length,
  excluded: Object.fromEntries(Object.entries(log.excluded).map(([k, v]) => [k, v.length])), splits: log.splits_moved, prices_updated: log.prices_updated, versions_added: log.versions_added, seats: log.seats, awd: log.awd.length }, null, 1));
