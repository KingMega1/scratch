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
function parseCsv(t) { const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); out.push(row); } return out.filter(r => r.length > 1); }
const P2 = JSON.parse(rd('catalogue-serving.release.json')), MU = JSON.parse(rd('market_universe.json'));
const REG = {}; { const [h, ...rows] = rd('registration_models.csv').toString().trim().split('\n'); const k = h.split(',');
  for (const r of rows) { const v = r.split(','); const o = Object.fromEntries(k.map((x, i) => [x, v[i]])); REG[`${o.reg_brand}|${o.reg_model}`] = o; } }
// Arabic model names accepted by P2 (registry; not yet in the serving release). Optional: absent files = none.
const ARN = {}; for (const f of ['u11_models.csv', 'arabic_names.csv']) { const fp = path.join(p2dir, f); if (!fs.existsSync(fp)) continue;
  const [h, ...rows] = parseCsv(fs.readFileSync(fp, 'utf8')); const ix = k => h.indexOf(k);
  for (const v of rows) { const id = v[ix('p1_id')], ar = (v[ix('model_ar')] || '').trim(), st = ix('status') >= 0 ? v[ix('status')] : 'ACCEPT';
    if (id && ar && /[\u0600-\u06FF]/.test(ar) && st === 'ACCEPT') ARN[id] = ar; } }
const VERSION = process.env.CI_VERSION || 'U12C2-2026-10-14';
const OFFICIAL_LISTS = process.env.CI_OFFICIAL_LISTS !== '0';
// CEO decisions 2026-10-21 (each reversible with =0): use P2 held market prices for cars with no accepted price;
// recommend cars without a size class; recommend coupes and convertibles like any passenger car
const MARKET_PRICES = process.env.CI_MARKET_PRICES !== '0', NO_SIZE_HOLD = process.env.CI_NO_SIZE_HOLD !== '0', COUPES = process.env.CI_COUPES !== '0', VANS = process.env.CI_VANS !== '0';
// CEO price review overrides (tools/ceo_price_overrides.json): market prices removed, brands never shown as official
const OVR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/ceo_price_overrides.json'), 'utf8'));
// P2 market price rows held for review (registry u11_prices.csv, status REWORK): single site or sites disagree
const MKT = {}; { const fp = path.join(p2dir, 'u11_prices.csv'); if (fs.existsSync(fp)) { const [h, ...rows] = parseCsv(fs.readFileSync(fp, 'utf8')); const ix = k => h.indexOf(k);
  for (const v of rows) { if (v[ix('status')] !== 'REWORK' || !(+v[ix('price_egp')] > 0)) continue; (MKT[v[ix('p1_id')]] = MKT[v[ix('p1_id')]] || []).push({ label: v[ix('trim_label')].trim(), min: +v[ix('price_egp')], year: +v[ix('model_year')] || null, date: v[ix('observed_at')] || null }); } } } // reversible: CI_OFFICIAL_LISTS=0 restores the RC2 merge behaviour
const base = T.loadLaunchSnapshot(), U11 = JSON.parse(JSON.stringify(base.U));
const V = Object.fromEntries(U11.models.map(m => [m.id, m]));
const IDN = Object.fromEntries(MU.identities.map(x => [x.id, x]));
const SEG = new Set(['SUV-B', 'SUV-C', 'SUV-D', 'SUV-E', 'Luxury SUV-2', 'Luxury SUV-3', 'Luxury SUV-4', 'Luxury SUV-5', 'Car-A', 'Car-B', 'Car-C', 'Car-D',
  'Luxury Car-2', 'Luxury Car-3', 'Luxury Car-4', 'Luxury Car-5', 'Car HB-A', 'Car HB-B', 'Car HB-C', 'Luxury HB', 'MPV-B', 'MPV-C', 'Luxury MPV']);
