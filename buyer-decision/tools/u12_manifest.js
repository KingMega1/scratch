// Per-model eligibility manifest + customer coverage report for a U12 candidate.
// Usage (from buyer-decision/): node tools/u12_manifest.js <dataset dir> <p2 flat dir with catalogue-serving.release.json> [p2 readiness-416.json]
// Reconciles: P2 catalogue (416) · P1 universe states · P2 "evidence-filtered" readiness classes (207 data-ready) · released U11 (283).
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const [dir, p2dir, readyPath] = process.argv.slice(2);
const ds = T.loadAcceptedDataset(dir), man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(p2dir, 'catalogue-serving.release.json'), 'utf8'));
const P2 = Object.fromEntries([...S.entries, ...S.market_additions].map(x => [x.p1_id || x.identity, x]));
const READY = readyPath ? Object.fromEntries(JSON.parse(fs.readFileSync(readyPath, 'utf8')).map(r => [r.p1_id, r])) : {};
const U11 = new Set(T.loadLaunchSnapshot().U.models.filter(m => m.u).map(m => m.id));
const OL = new Set((man.changes.official_lists || []).map(o => o.id));
const ex = man.changes.excluded || {};
const exReason = id => Object.keys(ex).find(k => ex[k].includes(id));
const by = Object.fromEntries(ds.U.models.map(m => [m.id, m]));
const rows = [];
for (const id of Object.keys(P2).sort()) {
  const m = by[id], p = P2[id], acc = ((p.accepted && p.accepted.price && p.accepted.price.trims) || []).filter(t => t.price_egp > 0);
  const cur = m ? E.currentTrims(m) : [];
  const state = !m ? 'NOT_IN_VIEW:' + (exReason(id) || 'no_body')
    : m.u && cur.length ? 'RECOMMENDABLE' : m.u ? 'UNKNOWN_PRICE' : m.held === 'size' ? 'HELD_NO_SIZE_CLASS' : m.held === 'scope' ? 'POLICY_SCOPE_' + (exReason(id) || '').split(':')[1] : 'EXCLUDED:' + (exReason(id) || '?');
  const priceBasis = !cur.length ? 'none' : OL.has(id) ? 'P2_TIER_A_OFFICIAL_LIST' : acc.length ? 'P2_ACCEPTED' : 'U11_RELEASED_ONLY';
  const r = READY[id] || {};
  rows.push({ id, brand: p.brand, model: p.model, u11_released: U11.has(id), state, price_basis: priceBasis, versions: cur.length,
    from_egp: cur.length ? Math.min(...cur.map(t => t.min)) : '', size_class: m && m.segment && E.size(m) ? m.segment : '',
    arabic_model_name: m && m.ar && (m.ar.model || []).length ? 'yes' : 'no', p2_readiness: r.readiness || '',
    p2_blockers: (r.blockers || []).map(b => b.field).join('+') });
}
const q = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const cols = Object.keys(rows[0]);
fs.writeFileSync(path.join(dir, 'ELIGIBILITY-MANIFEST.csv'), [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n') + '\n');
const cnt = f => rows.reduce((o, r) => { const k = f(r); o[k] = (o[k] || 0) + 1; return o; }, {});
const rec = rows.filter(r => r.state === 'RECOMMENDABLE');
const sum = {
  catalogue: rows.length, u11_released: rows.filter(r => r.u11_released).length,
  state: cnt(r => r.state), recommendable_by_price_basis: cnt(r => r.state === 'RECOMMENDABLE' ? r.price_basis : '-'),
  recommendable_by_p2_readiness: Object.fromEntries(Object.entries(cnt(r => r.state === 'RECOMMENDABLE' ? r.p2_readiness || '(none)' : '-')).filter(([k]) => k !== '-')),
  p2_readiness_by_state: cnt(r => `${r.p2_readiness || '(none)'} -> ${r.state}`),
  u11_released_now: cnt(r => r.u11_released ? r.state : '-'),
  models_with_accepted_price: rows.filter(r => r.price_basis.startsWith('P2_')).length,
  recommendable: rec.length, recommendable_new_vs_u11: rec.filter(r => !r.u11_released).length,
};
delete sum.recommendable_by_price_basis['-']; delete sum.u11_released_now['-'];
fs.writeFileSync(path.join(dir, 'ELIGIBILITY-SUMMARY.json'), JSON.stringify(sum, null, 1) + '\n');
console.log(JSON.stringify(sum, null, 1));
