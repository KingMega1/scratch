/* CarIndex recommendation engine v4 (P1.1 integrity): Eligibility -> Fit -> Challenge. Model-first.
   1. Eligibility: every confirmed hard constraint is checked per model as eligible / ineligible / unknown.
      Only "eligible" models can be recommended. Unknown critical data never qualifies a model.
   2. Fit: eligible models are ranked on the confirmed brief. Registrations/popularity are not in the
      default score (only when the buyer asks for a popular choice). Unknown soft values score the median.
   3. Challenge: named cars outside the eligible set (aspiration, shortlist over budget) are explained
      separately and are never returned as recommendations. A final guard drops anything ineligible. */
(function (root) {
  'use strict';
  const ENGINE_VERSION = 'E6-2026-09-28';
  const STEP = 100000;

  /* ---------- model facts ---------- */
  const SEG = {
    'SUV-B': ['suv', 2], 'SUV-C': ['suv', 3], 'SUV-D': ['suv', 4], 'SUV-E': ['suv', 5],
    'Luxury SUV-2': ['suv', 3, 1], 'Luxury SUV-3': ['suv', 4, 1], 'Luxury SUV-4': ['suv', 5, 1], 'Luxury SUV-5': ['suv', 6, 1],
    'Car-A': ['sedan', 1], 'Car-B': ['sedan', 2], 'Car-C': ['sedan', 3], 'Car-D': ['sedan', 4],
    'Luxury Car-2': ['sedan', 3, 1], 'Luxury Car-3': ['sedan', 4, 1], 'Luxury Car-4': ['sedan', 5, 1], 'Luxury Car-5': ['sedan', 6, 1],
    'Car HB-A': ['hatch', 1], 'Car HB-B': ['hatch', 2], 'Car HB-C': ['hatch', 3], 'Luxury HB': ['hatch', 3, 1],
    'MPV-B': ['mpv', 3], 'MPV-C': ['mpv', 4], 'Luxury MPV': ['mpv', 5, 1],
  };
  const size = m => (SEG[m.segment] || [])[1] || null;
  const premium = m => !!(SEG[m.segment] || [])[2];
  const sizeKey = m => (SEG[m.segment] ? m.segment : null);
  const seven = m => !!(m.seats && m.seats.some(s => s >= 7));
  const regLast12 = m => (m.reg && m.reg.last12) || 0;

  // latest model-year trims only (older-year leftovers are not "the car you buy new")
  function currentTrims(m) {
    const y = Math.max(...m.trims.map(t => t.year || 0));
    let tr = m.trims.filter(t => (t.year || 0) === y && t.min > 0);
    // source noise: "Unspecified" rows, and the same version spelled twice ("Matt Color" / "Matt Colour")
    const named = tr.filter(t => !/^(unspecified|n\/a|-)?$/i.test((t.label || '').trim()));
    if (named.length) tr = named;
    const key = t => `${t.min}|${(t.label || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)}`;
    const seen = new Set();
    return tr.filter(t => (seen.has(key(t)) ? false : seen.add(key(t))));
  }
  // a version's powertrain; when the source doesn't say and the model has only one kind, it is that kind
  const trimPt = (t, m) => t.pt || (m && m.powertrains && m.powertrains.length === 1 ? m.powertrains[0] : null);
  // hard powertrain exclusions from the brief: 'petrol' = petrol only; 'no_ev' = no fully electric; ptNo = explicit "no X"
  function ptExcluded(b) {
    const x = new Set(b.ptNo || []);
    if (b.pt === 'no_ev') x.add('ev');
    if (b.pt === 'petrol') { x.add('ev'); x.add('hybrid'); }
    return x;
  }
  // true / false / null (unknown)
  function ptOk(t, b, m) {
    const x = ptExcluded(b);
    if (!x.size) return true;
    const pt = trimPt(t, m);
    if (!pt) return null;
    return !x.has(pt);
  }

  /* ---------- budget territory ---------- */
  function territory(b) {
    const B = b.budget;
    const mode = b.budgetMode || 'around';
    const ceil = mode === 'max' ? (b.stretch ? B * 1.1 : B) : B * 1.1;
    // below this a car is presented as a "spend less" option, not a main recommendation (presentation only;
    // scoring is continuous, so 1.59M and 1.61M on a 2M budget are treated almost identically)
    const floor = b.budgetMin ? b.budgetMin * 0.95 : B * 0.7;
    return { budget: B, ceil: Math.round(ceil), floor: Math.round(floor), mode };
  }

  /* ---------- Layer 1: eligibility ---------- */
  // { status: 'eligible' | 'ineligible' | 'unknown', reason }
  function eligibility(m, b, terr) {
    const no = reason => ({ status: 'ineligible', reason });
    const unk = reason => ({ status: 'unknown', reason });
    if (!m.u) return no('not_on_sale');
    if (!m.body) return unk('body');
    if (b.body && b.body.length && !b.body.includes(m.body)) return no('body');
    if (b.notBody && b.notBody.includes(m.body)) return no('body');
    if (b.seats === 7) { if (!m.seats || !m.seats.length) return unk('seats'); if (!seven(m)) return no('seats'); }
    // four-wheel drive: only a confirmed AWD/4WD version qualifies (drivetrain is known for few models)
    if (b.drive4 === true) { if (m.awd == null) return unk('drive'); if (!m.awd) return no('drive'); }
    if (b.chinese === 'exclude') { if (m.chinese == null) return unk('chinese'); if (m.chinese) return no('chinese'); }
    if (b.brandsOnly && b.brandsOnly.length && !b.brandsOnly.includes(m.brand_id)) return no('brand_only');
    if (b.brandsExclude && b.brandsExclude.includes(m.brand_id)) return no('brand');
    if (b.avoid && b.avoid.includes(m.id)) return no('brand');
    const tr = currentTrims(m);
    if (!tr.length) return unk('price');
    const oks = tr.map(t => ptOk(t, b, m));
    const okTr = tr.filter((t, i) => oks[i] === true);
    if (!okTr.length) return oks.some(o => o === null) ? unk('powertrain') : no('powertrain');
    if (Math.min(...okTr.map(t => t.min)) > terr.ceil) return no('budget');
    return { status: 'eligible' };
  }
  const blocker = (m, b, terr) => { const e = eligibility(m, b, terr); return e.status === 'eligible' ? null : e.reason; };

  // how well one price matches the budget intention: full score for 90–100% of budget (target and maximum alike;
  // CEO 2026-09-28, from the budget sweep), a gentle slope below it, a steeper one into the +10% stretch. No cliffs.
  // Above-budget prices only matter where stretch is earned (see earnedStretch in recommend).
  function priceFit(p, terr) {
    const B = terr.budget, lo = 0.9 * B;
    if (p > terr.ceil) return -1;
    if (p > B) return 1 - (p - B) / B * 2;          // +10% stretch -> 0.8
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / B * 0.5);     // 80% of budget -> 0.95, 70% -> 0.90
  }
  function versions(m, b, terr) {
    const tr = currentTrims(m).filter(t => ptOk(t, b, m) === true);
    const fit = tr.filter(t => t.min <= terr.ceil).sort((x, y) => x.min - y.min);
    // the version the budget points at: best price fit (ties: the better-equipped, i.e. dearer, one)
    // a model with versions within budget is shown with those only; above-budget versions stand only for models
    // that have nothing within budget, and then only if that stretch is earned
    const inB = fit.filter(t => t.min <= terr.budget), show = inB.length ? inB : fit;
    const pick = show.slice().sort((x, y) => priceFit(y.min, terr) - priceFit(x.min, terr) || y.min - x.min)[0];
    return { all: tr.sort((x, y) => x.min - y.min), fit: show, pick, entry: show[0] };
  }

  /* ---------- scoring ---------- */
  const median = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const norm01 = (v, lo, hi) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  function features(m, b, terr) {
    const v = versions(m, b, terr);
    const fitPts = [...new Set(v.fit.map(t => trimPt(t, m)).filter(Boolean))];
    return {
      m, v,
      price: v.pick.min,
      entry: v.entry.min,
      size: size(m), kind: m.body, premium: premium(m),
      hp: m.hp && m.hp.length ? Math.max(...m.hp) : null,
      warranty: m.warranty_years || null,
      seven: seven(m),
      hybrid: fitPts.includes('hybrid'), ev: fitPts.length > 0 && fitPts.every(p => p === 'ev'), anyEv: fitPts.includes('ev'),
      petrolOnly: fitPts.length > 0 && fitPts.every(p => p === 'petrol'),
      pop: Math.log10(1 + regLast12(m)),
    };
  }

  function refSize(b, byId) {
    const refs = (b.reference || []).concat(b.attraction === 'size' ? b.aspiration || [] : []).map(id => byId[id]).filter(Boolean);
    const s = refs.map(size).filter(Boolean);
    return s.length ? { size: s.reduce((a, c) => a + c, 0) / s.length, kind: refs[0].body, ids: refs.map(r => r.id) } : null;
  }

  // Fit factors come only from the confirmed brief. Each part is a number in [0,1] or null (unknown).
  // Factors without enough evidence across the candidates are dropped (see rankFit); unknowns are then
  // filled with the mean of the known values, so missing data neither rewards nor punishes a car.
  // Not used for ranking (insufficient or unverified evidence): horsepower, warranty, reliability, resale, safety.
  const SIZE_TARGET = { small: 2, medium: 3, large: 4.5 };
  function score(F, b, ctx) {
    const { terr, ref } = ctx;
    const parts = {};
    const pr = b.priorities || [];
    const S = F.size;
    parts.budget = priceFit(F.price, terr);
    if (ref) parts.ref = S == null ? null : Math.max(0, 1 - Math.abs(S - ref.size) * 0.45 - (ref.kind && F.kind !== ref.kind ? 0.35 : 0));
    if (b.sizePref && SIZE_TARGET[b.sizePref]) parts.sizePref = S == null ? null : Math.max(0, 1 - Math.abs(S - SIZE_TARGET[b.sizePref]) * 0.5);
    // space = size class only; seat count is known for too few models to reward (7 seats is a separate must-have)
    if (pr.includes('space')) parts.space = S == null ? null : S / 6;
    if (pr.includes('easy')) parts.easy = S == null ? null : 1 - S / 6;
    if (pr.includes('pocket')) parts.pocket = 1 - norm01(F.entry, terr.floor, terr.ceil);
    if (pr.includes('premium')) parts.premium = F.m.segment ? (F.premium ? 1 : 0) : null;
    if (pr.includes('popular')) parts.popular = F.m.reg ? F.pop / 4.5 : null;
    if (pr.includes('economy')) parts.economy = F.hybrid ? 1 : F.ev ? (b.usage === 'long' ? 0.5 : 1) : 0.2;
    if (b.pt === 'hybrid') parts.pt = F.hybrid ? 1 : F.ev ? 0.1 : 0.3;
    if (b.pt === 'ev') parts.pt = F.anyEv ? 1 : 0;
    if (b.usage === 'city') parts.usage = F.hybrid || F.anyEv ? 1 : 0.5;
    if (b.usage === 'long') parts.usage = F.ev ? 0.2 : 0.8;
    if (b.brandsPrefer && b.brandsPrefer.length) parts.brand = b.brandsPrefer.includes(F.m.brand_id) ? 1 : 0;
    if (b.chinese === 'prefer_not') parts.origin = F.m.chinese == null ? null : F.m.chinese ? 0 : 1;
    if (b.attraction && (b.aspiration || []).length) {
      const asp = b.aspiration.map(id => ctx.byId[id]).filter(Boolean);
      if (b.attraction === 'brand') parts.attr = asp.some(a => a.brand_id === F.m.brand_id) ? 1 : 0;
      // "premium feel" counts only for models the market classes as premium (no invented proxy)
      if (b.attraction === 'premium') parts.attr = F.m.segment ? (F.premium ? 1 : 0) : null;
    }
    return parts;
  }
  const W = { premium: 1.2, budget: 1, ref: 1.4, sizePref: 1.2, space: 1, easy: 0.8, pocket: 1, popular: 0.8, economy: 0.8, pt: 1.2, usage: 0.5, brand: 0.9, origin: 0.6, attr: 1 };
  const COVERAGE = 0.8; // share of candidates that must have evidence before a factor may rank them
  const TIE = 0.02;     // totals closer than this are a tie: the brief doesn't separate them

  function rankFit(Fs, b, ctx) {
    const rows = Fs.map(F => ({ F, parts: score(F, b, ctx) }));
    const keys = [...new Set(rows.flatMap(r => Object.keys(r.parts)))];
    const used = [], dropped = [];
    for (const k of keys) {
      const known = rows.filter(r => r.parts[k] != null);
      if (!rows.length || known.length / rows.length < COVERAGE) { dropped.push(k); rows.forEach(r => { delete r.parts[k]; }); continue; }
      used.push(k);
      const mean = known.reduce((a, r) => a + r.parts[k], 0) / known.length;
      rows.forEach(r => { if (r.parts[k] == null) { r.parts[k] = mean; (r.filled = r.filled || []).push(k); } });
    }
    rows.forEach(r => { let s = 0, w = 0; for (const [k, v] of Object.entries(r.parts)) { s += W[k] * v; w += W[k]; } r.total = w ? s / w : 0; });
    return { rows, used, dropped };
  }

  /* ---------- earned stretch (CEO 2026-09-28) ----------
     A car priced above the stated budget stays only when its fit on what the buyer asked for (every factor except
     budget) beats the best car within budget by more than TIE. A brief with no such factor cannot earn stretch.
     Kept cars carry what the extra spend buys, for the explanation. */
  const briefFit = parts => { const k = Object.keys(parts).filter(x => x !== 'budget'); if (!k.length) return null; const w = k.reduce((a, x) => a + W[x], 0); return k.reduce((a, x) => a + W[x] * parts[x], 0) / w; };
  function earnedStretch(scored, B) {
    const inB = scored.filter(x => x.F.price <= B);
    let best = null;
    for (const x of inB) { const f = briefFit(x.parts); if (f != null && (!best || f > best.f)) best = { x, f }; }
    return scored.filter(x => {
      if (x.F.price <= B) return true;
      const f = briefFit(x.parts);
      if (f == null || !best || f - best.f <= TIE) return false;
      const buys = Object.keys(x.parts).filter(k => k !== 'budget' && x.parts[k] - best.x.parts[k] > 1e-6);
      x.stretch = { over: x.F.price - B, gain: +(f - best.f).toFixed(4), vs: best.x.F.m.id, buys };
      return true;
    });
  }

  /* ---------- confidence (output only; never changes the ranking) ----------
     Is the leader's lead robust to what we don't know? The leader must stay ahead by more than TIE when
       (a) any single ranking factor is removed (the lead must not rest on one factor), and
       (b) every mean-filled unknown is set against it: its own unknowns to the worst known value, rivals' to the best.
     level: 'tie' (lead within TIE) | 'lean' (ahead, but fails a or b; `depends` says why) | 'clear' | 'only' (one candidate). */
  function confidence(main, used) {
    if (!main.length) return null;
    if (main.length === 1) return { level: 'only', lead: null, depends: [], basis: [] };
    const hero = main[0], lead = hero.total - main[1].total;
    const tot = (parts, keys) => { let s = 0, w = 0; for (const k of keys) { s += W[k] * parts[k]; w += W[k]; } return w ? s / w : 0; };
    const stillLeads = (rows, keys) => {
      const h = tot(rows[0], keys); let best = -Infinity;
      for (let i = 1; i < rows.length; i++) best = Math.max(best, tot(rows[i], keys));
      return h - best > TIE;
    };
    // what the lead over the runner-up is made of (weighted difference per factor)
    const sw = used.reduce((a, k) => a + W[k], 0);
    const basis = used.map(k => ({ k, d: +((W[k] * (hero.parts[k] - main[1].parts[k])) / sw).toFixed(4) }))
      .filter(x => Math.abs(x.d) > 1e-4).sort((a, b) => b.d - a.d);
    if (lead <= TIE) return { level: 'tie', lead: +lead.toFixed(4), depends: [], basis, vs: main[1].F.m.id };
    const parts = main.map(x => x.parts), depends = [];
    if (used.length === 1) depends.push(used[0]);
    else for (const k of used) if (!stillLeads(parts, used.filter(x => x !== k))) depends.push(k);
    if (main.some(x => (x.filled || []).length)) {
      const lo = {}, hi = {};
      for (const k of used) { const kn = main.filter(x => !(x.filled || []).includes(k)).map(x => x.parts[k]); lo[k] = Math.min(...kn); hi[k] = Math.max(...kn); }
      const worst = main.map((x, i) => { const p = { ...x.parts }; for (const k of x.filled || []) p[k] = i === 0 ? lo[k] : hi[k]; return p; });
      if (!stillLeads(worst, used)) depends.push('unknown_data');
    }
    return { level: depends.length ? 'lean' : 'clear', lead: +lead.toFixed(4), depends, basis, vs: main[1].F.m.id };
  }

  /* ---------- main ---------- */
  function recommend(U, b) {
    const models = U.models, byId = {};
    models.forEach(m => { byId[m.id] = m; });
    b = normalizeBrief(b, byId);
    const terr = territory(b);
    const all = models.filter(m => m.u);
    // Layer 1
    const eligible = [], blocked = {}, unknown = {};
    for (const m of all) {
      const e = eligibility(m, b, terr);
      if (e.status === 'eligible') eligible.push(m);
      else if (e.status === 'unknown') unknown[e.reason] = (unknown[e.reason] || 0) + 1;
      else blocked[e.reason] = (blocked[e.reason] || 0) + 1;
    }
    // Layer 2
    const Fs = eligible.map(m => features(m, b, terr));
    const ref = refSize(b, byId);
    const ctx = { terr, ref, byId };
    const fit = rankFit(Fs, b, ctx);
    // nothing within budget meets the requirements: above-budget cars are not recommendations, only "nearest"
    const inBudget = fit.rows.filter(x => x.F.price <= terr.budget);
    if (!inBudget.length && fit.rows.length) {
      const above = fit.rows.slice().sort((x, y) => x.F.price - y.F.price || x.F.m.id.localeCompare(y.F.m.id)).slice(0, 3)
        .map(x => ({ id: x.F.m.id, price: x.F.price, over: x.F.price - terr.budget }));
      return { confidence: null, factors: fit.used, factorsDropped: fit.dropped, tier: 0, brief: b, terr, pool: 0, eligible: eligible.length, blocked, unknown,
        ranked: [], poolIds: [], hero: null, alts: [], nearestAbove: above, nearest: nearest(all, b, terr), shortlist: verdict(b, byId, terr, [], ctx), aspiration: aspirations(b, byId, terr) };
    }
    // order within a tie carries no meaning; it is only made deterministic (price, then name)
    const scored = earnedStretch(fit.rows, terr.budget).sort((x, y) => (Math.abs(y.total - x.total) > 1e-9 ? y.total - x.total : 0) || x.F.price - y.F.price || x.F.m.id.localeCompare(y.F.m.id));
    // main recommendations come from the budget territory; much cheaper cars go to the separate "spend less" slot
    let main = scored.filter(s => s.F.price >= terr.floor), value = scored.filter(s => s.F.price < terr.floor);
    let widened = false;
    if (main.length < 3 && value.length) { main = scored.slice(); value = []; widened = main.some(s => s.F.price < terr.floor); }
    // has the brief earned a winner? the top tier = everything within TIE of the best main candidate
    const best = main.length ? main[0].total : 0;
    const tier = main.filter(s => s.total >= best - TIE);
    const out = { confidence: confidence(main, fit.used), factors: fit.used, factorsDropped: fit.dropped, tier: tier.length, decided: tier.length <= 3, clear: tier.length === 1, brief: b, terr, pool: scored.length, eligible: eligible.length, widened, blocked, unknown, ranked: main.map(s => s.F.m.id), poolIds: scored.map(s => s.F.m.id) };
    const sl = verdict(b, byId, terr, scored, ctx);
    const asp = aspirations(b, byId, terr);
    if (!main.length) return { ...out, hero: null, alts: [], nearest: nearest(all, b, terr), shortlist: sl, aspiration: asp };

    // the buyer's own shortlist leads when one of their cars is eligible
    const named = main.concat(value).filter(s => (b.shortlist || []).includes(s.F.m.id));
    let hero, alts;
    const equal = !named.length && tier.length > 1;
    if (equal) {
      // no winner earned: show up to three equally good options that span the tied set
      const picks = span(tier, 3);
      // listed by price; all carry role 'equal' — none leads
      hero = { ...picks[0], role: 'equal' }; alts = picks.slice(1).map(x => ({ ...x, role: 'equal' }));
    } else {
      hero = named.length ? named[0] : main[0];
      alts = pickAlts(main, hero, b, named);
    }
    // "you could spend substantially less": meets every must-have and fits the stated priorities at least as well
    let less = null;
    if (value.length && !(b.priorities || []).includes('pocket')) {
      const nonBudget = x => { const k = Object.keys(x.parts).filter(k => k !== 'budget'); return k.length ? k.reduce((a, c) => a + x.parts[c], 0) / k.length : 0; };
      const cands = value.filter(x => nonBudget(x) >= nonBudget(hero) - 0.05 && (!ref || x.parts.ref >= (hero.parts.ref || 0) - 0.1))
        .sort((x, y) => nonBudget(y) - nonBudget(x) || y.F.price - x.F.price);
      const c = cands[0];
      if (c) {
        const top = c.F.v.fit[c.F.v.fit.length - 1].min, saves = hero.F.price - top;
        if (saves >= terr.budget * 0.2) less = { id: c.F.m.id, price: top, entry: c.F.entry, saves, sameSize: hero.F.size != null && c.F.size === hero.F.size, seven: c.F.seven };
      }
    }
    const res = {
      ...out, equal, heroFromShortlist: named.length > 0 && hero === named[0],
      hero: pack(hero, b, terr, ctx), alts: alts.map(a => pack(a, b, terr, ctx, hero)),
      less, shortlist: sl, aspiration: asp, unmet: unmet(all, b, terr, scored),
    };
    return guard(res, byId, b, terr);
  }

  // Final integrity guard: nothing ineligible can leave the engine as a recommendation, whatever produced it.
  function guard(res, byId, b, terr) {
    const ok = id => eligibility(byId[id], b, terr).status === 'eligible';
    const dropped = [];
    if (res.hero && !ok(res.hero.id)) { dropped.push(res.hero.id); res.hero = res.alts.shift() || null; }
    res.alts = res.alts.filter(a => (ok(a.id) ? true : (dropped.push(a.id), false)));
    if (res.less && !ok(res.less.id)) { dropped.push(res.less.id); res.less = null; }
    if (dropped.length) { res.guardDropped = dropped; if (typeof console !== 'undefined') console.error('[engine] ineligible model blocked', dropped); }
    return res;
  }

  // n picks from a set of equally scored cars: cheapest, middle, dearest, preferring distinct brands (no hidden order)
  function span(set, n) {
    const byPrice = set.slice().sort((x, y) => x.F.price - y.F.price || x.F.m.id.localeCompare(y.F.m.id));
    const idx = n >= 3 ? [0, Math.floor((byPrice.length - 1) / 2), byPrice.length - 1] : n === 2 ? [0, byPrice.length - 1] : [0];
    const picks = [];
    for (const i of idx) {
      const c = byPrice.slice(i).concat(byPrice.slice(0, i).reverse()).find(x => !picks.includes(x) && !picks.some(p => p.F.m.brand_id === x.F.m.brand_id)) || byPrice.find(x => !picks.includes(x));
      if (c && !picks.includes(c)) picks.push(c);
    }
    return picks;
  }

  function pickAlts(scored, hero, b, named) {
    const alts = [];
    const used = new Set([hero.F.m.id]);
    const add = (x, role) => { if (x && !used.has(x.F.m.id) && alts.length < 2) { alts.push({ ...x, role }); used.add(x.F.m.id); } };
    // 1: the other cars the buyer named (eligible only)
    for (const x of named || []) add(x, 'yours');
    // 2: a challenger only when it fits the brief clearly better than the buyer's best named car
    if (named && named.length) {
      const c = scored.find(s => !used.has(s.F.m.id));
      if (c && c.total > hero.total + TIE) add(c, 'challenger');
      return alts;
    }
    // 3: the next score level; if several cars tie there, span them instead of taking whichever sorts first
    for (let k = 0; k < 2 && alts.length < 2; k++) {
      const rest = scored.filter(s => !used.has(s.F.m.id));
      if (!rest.length) break;
      span(rest.filter(s => s.total >= rest[0].total - TIE), 2 - alts.length).forEach(x => add(x, 'runner_up'));
    }
    return alts;
  }

  function pack(x, b, terr, ctx, hero) {
    const F = x.F, m = F.m;
    return {
      id: m.id, role: x.role || 'hero', score: +x.total.toFixed(4), parts: x.parts, stretch: x.stretch || null,
      pick: F.v.pick, fit: F.v.fit, all: F.v.all, entry: F.entry, price: F.price,
      size: F.size, sizeKey: sizeKey(m), premium: F.premium, hp: F.hp, warranty: F.warranty, seven: F.seven,
      hybrid: F.hybrid, ev: F.ev, anyEv: F.anyEv, petrolOnly: F.petrolOnly,
      overBudget: F.price > terr.budget ? F.price - terr.budget : 0,
      headroom: terr.budget - F.price,
      ref: ctx.ref ? { ids: ctx.ref.ids, diff: F.size != null ? Math.round(F.size - ctx.ref.size) : null, kind: F.kind === ctx.ref.kind } : null,
      vs: hero ? compare(x, hero) : null,
    };
  }

  // evidence-backed differences only
  function compare(a, h) {
    const d = [];
    const A = a.F, H = h.F;
    if (A.price < H.price * 0.95) d.push({ k: 'cheaper', v: H.price - A.price });
    if (A.price > H.price * 1.05) d.push({ k: 'dearer', v: A.price - H.price });
    if (A.size != null && H.size != null && A.size !== H.size) d.push({ k: A.size > H.size ? 'bigger' : 'smaller' });
    if (A.seven && !H.seven) d.push({ k: 'seven' });
    if (A.hp && H.hp && Math.abs(A.hp - H.hp) / H.hp > 0.12) d.push({ k: A.hp > H.hp ? 'more_hp' : 'less_hp', a: A.hp, h: H.hp });
    if (A.warranty && H.warranty && A.warranty !== H.warranty) d.push({ k: A.warranty > H.warranty ? 'longer_warranty' : 'shorter_warranty', a: A.warranty, h: H.warranty });
    if (A.hybrid && !H.hybrid) d.push({ k: 'hybrid' });
    if (A.anyEv && !H.anyEv) d.push({ k: 'ev' });
    return d;
  }

  /* ---------- shortlist verdict ---------- */
  function verdict(b, byId, terr, scored, ctx) {
    const ids = (b.shortlist || []).filter(id => byId[id]);
    if (!ids.length) return null;
    const rows = ids.map(id => {
      const m = byId[id];
      const s = scored.find(x => x.F.m.id === id);
      if (s) return { id, ok: true, score: s.total, rank: scored.indexOf(s) + 1, F: s.F, parts: s.parts };
      const e = eligibility(m, b, terr);
      const tr = m.u ? currentTrims(m) : [];
      // eligible but not ranked = only above-budget versions whose extra spend is not earned
      const why = e.status === 'unknown' ? 'unknown_' + e.reason : e.status === 'eligible' ? 'budget' : e.reason;
      return { id, ok: false, why, entry: tr.length ? Math.min(...tr.map(t => t.min)) : null };
    });
    const ok = rows.filter(r => r.ok).sort((x, y) => y.score - x.score);
    const res = { rows: rows.map(r => ({ id: r.id, ok: r.ok, why: r.why, entry: r.entry, rank: r.rank })), winner: null, margin: null, diffs: [] };
    if (ok.length >= 2) {
      res.winner = ok[0].id; res.second = ok[1].id; res.margin = +(ok[0].score - ok[1].score).toFixed(4);
      res.diffs = compare({ F: ok[0].F }, { F: ok[1].F });
      res.close = res.margin < 0.03;
      res.tie = res.margin < TIE;
      // the factor that separates them most
      const pa = ok[0].parts, pb = ok[1].parts;
      res.edge = Object.keys(pa).filter(k => pb[k] != null).sort((x, y) => (pa[y] - pb[y]) - (pa[x] - pb[x]))[0] || null;
      res.picks = ok.slice(0, 2).map(r => ({ id: r.id, trim: r.F.v.pick.label, price: r.F.price, hp: r.F.hp, warranty: r.F.warranty, size: r.F.size }));
    } else if (ok.length === 1) res.winner = ok[0].id;
    if (!ok.length && rows.length) res.allOut = [...new Set(rows.map(r => r.why))];
    const heroId = scored.length ? scored[0].F.m.id : null;
    res.heroOutside = heroId && !ids.includes(heroId) ? heroId : null;
    return res;
  }

  /* ---------- aspiration (named cars far above budget) ---------- */
  function aspirations(b, byId, terr) {
    const ids = (b.aspiration || []).filter(id => byId[id]);
    if (!ids.length) return null;
    return ids.map(id => {
      const m = byId[id];
      const tr = currentTrims(m);
      const entry = tr.length ? Math.min(...tr.map(t => t.min)) : null;
      // cheapest new car from the same brand, for the "closest you can get to the badge" line
      const sameBrand = Object.values(byId).filter(x => x.u && x.brand_id === m.brand_id).map(x => ({ id: x.id, p: Math.min(...currentTrims(x).map(t => t.min).concat([Infinity])) })).sort((x, y) => x.p - y.p)[0];
      return { id, entry, times: entry ? +(entry / terr.budget).toFixed(1) : null, cheapestBrand: sameBrand && sameBrand.p < Infinity ? sameBrand : null };
    });
  }

  /* ---------- preferences the result could not meet ---------- */
  function unmet(all, b, terr, scored) {
    const out = [];
    const need = (key, test, trimTest) => {
      if (scored.slice(0, 3).some(s => test(s.F))) return;
      // nearest car that has it, ignoring budget
      let best = null;
      for (const m of all) {
        if (blocker(m, { ...b, budget: 1e9, budgetMode: 'max', stretch: false }, { budget: 1e9, ceil: 1e9, floor: 0 })) continue;
        const tr = currentTrims(m).filter(trimTest);
        if (!tr.length) continue;
        const p = Math.min(...tr.map(t => t.min));
        if (!best || p < best.p) best = { id: m.id, p };
      }
      out.push({ key, nearest: best });
    };
    if (b.pt === 'hybrid') need('hybrid', F => F.hybrid, t => t.pt === 'hybrid');
    if (b.pt === 'ev') need('ev', F => F.anyEv, t => t.pt === 'ev');
    return out;
  }

  /* ---------- no match ---------- */
  function nearest(all, b, terr) {
    const fixes = [];
    const tryB = (patch, key) => {
      const nb = { ...b, ...patch }, nt = territory(nb);
      const n = all.filter(m => !blocker(m, nb, nt)).length;
      if (n) fixes.push({ key, n });
    };
    if (b.seats === 7) tryB({ seats: null }, 'seats');
    if (b.chinese === 'exclude') tryB({ chinese: 'open' }, 'chinese');
    if ((b.pt && b.pt !== 'open') || (b.ptNo || []).length) tryB({ pt: 'open', ptNo: [] }, 'powertrain');
    if ((b.brandsOnly || []).length) tryB({ brandsOnly: [] }, 'brand_only');
    if (b.drive4 === true) tryB({ drive4: null }, 'drive');
    if (b.body && b.body.length) tryB({ body: null }, 'body');
    if (b.brandsExclude && b.brandsExclude.length) tryB({ brandsExclude: [] }, 'brand');
    // the lowest budget that gives at least one match
    const prices = all.filter(m => !blocker(m, { ...b, budget: 1e9, budgetMode: 'max', stretch: false }, { budget: 1e9, ceil: 1e9, floor: 0 }))
      .map(m => Math.min(...currentTrims(m).filter(t => ptOk(t, b, m) === true).map(t => t.min))).sort((x, y) => x - y);
    if (prices.length) fixes.push({ key: 'budget', to: Math.ceil(prices[0] / STEP) * STEP });
    return fixes;
  }

  /* ---------- brief normalisation (parser output + answers -> engine input) ---------- */
  function normalizeBrief(b, byId) {
    b = { ...b };
    const mentions = b.mentions || [];
    b.reference = [...new Set([...(b.reference || []), ...mentions.filter(x => x.role === 'reference').map(x => x.id)])];
    b.avoid = [...new Set([...(b.avoid || []), ...mentions.filter(x => x.role === 'avoid').map(x => x.id)])];
    const cons = mentions.filter(x => x.role === 'consider').map(x => x.id);
    if (!b.budget && b.reference.length) {
      // "around the Qashqai's price": the middle of its current versions
      const r = byId[b.reference[0]]; const tr = r ? currentTrims(r) : [];
      if (tr.length) { const p = tr.map(t => t.min).sort((x, y) => x - y); b.budget = Math.round(p[Math.floor((p.length - 1) / 2)] / 50000) * 50000; b.budgetMode = 'around'; b.budgetFrom = r.id; }
    }
    if (!b.budget && cons.length) {
      const ps = cons.map(id => byId[id]).filter(m => m && m.u).map(m => { const p = currentTrims(m).map(t => t.min).sort((x, y) => x - y); return p[Math.floor((p.length - 1) / 2)]; }).filter(Boolean);
      if (ps.length) { b.budget = Math.round(Math.max(...ps) / 50000) * 50000; b.budgetMode = 'around'; b.budgetFrom = 'shortlist'; }
    }
    if (b.budget) {
      const terr = territory(b);
      b.shortlist = [...new Set([...(b.shortlist || []), ...cons.filter(id => { const m = byId[id]; if (!m) return false; const tr = currentTrims(m); return !tr.length || Math.min(...tr.map(t => t.min)) <= terr.ceil * 1.15; })])];
      b.aspiration = [...new Set([...(b.aspiration || []), ...cons.filter(id => !b.shortlist.includes(id))])];
      // what they told us they like about an out-of-reach car ("comfort and a premium feel")
      if (b.aspiration.length) {
        const ck = b.checks || [], pr = b.priorities || [];
        if (!b.attraction) b.attraction = ck.includes('brand') || ck.includes('comfort') ? 'premium' : pr.includes('space') ? 'size' : pr.includes('performance') ? 'performance' : null;
        if (!b.attraction) delete b.attraction;
      }
    } else {
      b.shortlist = [...new Set([...(b.shortlist || []), ...cons])];
      b.aspiration = b.aspiration || [];
    }
    delete b.mentions;
    // "Tucson or Sportage" / "the Qashqai's size" = the body those cars are (editable in the summary)
    if (!(b.body && b.body.length) && !b.bodyAny) {
      const src = [...b.shortlist, ...b.reference, ...(b.attraction === 'size' ? b.aspiration : [])].map(id => byId[id]).filter(Boolean);
      const bodies = [...new Set(src.map(m => m.body))];
      if (bodies.length) { b.body = bodies; b.bodyImplied = true; }
    }
    return b;
  }

  function count(U, b) {
    const byId = {}; U.models.forEach(m => { byId[m.id] = m; });
    const nb = normalizeBrief(b, byId), terr = territory(nb);
    return U.models.filter(m => !blocker(m, nb, terr)).length;
  }

  /* ---------- adaptive questioning: the highest-information follow-up ---------- */
  // Candidate questions and the answers we can use defensibly. A question is worth asking only if its answers
  // lead to different recommendations; when the brief hasn't produced a winner, prefer the one that shrinks the tie most.
  const QUESTIONS = {
    drive: b => (b.offroad && b.drive4 == null ? [{ drive4: true }, { drive4: false }] : null),
    size: b => (!b.sizePref && !(b.reference || []).length && !(b.priorities || []).some(p => p === 'space' || p === 'easy') ? [{ sizePref: 'small' }, { sizePref: 'medium' }, { sizePref: 'large' }] : null),
    pt: b => (!b.pt ? [{ pt: 'open' }, { pt: 'no_ev' }, { pt: 'hybrid' }] : null),
    chinese: b => (!b.chinese ? [{ chinese: 'open' }, { chinese: 'exclude' }] : null),
    usage: b => (!b.usage ? [{ usage: 'city' }, { usage: 'mixed' }, { usage: 'long' }] : null),
    priorities: b => (!(b.priorities || []).length ? ['space', 'easy', 'pocket', 'economy', 'popular', 'premium'].map(p => ({ priorities: [p] })) : null),
  };
  const HARD_QS = ['pt', 'chinese', 'drive'];
  function nextQuestion(U, b, asked) {
    const now = recommend(U, b);
    if (!now.hero) return null;
    const key = r => (r.hero ? [r.hero.id, ...r.alts.map(a => a.id)].sort().join('|') : 'none');
    let best = null;
    for (const [q, variantsOf] of Object.entries(QUESTIONS)) {
      if (asked.includes(q)) continue;
      const vs = variantsOf(b);
      if (!vs) continue;
      const outs = vs.map(v => recommend(U, { ...b, ...v }));
      const distinct = new Set(outs.map(key)).size;
      if (distinct < 2) continue; // no answer would change the recommendation
      const avgTier = outs.reduce((a, r) => a + (r.hero ? r.tier : 0), 0) / outs.length;
      const gain = now.tier - avgTier;
      if (now.decided && !HARD_QS.includes(q)) continue; // a winner exists: only must-haves can still change it
      const cand = { q, gain, distinct };
      if (!best || cand.gain > best.gain + 1e-9 || (Math.abs(cand.gain - best.gain) < 1e-9 && cand.distinct > best.distinct)) best = cand;
    }
    return best && (now.decided || best.gain > 0 || best.distinct >= 2) ? best.q : null;
  }

  // top-3 model ids for a brief — used to decide whether a follow-up question can change the answer
  function top3(U, b) { const r = recommend(U, b); return r.hero ? [r.hero.id, ...r.alts.map(a => a.id)] : []; }
  function material(U, b, variants) {
    const sets = variants.map(v => top3(U, { ...b, ...v }).join('|'));
    return new Set(sets).size > 1;
  }

  const api = { ENGINE_VERSION, STEP, recommend, nextQuestion, territory, count, material, top3, normalizeBrief, eligibility, priceFit, currentTrims, size, premium, sizeKey, seven, SEG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