const BODY = { suv: 'suv', sedan: 'sedan', hatchback: 'hatch', hatch: 'hatch', mpv: 'mpv' };
const PT = p => (p === 'phev' || p === 'reev' ? { pt: 'hybrid', plugin: true } : p ? { pt: p, plugin: false } : { pt: null, plugin: false });
const nl = s => String(s || '').toLowerCase().replace(/\b(a\/t|m\/t|cvt|dct|at|mt)\b/g, ' ').replace(/\d\.\d\s*l?\b/g, ' ').replace(/[^a-z0-9]/g, '');
const brandOf = {}; U11.models.forEach(m => { if (!brandOf[m.brand_id]) brandOf[m.brand_id] = m; });
const log = { market_prices: [], off_sale: [], powertrains: [], official_lists: [], arabic_names: [], unknown_price: [], identities: 0, splits_moved: [], prices_updated: 0, versions_added: 0, seats: 0, awd: [], in_universe: [], held_no_size_class: [], excluded: {} };
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
  // P2-accepted model powertrains (release accepted.powertrains, P2 1594601+): corrects split parents whose U11 record still
  // lists the split-off variant (e.g. EX5 = EV only; EM-i is its own identity). Model level only; versions keep their own pt.
  const apt = a.accepted && Array.isArray(a.accepted.powertrains) && a.accepted.powertrains.length ? [...new Set(a.accepted.powertrains.map(p => PT(p).pt))].filter(Boolean) : null;
  if (apt && apt.length && JSON.stringify(apt) !== JSON.stringify(m.powertrains)) { log.powertrains.push(`${r.id}: ${JSON.stringify(m.powertrains)} -> ${JSON.stringify(apt)}`); m.powertrains = apt; }
  // P2/CEO model-status decision: discontinued in Egypt -> off sale (engine: not_on_sale). Never inferred by P1.
  if (a.accepted && a.accepted.market_status === 'discontinued') m.off_sale = true;
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
    else { const src = apt ? a.accepted.powertrains : a.powertrains; // the corrected list when P2 accepted one
      const single = (m.powertrains || []).length === 1 ? PT(src && src.length === 1 ? src[0] : m.powertrains[0]) : { pt: null, plugin: false };
      m.trims.push({ label: t.label.trim(), min: t.price_egp, year: t.model_year || null, official, date, pt: single.pt, plugin: single.plugin }); log.versions_added++; }
  }
  // Official dated price list (P2 Tier A, SOURCE_STATED effective date, model year not stated, e.g. Mercedes-Benz Egypt
  // 24.09.2026 / Mansour-MG 15.10.2026): newer than every version the model already carries -> it IS the current version set.
  // Labels on these lists rarely match the older market labels, and the engine keeps only the latest model year, so merging
  // would leave stale prices showing. No model year is invented (year stays null). Superseded rows are logged per model.
  if (OFFICIAL_LISTS) {
    const ol = acc.filter(t => t.price_egp > 0 && t.tier === 'A' && t.model_year == null && t.date_basis === 'SOURCE_STATED' && t.effective_date);
    const prior = m.trims.filter(x => !ol.some(t => t.label.trim() === x.label));
    const newest = prior.map(x => x.date || '').sort().pop() || '';
    const eff = ol.map(t => t.effective_date).sort().pop();
    if (ol.length && eff > newest) {
      const PTN = { petrol: 'petrol', diesel: 'diesel', electric: 'ev', ev: 'ev', hybrid: 'hybrid', phev: 'phev' };
      const single = (m.powertrains || []).length === 1 ? m.powertrains[0] : null;
      const nt = ol.map(t => { const p = PT(PTN[String(t.powertrain || '').toLowerCase()] || null);
        return { label: t.label.trim(), min: t.price_egp, year: null, official: true, date: t.effective_date, pt: p.pt || single, plugin: p.plugin }; });
      log.official_lists.push({ id: m.id, effective: eff, versions: nt.map(t => `${t.label}=${t.min}`), superseded: m.trims.filter(x => !nt.some(t => t.label === x.label)).map(x => `${x.label}=${x.min}${x.year ? ' MY' + x.year : ''}`) });
      m.trims = nt; m.official_list = eff;
    }
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
  // Arabic model name: P2-accepted registry (u11_models.csv model_ar; arabic_names.csv) into the existing ar.model field
  const arn = ARN[r.id];
  if (arn && !(m.ar && m.ar.model || []).includes(arn)) { m.ar = { brand: (m.ar && m.ar.brand) || [], model: [...((m.ar && m.ar.model) || []), arn] }; log.arabic_names.push(`${r.id}=${arn}`); }
  m.model_year = Math.max(0, ...m.trims.map(t => t.year || 0)) || null;
  models.push(m);
}
// ---- universe membership ----
for (const m of models) {
  const live = ((m.reg && m.reg.last12) || 0) > 0;
  let why = null;
  if (m.off_sale) { m.u = false; log.off_sale.push(m.id); out(m.id, 'p2_discontinued'); continue; }
  if (!['suv', 'sedan', 'hatch', 'mpv', ...(COUPES ? ['coupe', 'convertible'] : []), ...(VANS ? ['van'] : [])].includes(m.body)) why = m.body ? `body_not_passenger_car:${m.body}` : 'no_body';
  else if (!E.currentTrims(m).length && MARKET_PRICES && (MKT[m.id] || []).length && !OVR.remove_market_price[m.id]) {
    // one version per (model year, label): the latest observation wins; on a tie the higher price (safer for budgets)
    const best = {}; for (const r of MKT[m.id]) { const k = `${r.year}|${nl(r.label) || r.label}`, o = best[k];
      if (!o || (r.date || '') > (o.date || '') || ((r.date || '') === (o.date || '') && r.min > o.min)) best[k] = r; }
    const single = (m.powertrains || []).length === 1 ? m.powertrains[0] : null;
    m.trims = Object.values(best).map(r => ({ label: r.label || 'Unspecified trim', min: r.min, year: r.year, official: false, date: r.date, pt: single, plugin: false }));
    m.model_year = Math.max(0, ...m.trims.map(t => t.year || 0)) || null;
    m.market_seen = m.trims.map(t => t.date || '').sort().pop(); // a new-car listing seen in the market is current-sale evidence
    log.market_prices.push(`${m.id}: ${E.currentTrims(m).map(t => t.label + '=' + t.min).join('; ')}`);
  }
  if (why) { /* set below */ }
  else if (!E.currentTrims(m).length) {
    // P2-verified market identity without a price: in the universe as UNKNOWN PRICE (the engine's approved unknown-critical-data
    // state): never recommended, and when a buyer names it the result says "We don't have a current price for the X"
    // (approved copy) instead of the false "isn't sold new in Egypt".
    m.u = true; m.trims = []; log.unknown_price.push(m.id); continue;
  }
  else if (!((m.model_year || 0) >= 2025 || live || (m.official_list && m.official_list >= '2025-10-15') || (m.market_seen && m.market_seen >= '2025-10-21'))) why = 'discontinued'; // a dated official list within 12 months is current-sale evidence
  // `held` tells the engine WHY a known market car is outside the recommendation set, so a buyer who names it is told the
  // truth (never "not sold in Egypt"): 'scope' = a body type we don't recommend yet, 'size' = size class not yet confirmed
  if (why) { m.u = false; if (why.startsWith('body_not_passenger_car')) m.held = 'scope'; out(m.id, why); continue; }
  // the hold applies only to cars new to the universe: U11 members without a size class are already in today's pools
  if (!NO_SIZE_HOLD && E.size(m) == null && !(V[m.id] && V[m.id].u)) { m.u = false; m.held = 'size'; log.held_no_size_class.push(m.id); continue; }
  m.u = true; log.in_universe.push(m.id);
}
models.forEach(m => { delete m.official_list; delete m.off_sale; delete m.market_seen;
  if (OVR.never_official_brands[m.brand_id]) m.trims.forEach(t => { t.official = false; }); }); // build-time only
