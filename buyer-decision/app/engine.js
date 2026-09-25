/* CarIndex buyer-decision engine v1 — deterministic, explainable, model-level.
   Reads only the universe view (data/universe.v1.*). No commercial inputs (Living Data Architecture §8.4).
   Every score component maps to a field in the view; nothing is imputed. */
(function (root) {
  'use strict';

  const ENGINE_VERSION = 'E1-2026-09-25';
  const STRETCH = 0.10;

  const PT_GROUP = { Petrol: 'petrol', Diesel: 'petrol', HEV: 'hybrid', PHEV: 'hybrid', EV: 'ev' };

  const BASE_WEIGHTS = { budget: 0.20, evidence: 0.25, space: 0.10, usage: 0.15, warranty: 0.10, markup: 0.10, completeness: 0.05 };
  const PRIORITY_BOOST = 0.35;
  // priority id -> score component it boosts
  const PRIORITIES = { pocket: 'headroom', space: 'space', proof: 'evidence', warranty: 'warranty', markup: 'markup' };

  const USAGE_FIT = {
    city:  { ev: 1.0, hybrid: 0.9, petrol: 0.6 },
    mixed: { ev: 0.7, hybrid: 1.0, petrol: 0.75 },
    long:  { ev: 0.3, hybrid: 1.0, petrol: 0.9 },
  };

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function limitOf(a) { return Math.round(a.budget * (a.stretch ? 1 + STRETCH : 1)); }

  function seatsAtLeast7(m) { return m.seats.some(s => /(^|-)([7-9])$/.test(s)); }

  function modelGroups(m) { return [...new Set(m.powertrains.map(p => PT_GROUP[p]).filter(Boolean))]; }

  function trimGroup(t, m) {
    if (t.powertrain) return PT_GROUP[t.powertrain] || null;
    const g = modelGroups(m);
    return g.length === 1 ? g[0] : null;
  }

  /* Hard filters. Returns {ok, trims, reason}. */
  function eligibility(m, a) {
    const limit = limitOf(a);
    let trims = m.trims.filter(t => t.official_price <= limit);
    if (!trims.length) return { ok: false, reason: 'over_budget' };
    if (a.powertrain && a.powertrain !== 'any') {
      trims = trims.filter(t => trimGroup(t, m) === a.powertrain);
      if (!trims.length) return { ok: false, reason: 'powertrain' };
    }
    if (a.charging === 'no') {
      trims = trims.filter(t => trimGroup(t, m) !== 'ev');
      if (!trims.length) return { ok: false, reason: 'no_charging' };
    }
    if (a.who === 'seven' && !seatsAtLeast7(m)) return { ok: false, reason: m.seats.length ? 'seats' : 'seats_unknown' };
    if (a.body && a.body !== 'any') {
      const b = (m.body_type || '').toLowerCase();
      const want = { suv: ['suv', 'crossover', 'mpv', 'minivans'], sedan: ['sedan'], hatch: ['hatchback', 'hatchback/wagon'] }[a.body] || [];
      if (!want.includes(b)) return { ok: false, reason: 'body' };
    }
    return { ok: true, trims };
  }

  function bestTrim(trims) {
    // most expensive trim within the limit, preferring cross-source-verified prices
    const v = trims.filter(t => t.status === 'verified');
    const pool = v.length ? v : trims;
    return pool.reduce((x, y) => (y.official_price > x.official_price ? y : x));
  }

  function components(m, a, trims) {
    const limit = limitOf(a);
    const bt = bestTrim(trims);
    const entry = Math.min(...trims.map(t => t.official_price));
    const fams = m.source_families.length;
    const evidence = clamp(0.5 * clamp((fams - 1) / 3) + (bt.status === 'verified' ? 0.3 : 0) + (m.has_official_source ? 0.2 : 0) - 0.1 * m.conflicts.length);
    const body = (m.body_type || '').toLowerCase();
    let space = { suv: 1, crossover: 1, mpv: 1, minivans: 1, sedan: 0.55, hatchback: 0.3, 'hatchback/wagon': 0.4 }[body] ?? 0.4;
    if (seatsAtLeast7(m)) space = clamp(space + 0.2);
    const groups = [...new Set(trims.map(t => trimGroup(t, m)).filter(Boolean))];
    const u = USAGE_FIT[a.usage || 'mixed'];
    const usage = groups.length ? Math.max(...groups.map(g => u[g] ?? 0.5)) : 0.5;
    const warranty = m.warranty_years_max ? clamp(m.warranty_years_max / 7) : 0.3;
    const markup = m.market_premium_pct_median == null ? 0.4 : clamp(1 - Math.max(0, m.market_premium_pct_median) / 20);
    const completeness = clamp(1 - m.gaps.length / 11);
    return {
      budget: clamp(bt.official_price / limit),        // uses the budget without exceeding it
      headroom: clamp(1 - entry / limit),              // money left over at the entry trim
      evidence, space, usage, warranty, markup, completeness,
      _bestTrim: bt, _entry: entry, _groups: groups,
    };
  }

  function weightsFor(a) {
    const w = { ...BASE_WEIGHTS, headroom: 0 };
    if (a.who === 'family') w.space += 0.15;
    if (a.who === 'seven') w.space += 0.15;
    (a.priorities || []).forEach(p => { const c = PRIORITIES[p]; if (c) w[c] = (w[c] || 0) + PRIORITY_BOOST; });
    const sum = Object.values(w).reduce((x, y) => x + y, 0);
    Object.keys(w).forEach(k => { w[k] /= sum; });
    return w;
  }

  function score(c, w) {
    return Object.keys(w).reduce((s, k) => s + w[k] * (c[k] || 0), 0);
  }

  const fmt = n => n.toLocaleString('en-US');
  const name = m => `${m.brand} ${m.model}`;
  const ptLabel = g => ({ petrol: 'petrol', hybrid: 'hybrid', ev: 'electric' }[g] || 'unknown powertrain');

  function whyFits(r, a) {
    const { m, c } = r; const bt = c._bestTrim; const limit = limitOf(a);
    const out = [];
    out.push({ k: 'budget', text: `${r.trimsInBudget > 1 || m.trims.length > 1 ? `The ${bt.label} trim` : 'It'} is listed at EGP ${fmt(bt.official_price)}, within your EGP ${fmt(limit)} limit${r.trimsInBudget > 1 ? ` (${r.trimsInBudget} trims fit)` : ''}.` });
    if (bt.status === 'verified') out.push({ k: 'evidence', text: `${bt.agreeing_sources.length} independent sources list the same price${m.has_official_source ? ', including the official distributor' : ''}.` });
    if (a.who === 'seven' && seatsAtLeast7(m)) out.push({ k: 'space', text: `7 seats, per ${m.source_families.length > 1 ? 'our sources' : 'one source'}.` });
    else if (c.space >= 0.9 && (a.who === 'family' || (a.priorities || []).includes('space'))) out.push({ k: 'space', text: `${m.body_type} body, the roomiest shape in this budget.` });
    const bestG = c._groups.slice().sort((x, y) => (USAGE_FIT[a.usage || 'mixed'][y] || 0) - (USAGE_FIT[a.usage || 'mixed'][x] || 0))[0];
    if (bestG && c.usage >= 0.9) out.push({ k: 'usage', text: `${bestG === 'ev' ? 'An' : 'A'} ${ptLabel(bestG)} option suits ${({ city: 'mostly city driving', mixed: 'mixed city and highway driving', long: 'long trips' })[a.usage || 'mixed']}.` });
    if (m.warranty_years_max >= 5) out.push({ k: 'warranty', text: `Warranty listed as ${m.warranty[0]}.` });
    if (m.market_premium_pct_median != null && m.market_premium_pct_median <= 3) out.push({ k: 'markup', text: `Dealer asking prices are close to official (median ${m.market_premium_pct_median}% above, ${m.market_premium_n} trim${m.market_premium_n > 1 ? 's' : ''}).` });
    if ((a.priorities || []).includes('pocket') && c.headroom > 0.05) out.push({ k: 'headroom', text: `Entry trim leaves about EGP ${fmt(limit - c._entry)} of your budget unspent.` });
    return out.slice(0, 4);
  }

  function compromises(r, a) {
    const { m, c } = r; const bt = c._bestTrim; const limit = limitOf(a);
    const out = [];
    if (bt.official_price > a.budget) out.push(`The fitting trim is above your EGP ${fmt(a.budget)} target — it uses your ${Math.round(STRETCH * 100)}% stretch.`);
    else if (c.budget > 0.97) out.push('It uses almost all of your budget; registration and insurance are extra.');
    if (bt.status !== 'verified') out.push(`Only ${bt.agreeing_sources.join(', ')} lists the ${bt.label} price; not confirmed by a second source.`);
    if (m.market_premium_pct_median != null && m.market_premium_pct_median > 3) out.push(`Dealers ask a median ${m.market_premium_pct_median}% above the official price (${m.market_premium_n} trim${m.market_premium_n > 1 ? 's' : ''}, ContactCars market prices).`);
    if (m.conflicts.length) out.push(`Sources disagree on ${m.conflicts.length} point${m.conflicts.length > 1 ? 's' : ''} for this model (see evidence).`);
    if (a.usage === 'long' && c._groups.includes('ev') && c._groups.length === 1) out.push('Driving range is not in our data — check it before a long-trip decision.');
    if (!m.seats.length) out.push('Seat count is not in our data.');
    if (!m.powertrains.length) out.push('Powertrain is not stated in our sources.');
    if (c.space < 0.5 && (a.who === 'family' || a.who === 'seven')) out.push(`${m.body_type} body — less cargo space than an SUV.`);
    return out.slice(0, 4);
  }

  function uncertainty(r, universe) {
    const { m } = r;
    const gapLabels = { seats: 'seats', warranty: 'warranty', horsepower: 'power', engine_capacity: 'engine size', transmission: 'gearbox', fuel_consumption: 'fuel use', trunk_capacity: 'boot space', length: 'dimensions', electric_range: 'electric range', powertrain: 'powertrain' };
    const gaps = m.gaps.filter(g => g !== 'electric_range' || m.powertrains.includes('EV')).map(g => gapLabels[g] || g);
    return {
      snapshot: universe.meta.snapshot,
      gaps,
      notInData: universe.meta.not_in_data,
      conflicts: m.conflicts,
      priceDates: m.price_dates,
    };
  }

  const ALT_ROLES = [
    { role: 'cheaper', pick: (rs, h) => rs.filter(r => r.c._entry <= h.c._bestTrim.official_price * 0.92 && r.score >= h.score * 0.75).sort((x, y) => x.c._entry - y.c._entry)[0],
      why: (r, h, a) => `Choose this if you'd rather keep more money: entry price EGP ${fmt(r.c._entry)}, about EGP ${fmt(h.c._bestTrim.official_price - r.c._entry)} less than ${name(h.m)} as recommended.` },
    { role: 'powertrain', pick: (rs, h) => rs.filter(r => r.c._groups.length && !r.c._groups.some(g => h.c._groups.includes(g))).sort((x, y) => y.score - x.score)[0],
      why: (r) => `Choose this if you want ${r.c._groups.map(ptLabel).join(' / ')} instead.` },
    { role: 'space', pick: (rs, h) => rs.filter(r => r.c.space > h.c.space + 0.1).sort((x, y) => y.score - x.score)[0],
      why: (r) => `Choose this if space matters more: ${r.m.body_type}${seatsAtLeast7(r.m) ? ', 7 seats' : ''}.` },
    { role: 'evidence', pick: (rs, h) => rs.filter(r => r.c.evidence > h.c.evidence + 0.1).sort((x, y) => y.c.evidence - x.c.evidence)[0],
      why: (r) => `Choose this if you want the best-confirmed price: ${r.c._bestTrim.agreeing_sources.length} sources agree${r.m.has_official_source ? ', including the official distributor' : ''}.` },
    { role: 'runner_up', pick: (rs) => rs[0],
      why: () => 'Closest overall match after the recommendation.' },
  ];

  function recommend(universe, a) {
    const limit = limitOf(a);
    const excluded = {};
    const ranked = [];
    for (const m of universe.models) {
      const e = eligibility(m, a);
      if (!e.ok) { excluded[e.reason] = (excluded[e.reason] || 0) + 1; continue; }
      const c = components(m, a, e.trims);
      ranked.push({ m, c, trimsInBudget: e.trims.length, score: 0 });
    }
    const w = weightsFor(a);
    ranked.forEach(r => { r.score = score(r.c, w); });
    ranked.sort((x, y) => y.score - x.score || y.c.evidence - x.c.evidence || x.c._entry - y.c._entry);
    // user promoted an alternative: keep scores, move it to the hero slot
    const pinned = a.pin ? ranked.findIndex(r => r.m.id === a.pin) : -1;
    if (pinned > 0) ranked.unshift(ranked.splice(pinned, 1)[0]);

    const base = { engine_version: ENGINE_VERSION, universe_version: universe.meta.universe_version, limit, weights: w, eligible: ranked.length, excluded };
    if (!ranked.length) return { ...base, hero: null, alternatives: [], relax: relaxOptions(universe, a) };

    const hero = ranked[0];
    const rest = ranked.slice(1);
    const alts = [];
    for (const role of ALT_ROLES) {
      if (alts.length >= 3) break;
      const pool = rest.filter(r => !alts.some(x => x.r === r));
      const pick = role.pick(pool, hero);
      if (pick) alts.push({ r: pick, role: role.role, why: role.why(pick, hero, a) });
    }

    // fewer than 2 real alternatives: offer the closest models that miss ONLY on budget (max +15%)
    if (alts.length < 2) {
      const near = universe.models
        .filter(m => m.id !== hero.m.id && !ranked.some(r => r.m.id === m.id))
        .map(m => ({ m, e: eligibility(m, { ...a, budget: Math.round(limit * 1.15), stretch: false }) }))
        .filter(x => x.e.ok)
        .map(x => ({ m: x.m, c: components(x.m, { ...a, budget: Math.round(limit * 1.15), stretch: false }, x.e.trims), trimsInBudget: 0 }))
        .map(r => ({ ...r, score: score(r.c, w) }))
        .sort((x, y) => x.c._entry - y.c._entry);
      for (const r of near) {
        if (alts.length >= 2) break;
        alts.push({ r, role: 'stretch', why: `Choose this if you can stretch to EGP ${fmt(r.c._entry)} (EGP ${fmt(r.c._entry - limit)} over your limit).` });
      }
    }

    const pack = r => ({
      id: r.m.id, model: r.m, score: +r.score.toFixed(4), components: Object.fromEntries(Object.entries(r.c).filter(([k]) => !k.startsWith('_'))),
      bestTrim: r.c._bestTrim, entry: r.c._entry, groups: r.c._groups, trimsInBudget: r.trimsInBudget,
    });
    return {
      ...base,
      hero: { ...pack(hero), why: whyFits(hero, a), compromises: compromises(hero, a), uncertainty: uncertainty(hero, universe) },
      alternatives: alts.map(x => ({ ...pack(x.r), role: x.role, whyInstead: x.why, compromises: compromises(x.r, a) })),
      ranking: ranked.map(r => ({ id: r.m.id, score: +r.score.toFixed(4) })),
    };
  }

  function countEligible(universe, a) {
    return universe.models.filter(m => eligibility(m, a).ok).length;
  }

  function relaxOptions(universe, a) {
    const tries = [
      { key: 'stretch', patch: { stretch: true }, label: `Stretch the budget ${Math.round(STRETCH * 100)}%` },
      { key: 'powertrain', patch: { powertrain: 'any' }, label: 'Any powertrain' },
      { key: 'body', patch: { body: 'any' }, label: 'Any body style' },
      { key: 'charging', patch: { charging: 'unsure' }, label: 'Include electric cars' },
    ];
    return tries.map(t => ({ ...t, count: countEligible(universe, { ...a, ...t.patch }) })).filter(t => t.count > 0 && JSON.stringify({ ...a, ...t.patch }) !== JSON.stringify(a));
  }

  const api = { recommend, countEligible, eligibility, limitOf, ENGINE_VERSION, STRETCH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
