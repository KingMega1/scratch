/* P1.2 data-contract adapters (see contracts/README.md). Not loaded by the app and not used by the engine yet.
   - Market status is consumed from a P2 dataset, never inferred here. Without an audited dataset every model reads
     'unverified' with source 'none', and the gate stays inactive (gateActive() is false).
   - Powertrain technology maps today's coarse trim tags onto ICE / HEV / PHEV / REEV / BEV, marking what the data
     cannot resolve instead of guessing.
   - Powertrain intent derives the approved Buyer Brief block from the current brief fields, reusing the driving
     pattern (usage) rather than asking again. */
(function (root) {
  'use strict';

  /* ---------- market status (owner: P2) ---------- */
  const STATUSES = ['official', 'grey', 'announced', 'discontinued', 'unverified'];
  // CEO decision 2026-09-28
  const MARKET_POLICY = {
    official: 'main',               // eligible
    grey: 'main_flagged',           // conditionally eligible, clearly flagged, only with sufficient evidence
    unverified: 'not_main',         // not eligible for main recommendations (does not mean unavailable)
    announced: 'worth_waiting',     // may appear separately as worth waiting for
    discontinued: 'excluded',       // excluded from normal new-car recommendations
  };

  // dataset: { audited: bool, as_of, models: { [model_id]: { status, confidence, as_of, evidence, grey_sufficient } } }
  function marketStatus(modelId, dataset) {
    const rec = dataset && dataset.models && dataset.models[modelId];
    if (!rec || !STATUSES.includes(rec.status)) return { status: 'unverified', source: 'none', confidence: null, as_of: null };
    return { status: rec.status, source: 'p2', confidence: rec.confidence ?? null, as_of: rec.as_of || null, grey_sufficient: !!rec.grey_sufficient };
  }
  // placement: 'main' | 'main_flagged' | 'not_main' | 'worth_waiting' | 'excluded'
  function marketPlacement(ms) {
    if (ms.status === 'grey' && !ms.grey_sufficient) return 'not_main';
    return MARKET_POLICY[ms.status];
  }
  // the gate may only act on an audited P2 dataset AND an explicit switch; placeholder data never gates
  function gateActive(dataset, enabled) { return !!(enabled && dataset && dataset.audited === true); }

  /* ---------- powertrain technology ---------- */
  const TECH = ['ICE', 'HEV', 'PHEV', 'REEV', 'BEV'];
  // today's data: pt in petrol | hybrid | ev, optional plugin flag. 'hybrid' without plugin cannot be split
  // into HEV / PHEV / REEV; a plugin hybrid can still be PHEV or REEV.
  function trimTech(t, m) {
    if (t.tech && TECH.includes(t.tech)) return { tech: t.tech, candidates: [t.tech], resolved: true };
    const pt = t.pt || (m && m.powertrains && m.powertrains.length === 1 ? m.powertrains[0] : null);
    if (pt === 'petrol') return { tech: 'ICE', candidates: ['ICE'], resolved: true };
    if (pt === 'ev') return { tech: 'BEV', candidates: ['BEV'], resolved: true };
    if (pt === 'hybrid') {
      const c = t.plugin ? ['PHEV', 'REEV'] : ['HEV', 'PHEV', 'REEV'];
      return { tech: null, candidates: c, resolved: false };
    }
    return { tech: null, candidates: TECH.slice(), resolved: false };
  }

  /* ---------- Buyer Brief: powertrain intent ---------- */
  const ELECTRIFIED = ['HEV', 'PHEV', 'REEV'];
  function powertrainIntent(b) {
    const out = { stance: 'open', excluded: [], preferred: [], concerns: [], home_charging: 'unknown', source: {} };
    if (b.pt === 'petrol') { out.stance = 'ice_only'; out.excluded = ELECTRIFIED.concat('BEV'); }
    else if (b.pt === 'no_ev') { out.stance = 'avoid_bev'; out.excluded = ['BEV']; }
    else if (b.pt === 'hybrid') { out.stance = 'prefer_electrified'; out.preferred = ELECTRIFIED.slice(); }
    else if (b.pt === 'ev') { out.stance = 'prefer_electrified'; out.preferred = ['BEV']; }
    for (const x of b.ptNo || []) {
      if (x === 'ev' && !out.excluded.includes('BEV')) out.excluded.push('BEV');
      if (x === 'hybrid') ELECTRIFIED.forEach(t => { if (!out.excluded.includes(t)) out.excluded.push(t); });
    }
    if (b.pt) out.source.stance = 'stated_or_asked';
    // driving pattern already asked or stated: reused, not asked again
    if (b.usage === 'long') { out.concerns.push('long_distance'); out.source.concerns = 'usage'; }
    if ((b.priorities || []).includes('economy')) { out.concerns.push('running_cost'); out.source.concerns = out.source.concerns ? 'usage+priorities' : 'priorities'; }
    return out;
  }
  // can a trim satisfy the intent's hard exclusions? true / false / null (technology unresolved)
  function techAllowed(tt, intent) {
    if (!intent.excluded.length) return true;
    const ok = tt.candidates.filter(c => !intent.excluded.includes(c));
    if (ok.length === tt.candidates.length) return true;
    if (!ok.length) return false;
    return null;
  }

  const api = { STATUSES, MARKET_POLICY, marketStatus, marketPlacement, gateActive, TECH, trimTech, powertrainIntent, techAllowed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIContracts = api;
})(typeof window !== 'undefined' ? window : globalThis);