const U = { meta: { ...U11.meta, version: VERSION, built: VERSION.slice(-10), models_in_universe: models.filter(m => m.u).length, models_priced_in_universe: models.filter(m => m.u && m.trims.length).length }, models: models.filter(m => m.body).sort((x, y) => x.id.localeCompare(y.id)) }; // identities without a body stay in the manifest only
const body = JSON.stringify(U), sha = s => crypto.createHash('sha256').update(s).digest('hex');
const dir = path.join(ROOT, 'datasets', VERSION); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'recommendation_view.json'), body + '\n');
const manifest = {
  schema: 'ci.dataset.v1', dataset_id: `${VERSION}/recommendation_view`, universe_version: VERSION,
  kind: 'CANDIDATE recommendation view — test link only; U11 stays the production binding until acceptance',
  file: 'recommendation_view.json', sha256: sha(body + '\n'), content_sha256: sha(body),
  identities: log.identities, models_in_universe: U.meta.models_in_universe,
  base: { dataset_id: base.id, content_sha256: base.sha256 },
  p2_input: { commit: p2commit, release_id: P2.release_id, files: Object.fromEntries(['catalogue-serving.release.json', 'market_universe.json', 'registration_models.csv', 'u11_models.csv', 'arabic_names.csv'].filter(f => fs.existsSync(path.join(p2dir, f))).map(f => [f, sha(rd(f))])) },
  registry: { snapshot_id: null, registration_months: U.meta.registration_months, last12_window: U.meta.last12_window, note: 'registrations: sale evidence and size class source only; their absence never excludes' },
  changes: { policy: { market_prices: MARKET_PRICES, no_size_hold: NO_SIZE_HOLD, coupes_convertibles: COUPES, vans: VANS, decided: 'CEO 2026-10-21', price_overrides: OVR }, market_prices: log.market_prices, off_sale: log.off_sale, powertrains: log.powertrains, official_lists: log.official_lists, arabic_names_added: log.arabic_names, splits_moved: log.splits_moved, prices_updated: log.prices_updated, versions_added: log.versions_added, seats_changed: log.seats, awd: log.awd,
    unknown_price: log.unknown_price, held_no_size_class: log.held_no_size_class, excluded: log.excluded },
};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ market_prices: log.market_prices.length, off_sale: log.off_sale, powertrains: log.powertrains.length, official_lists: log.official_lists.length, arabic_names: log.arabic_names.length, identities: log.identities, in_universe: log.in_universe.length, unknown_price: log.unknown_price.length, held_no_size_class: log.held_no_size_class.length,
  excluded: Object.fromEntries(Object.entries(log.excluded).map(([k, v]) => [k, v.length])), splits: log.splits_moved, prices_updated: log.prices_updated, versions_added: log.versions_added, seats: log.seats, awd: log.awd.length }, null, 1));
