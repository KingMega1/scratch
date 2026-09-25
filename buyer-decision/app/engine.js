/* CarIndex buyer-decision engine v2 — deterministic, explainable, model-level. Reads the P2 view only.
   Two separate outputs:
   1) RANK = fit to the buyer's answers. Source coverage never enters the score, and a missing field
      scores the universe median (neutral), so a brand is not ranked up or down for how well we cover it.
   2) CONFIDENCE = how sure we are of the facts behind the pick. It changes the WORDING
      (clear / lean / check), never the order. */
(function (root) {
  'use strict';

  const ENGINE_VERSION = 'E2-2026-09-25';
  const STRETCH = 0.10;
  const NEAR_BUDGET = 0.15;
  const CLEAR_MARGIN = 0.03;

  const BASE_WEIGHTS = { budget: 0.45, usage: 0.35, warranty: 0.10, popular: 0, headroom: 0 };
  const PRIORITY_BOOST = 0.5;
  const PRIORITIES = { pocket: 'headroom', popular: 'popular', warranty: 'warranty' };
  const USAGE_FIT = {
    city: { ev: 1.0, hybrid: 0.9, petrol: 0.6 },
    mixed: { ev: 0.7, hybrid: 1.0, petrol: 0.75 },
    long: { ev: 0.35, hybrid: 1.0, petrol: 0.9 },
  };
  const STATUS_LEVEL = { AGREED: 3, NEAR_AGREEMENT: 3, SINGLE_SOURCE: 2, CONFLICT: 1 };
  const LEVEL = ['', 'thin', 'fair', 'strong'];

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  const limitOf = a => Math.round(a.budget * (a.stretch ? 1 + STRETCH : 1));
  const seatValues = m => (m.specs.seats ? m.specs.seats.values.map(v => String(v.value)) : []);
  const hasSeven = m => seatValues(m).some(s => /(^|-)([7-9])$/.test(s));

  function trimGroup(t, m, pref) {
    if (t.powertrain) return t.powertrain;
    // label and model are silent: allow it for a petrol request only if the model is sold as petrol at all
    if (pref === 'petrol' && m.powertrains.includes('petrol')) return 'petrol';
    return null;
  }

  function eligibility(m, a) {
    const limit = limitOf(a);
    let trims = m.trims.filter(t => t.max <= limit);
    if (!trims.length) return { ok: false, reason: 'over_budget' };
    if (a.seats === 'seven' && !hasSeven(m)) return { ok: false, reason: seatValues(m).length ? 'seats' : 'seats_unknown' };
    if (a.charging === 'no') {
      trims = trims.filter(t => t.powertrain !== 'ev');
      if (!trims.length) return { ok: false, reason: 'no_charging' };
    }
    if (a.powertrain && a.powertrain !== 'any') {
      trims = trims.filter(t => trimGroup(t, m, a.powertrain) === a.powertrain);
      if (!trims.length) return { ok: false, reason: 'powertrain' };
    }
    return { ok: true, trims };
  }

  function makeContext(universe) {
    const wy = universe.models.map(m => m.warranty_years_max).filter(Boolean);
    const regs = universe.models.map(m => m.registration.count || 0);
    return { warrantyMedian: median(wy) || 5, regMax: Math.max(...regs, 1) };
  }

  function components(m, a, trims, ctx) {
    const limit = limitOf(a);
    // most car within the limit — or, when the buyer wants to keep money, the entry version
    const pocket = (a.priorities || []).includes('pocket');
    const pick = trims.reduce((x, y) => (pocket ? (y.max < x.max ? y : x) : (y.max > x.max ? y : x)));
    const entry = Math.min(...trims.map(t => t.max));
    const pref = a.powertrain && a.powertrain !== 'any' ? a.powertrain : null;
    const u = USAGE_FIT[a.usage || 'mixed'];
    const g = trimGroup(pick, m, pref);
    let usage = g ? u[g] : median(m.powertrains.map(p => u[p]).filter(x => x != null)) ?? 0.7;
    if (g === 'ev' && a.charging === 'unsure') usage *= 0.8;
    const wy = m.warranty_years_max || ctx.warrantyMedian;
    return {
      budget: clamp(pick.max / limit),
      headroom: clamp(1 - entry / limit),
      usage,
      warranty: clamp(wy / 7),
      popular: clamp(Math.log1p(m.registration.count || 0) / Math.log1p(ctx.regMax)),
      _pick: pick, _entry: entry, _group: g,
    };
  }

  function weightsFor(a) {
    const w = { ...BASE_WEIGHTS };
    (a.priorities || []).forEach(p => { const c = PRIORITIES[p]; if (c) w[c] += PRIORITY_BOOST; });
    const sum = Object.values(w).reduce((x, y) => x + y, 0);
    Object.keys(w).forEach(k => { w[k] /= sum; });
    return w;
  }

  const score = (c, w) => Object.keys(w).reduce((s, k) => s + w[k] * c[k], 0);

  /* ---------- confidence (communication only) ---------- */
  function confidence(r, a) {
    const t = r.c._pick, m = r.m, notes = [];
    let lvl = STATUS_LEVEL[t.status] || 1;
    if (t.status === 'AGREED' || t.status === 'NEAR_AGREEMENT') notes.push({ code: 'conf_agreed', p: { n: t.sources.length } });
    if (t.status === 'SINGLE_SOURCE') notes.push({ code: 'conf_single', p: { source: t.sources[0] } });
    if (t.status === 'CONFLICT') notes.push({ code: 'conf_conflict', p: { min: t.min, max: t.max } });
    if (m.gaps.includes('SINGLE_SOURCE_MODEL') && lvl > 2) { lvl = 2; }
    if (a.powertrain && a.powertrain !== 'any' && t.powertrain_basis === 'unstated') { lvl = Math.min(lvl, 2); notes.push({ code: 'conf_pt_unstated', p: {} }); }
    return { level: LEVEL[lvl], rank: lvl, notes };
  }

  /* ---------- explanations (codes + params; the UI renders them in EN/AR) ---------- */
  function why(r, a) {
    const { m, c } = r, t = c._pick, out = [];
    out.push({ code: 'why_budget', p: { trim: t.label, price: t.max, limit: limitOf(a), n: r.trimsInBudget } });
    if (a.seats === 'seven') out.push({ code: 'why_seven', p: {} });
    if (c._group && c.usage >= 0.9) out.push({ code: 'why_usage', p: { group: c._group, usage: a.usage || 'mixed', plugin: t.plugin } });
    if ((a.priorities || []).includes('pocket') && c.headroom > 0.05) out.push({ code: 'why_headroom', p: { amount: limitOf(a) - c._entry, entry: c._entry } });
    if ((a.priorities || []).includes('popular') && m.registration.rank) out.push({ code: 'why_popular', p: { count: m.registration.count, rank: m.registration.rank, of: m.registration.of } });
    if (m.warranty_years_max >= 5) out.push({ code: 'why_warranty', p: { text: m.specs.warranty.values[0].value } });
    return out.slice(0, 4);
  }

  function compromises(r, a) {
    const { m, c } = r, t = c._pick, out = [];
    if (t.max > a.budget) out.push({ code: 'cmp_over_target', p: { budget: a.budget, over: t.max - a.budget } });
    else if (c.budget > 0.97) out.push({ code: 'cmp_full_budget', p: {} });
    if (a.usage === 'long' && c._group === 'ev') out.push({ code: 'cmp_ev_long', p: {} });
    if (a.usage === 'city' && c._group === 'petrol') out.push({ code: 'cmp_petrol_city', p: {} });
    if (c._group === 'ev' && a.charging === 'unsure') out.push({ code: 'cmp_ev_charging', p: {} });
    if (!m.warranty_years_max) out.push({ code: 'cmp_no_warranty', p: {} });
    if (t.powertrain_basis === 'unstated') out.push({ code: 'cmp_pt_unstated', p: { trim: t.label } });
    return out.slice(0, 3);
  }

  const ALT_ROLES = [
    { role: 'cheaper', pick: (rs, h) => rs.filter(r => r.c._entry <= h.c._pick.max * 0.92).sort((x, y) => y.score - x.score)[0] },
    { role: 'powertrain', pick: (rs, h) => rs.filter(r => r.c._group && h.c._group && r.c._group !== h.c._group).sort((x, y) => y.score - x.score)[0] },
    { role: 'popular', pick: (rs, h) => rs.filter(r => (r.m.registration.count || 0) > (h.m.registration.count || 0) * 1.5).sort((x, y) => y.m.registration.count - x.m.registration.count)[0] },
    { role: 'runner_up', pick: rs => rs[0] },
  ];

  function vsPick(r, h) {
    const d = [];
    const dp = r.c._pick.max - h.c._pick.max;
    if (Math.abs(dp) >= 10000) d.push({ code: dp < 0 ? 'vs_cheaper' : 'vs_dearer', p: { amount: Math.abs(dp) } });
    if (r.c._group && h.c._group && r.c._group !== h.c._group) d.push({ code: 'vs_powertrain', p: { group: r.c._group } });
    const rc = r.m.registration.count || 0, hc = h.m.registration.count || 0;
    if (rc > hc * 1.5) d.push({ code: 'vs_more_popular', p: { count: rc } });
    if ((r.m.warranty_years_max || 0) > (h.m.warranty_years_max || 0) && h.m.warranty_years_max) d.push({ code: 'vs_warranty', p: { years: r.m.warranty_years_max } });
    return d.slice(0, 2);
  }

  function recommend(universe, a) {
    const ctx = makeContext(universe);
    const limit = limitOf(a);
    const excluded = {}, ranked = [];
    for (const m of universe.models) {
      const e = eligibility(m, a);
      if (!e.ok) { excluded[e.reason] = (excluded[e.reason] || 0) + 1; continue; }
      ranked.push({ m, c: components(m, a, e.trims, ctx), trimsInBudget: e.trims.length });
    }
    const w = weightsFor(a);
    ranked.forEach(r => { r.score = score(r.c, w); });
    // tie-break is neutral: cheaper entry, then id — never coverage or brand
    ranked.sort((x, y) => y.score - x.score || x.c._entry - y.c._entry || (x.m.id < y.m.id ? -1 : 1));
    const topScore = ranked.length ? ranked[0].score : 0;
    const margin = ranked.length > 1 ? (ranked[0].score - ranked[1].score) / ranked[0].score : 1;
    const pinned = a.pin ? ranked.findIndex(r => r.m.id === a.pin) : -1;
    if (pinned > 0) ranked.unshift(ranked.splice(pinned, 1)[0]);

    const base = { engine_version: ENGINE_VERSION, limit, weights: w, eligible: ranked.length, excluded, margin: +margin.toFixed(4) };
    if (!ranked.length) return { ...base, hero: null, alternatives: [], relax: relaxOptions(universe, a) };

    const hero = ranked[0], rest = ranked.slice(1), alts = [];
    for (const role of ALT_ROLES) {
      if (alts.length >= 3) break;
      const pick = role.pick(rest.filter(r => !alts.some(x => x.r === r)), hero);
      if (pick) alts.push({ r: pick, role: role.role });
    }
    if (alts.length < 2) {
      const nearA = { ...a, budget: Math.round(limit * (1 + NEAR_BUDGET)), stretch: false };
      universe.models.filter(m => !ranked.some(r => r.m.id === m.id))
        .map(m => ({ m, e: eligibility(m, nearA) })).filter(x => x.e.ok)
        .map(x => ({ m: x.m, c: components(x.m, nearA, x.e.trims, ctx), trimsInBudget: 0 }))
        .sort((x, y) => x.c._entry - y.c._entry)
        .slice(0, 2 - alts.length)
        .forEach(r => { r.c._pick = r.m.trims.filter(t => t.max === r.c._entry)[0]; r.score = score(r.c, w); alts.push({ r, role: 'stretch' }); });
    }

    const conf = confidence(hero, a);
    const mode = pinned > 0 ? 'chosen' : conf.rank === 1 ? 'check' : (conf.rank === 3 && margin >= CLEAR_MARGIN) ? 'clear' : 'lean';
    const pack = r => ({
      id: r.m.id, model: r.m, score: +r.score.toFixed(4), pick: r.c._pick, entry: r.c._entry, group: r.c._group,
      entryTrim: r.m.trims.find(t => t.max === r.c._entry),
      trimsInBudget: r.trimsInBudget, compromises: compromises(r, a), confidence: confidence(r, a),
    });
    return {
      ...base, mode, topScore,
      hero: { ...pack(hero), why: why(hero, a), closeCall: margin < CLEAR_MARGIN && ranked.length > 1 && pinned <= 0 ? ranked[1].m.id : null },
      alternatives: alts.map(x => ({ ...pack(x.r), role: x.role, vs: vsPick(x.r, hero) })),
      ranking: ranked.map(r => ({ id: r.m.id, score: +r.score.toFixed(4) })),
    };
  }

  function countEligible(universe, a) { return universe.models.filter(m => eligibility(m, a).ok).length; }

  function relaxOptions(universe, a) {
    return [
      { key: 'stretch', patch: { stretch: true } },
      { key: 'powertrain', patch: { powertrain: 'any' } },
      { key: 'charging', patch: { charging: 'unsure' } },
      { key: 'seats', patch: { seats: 'five' } },
    ].filter(t => Object.keys(t.patch).some(k => a[k] !== t.patch[k]))
      .map(t => ({ ...t, count: countEligible(universe, { ...a, ...t.patch }) })).filter(t => t.count > 0);
  }

  const api = { recommend, countEligible, eligibility, limitOf, hasSeven, ENGINE_VERSION, STRETCH, NEAR_BUDGET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
