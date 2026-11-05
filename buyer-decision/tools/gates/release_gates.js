// Release gates vs the accepted P2 serving release: price, model-year and version parity, stale-price holds, official/market labels (EN+AR).
// node tools/gates/release_gates.js <buyer-decision dir> <dataset dir> <p2 catalogue-serving.release.json> -> JSON; exit 1 on any failure
const [root, dsdir, servPath] = process.argv.slice(2);
const fs = require('fs');
const T = require(root + '/transport/reco.js'), { E, Present, I } = T._internals;
const ds = T.loadAcceptedDataset(dsdir), S = JSON.parse(fs.readFileSync(servPath, 'utf8'));
const OVR = JSON.parse(fs.readFileSync(root + '/tools/ceo_price_overrides.json', 'utf8'));
const HOLD = JSON.parse(fs.readFileSync(root + '/tools/p1_price_holds.json', 'utf8'));
const by = Object.fromEntries(ds.U.models.map(m => [m.id, m]));
const acc = {};
for (const e of [...S.entries, ...(S.market_additions || [])]) { const p = e.accepted && e.accepted.price; if (p && p.price_from > 0) acc[e.p1_id || e.identity] = p; }
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const F = { price: [], model_year: [], trims: [], official: [], holds: [], labels: [] };
let checked = 0;
for (const [id, p] of Object.entries(acc)) {
  const m = by[id]; if (!m) continue; checked++;
  const cur = E.currentTrims(m), from = cur.length ? Math.min(...cur.map(t => t.min)) : null;
  if (from !== p.price_from) F.price.push({ id, p1: from, p2: p.price_from });
  const y1 = cur.length ? (cur[0].year ?? null) : null, y2 = p.model_year ?? null;
  if (cur.some(t => (t.year ?? null) !== y1) || y1 !== y2) F.model_year.push({ id, p1: [...new Set(cur.map(t => t.year))], p2: y2 });
  const pt = (p.trims || []).filter(t => t.price_egp > 0 && (t.model_year ?? null) === y2);
  if (pt.length) {
    const a = cur.map(t => `${norm(t.label)}=${t.min}`).sort(), b = [...new Set(pt.map(t => `${norm(t.label)}=${t.price_egp}`))].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) F.trims.push({ id, p1_only: a.filter(x => !b.includes(x)), p2_only: b.filter(x => !a.includes(x)) });
  } else if (!(cur.length === 1 && cur[0].price_from_only !== undefined ? true : cur.length === 1 && cur[0].min === p.price_from)) F.trims.push({ id, note: 'P2 price_from without trims; P1 not a single from-only version', p1: cur.map(t => t.label + '=' + t.min) });
  const never = OVR.never_official_brands[m.brand_id];
  for (const t of cur) {
    const src = pt.find(x => norm(x.label) === norm(t.label) && x.price_egp === t.min);
    const want = never ? false : src ? src.tier === 'A' : p.tier === 'A';
    if (!!t.official !== want) F.official.push({ id, version: t.label, min: t.min, p1_official: !!t.official, expected: want, tier: src ? src.tier : p.tier });
  }
}
// stale-price holds
const pass = by['volkswagen/passat'], pc = pass ? E.currentTrims(pass) : [];
if (!pass || (pass.trims || []).some(t => t.min === 1600000 || t.year === 2023)) F.holds.push({ id: 'volkswagen/passat', issue: 'stale MY2023 / EGP 1,600,000 row present' });
if (pc.length !== 1 || pc[0].min !== 2550000 || pc[0].year !== 2026 || pc[0].official) F.holds.push({ id: 'volkswagen/passat', issue: 'expected MY2026 EGP 2,550,000 market (official:false)', got: pc.map(t => [t.label, t.min, t.year, t.official]) });
for (const id of Object.keys(OVR.remove_market_price)) {
  if (id === 'volkswagen/passat') continue; const m = by[id]; if (!m) continue;
  const bad = E.currentTrims(m).filter(t => !t.official && !(acc[id]));
  if (bad.length) F.holds.push({ id, issue: 'removed market price is served', got: bad.map(t => t.label + '=' + t.min) });
}
for (const m of ds.U.models) if (OVR.never_official_brands[m.brand_id] && m.trims.some(t => t.official)) F.holds.push({ id: m.id, issue: 'never-official brand has official version' });
for (const id of Object.keys(HOLD.hold)) { const m = by[id]; if (m && m.u && E.currentTrims(m).length) F.holds.push({ id, issue: 'held model is recommendable' }); }
// rendered labels: every recommendable model, EN + AR, versions list chips
let rendered = 0;
for (const lang of ['en', 'ar']) {
  const pr = Present.create(ds.U, E, I); pr.setLang(lang); const L = I.S[lang];
  for (const m of ds.U.models) {
    const cur = m.u ? E.currentTrims(m) : []; if (!cur.length) continue;
    const html = pr.versionsBlock({ id: m.id, fit: cur, all: cur, pick: cur[0] }, { terr: { ceil: Infinity } });
    const li = html.match(/<li[^>]*>.*?<\/li>/g) || []; rendered++;
    const multi = new Set(m.trims.map(t => t.year).filter(Boolean)).size > 1;
    li.forEach((h, i) => { const t = cur[i];
      const off = h.includes(L.official), mk = h.includes(L.market_price), my = t.year ? h.includes(L.my(t.year)) : false;
      if (off !== !!t.official || mk !== !t.official || (multi && t.year && !my) || (!multi && h.includes('chip tiny">' + (t.year ? L.my(t.year) : '§')))) F.labels.push({ lang, id: m.id, version: t.label, official: !!t.official, off, mk, multi, my }); });
    if (li.length !== cur.length) F.labels.push({ lang, id: m.id, issue: 'version count', li: li.length, cur: cur.length });
  }
}
const out = { dataset: ds.universe_version, p2_revision: S.revision, p2_accepted_in_p1: checked, rendered_model_lists: rendered, failures: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.length])), detail: F };
console.log(JSON.stringify(out, null, 1)); process.exit(Object.values(F).some(v => v.length) ? 1 : 0);
