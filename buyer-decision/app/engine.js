/* CarIndex recommendation engine v4 (P1.1 integrity): Eligibility -> Fit -> Challenge. Model-first.
   1. Eligibility: every confirmed hard constraint is checked per model as eligible / ineligible / unknown.
      Only "eligible" models can be recommended. Unknown critical data never qualifies a model.
   2. Fit: eligible models are ranked on the confirmed brief. Registrations/popularity are not in the
      default score (only when the buyer asks for a popular choice). Unknown soft values score the median.
   3. Challenge: named cars outside the eligible set (aspiration, shortlist over budget) are explained
      separately and are never returned as recommendations. A final guard drops anything ineligible. */
(function (root) {
  'use strict';
  const ENGINE_VERSION = 'E5-2026-09-27';
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

  // how well one price matches the budget intention. The whole budget territory is flat (price position inside it is
  // not a fit signal); only going into the stretch, or far below the territory, lowers it. No cliffs.
  function priceFit(p, terr) {
    const B = terr.budget, lo = terr.mode === 'max' ? 0.7 * B : 0.8 * B;
    if (p > terr.ceil) return -1;
    if (p > B) return 1 - (p - B) / B * 2;          // +10% stretch -> 0.8
    if (p >= lo) return 1;
    return Math.max(0, 1 - (lo - p) / lo);          // half of the territory floor -> 0.5
  }
  function versions(m, b, terr) {
    const tr = currentTrims(m).filter(t => ptOk(t, b, m) === true);
    const fit = tr.filter(t => t.min <= terr.ceil).sort((x, y) => x.min - y.min);
    // the version the budget points at: best price fit (ties: the better-equipped, i.e. dearer, one)
    const pick = fit.slice().sort((x, y) => priceFit(y.min, terr) - priceFit(x.min, terr) || y.min - x.min)[0];
    return { all: tr.sort((x, y) => x.min - y.min), fit, pick, entry: fit[0] };
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
    if (pr.includes('space')) parts.space = S == null ? null : (S + (F.seven ? 1 : 0)) / 7;
    if (pr.includes('easy')) parts.easy = S == null ? null : 1 - S / 6;
    if (pr.includes('pocket')) parts.pocket = 1 - norm01(F.entry, terr.floor, terr.ceil);
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
  const W = { budget: 1, ref: 1.4, sizePref: 1.2, space: 1, easy: 0.8, pocket: 1, popular: 0.8, economy: 0.8, pt: 1.2, usage: 0.5, brand: 0.9, origin: 0.6, attr: 1 };
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
      rows.forEach(r => { if (r.parts[k] == null) r.parts[k] = mean; });
    }
    rows.forEach(r => { let s = 0, w = 0; for (const [k, v] of Object.entries(r.parts)) { s += W[k] * v; w += W[k]; } r.total = w ? s / w : 0; });
    return { rows, used, dropped };
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
    // order within a tie carries no meaning; it is only made deterministic (price, then name)
    const scored = fit.rows.sort((x, y) => (Math.abs(y.total - x.total) > 1e-9 ? y.total - x.total : 0) || x.F.price - y.F.price || x.F.m.id.localeCompare(y.F.m.id));
    // main recommendations come from the budget territory; much cheaper cars go to the separate "spend less" slot
    let main = scored.filter(s => s.F.price >= terr.floor), value = scored.filter(s => s.F.price < terr.floor);
    let widened = false;
    if (main.length < 3 && value.length) { main = scored.slice(); value = []; widened = main.some(s => s.F.price < terr.floor); }
    // has the brief earned a winner? the top tier = everything within TIE of the best main candidate
    const best = main.length ? main[0].total : 0;
    const tier = main.filter(s => s.total >= best - TIE);
    const out = { factors: fit.used, factorsDropped: fit.dropped, tier: tier.length, decided: tier.length <= 3, clear: tier.length === 1, brief: b, terr, pool: scored.length, eligible: eligible.length, widened, blocked, unknown, ranked: main.map(s => s.F.m.id), poolIds: scored.map(s => s.F.m.id) };
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
      hero = picks[0]; alts = picks.slice(1).map(x => ({ ...x, role: 'equal' }));
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
      id: m.id, role: x.role || 'hero', score: +x.total.toFixed(4), parts: x.parts,
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
      return { id, ok: false, why: e.status === 'unknown' ? 'unknown_' + e.reason : e.reason, entry: tr.length ? Math.min(...tr.map(t => t.min)) : null };
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
    size: b => (!b.sizePref && !(b.reference || []).length && !(b.priorities || []).some(p => p === 'space' || p === 'easy') ? [{ sizePref: 'small' }, { sizePref: 'medium' }, { sizePref: 'large' }] : null),
    pt: b => (!b.pt ? [{ pt: 'open' }, { pt: 'no_ev' }, { pt: 'hybrid' }] : null),
    chinese: b => (!b.chinese ? [{ chinese: 'open' }, { chinese: 'exclude' }] : null),
    usage: b => (!b.usage ? [{ usage: 'city' }, { usage: 'mixed' }, { usage: 'long' }] : null),
    priorities: b => (!(b.priorities || []).length ? ['space', 'easy', 'pocket', 'economy', 'popular'].map(p => ({ priorities: [p] })) : null),
  };
  const HARD_QS = ['pt', 'chinese'];
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
