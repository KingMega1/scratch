/* CarIndex recommendation engine v3 (P1.1): model-first, brief-driven.
   Rank = fit to the confirmed brief only. Source coverage and popularity never enter the score
   (popularity only when the buyer asks for it). Unknown values score the median of the candidates. */
(function (root) {
  'use strict';
  const ENGINE_VERSION = 'E3-2026-09-26';
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
  // established on Egyptian roads: first registrations per month on sale, saturating at 25/month.
  // Saturation keeps this from turning into "whatever sells most" (no self-reinforcing loop).
  const LAST = '2026-08';
  const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) + 1;
  function established(m) {
    if (!m.reg || !m.reg.first_month) return 0;
    const months = Math.min(12, Math.max(1, monthsBetween(m.reg.first_month, LAST)));
    return Math.min(1, (m.reg.last12 || 0) / months / 25);
  }

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
  const ptOk = (t, pt) => {
    if (!pt || pt === 'open' || pt === 'hybrid' || pt === 'ev') return true;
    if (pt === 'no_ev') return t.pt !== 'ev';
    if (pt === 'petrol') return t.pt === 'petrol';
    return true;
  };

  /* ---------- budget territory ---------- */
  function territory(b) {
    const B = b.budget;
    const mode = b.budgetMode || 'around';
    const ceil = mode === 'max' ? (b.stretch ? B * 1.1 : B) : B * 1.1;
    const floor = b.budgetMin ? b.budgetMin * 0.95 : B * (mode === 'max' ? 0.75 : 0.8);
    return { budget: B, ceil: Math.round(ceil), floor: Math.round(floor), mode };
  }

  /* ---------- hard constraints ---------- */
  // returns null when the model qualifies, else the first constraint it breaks
  function blocker(m, b, terr) {
    if (!m.u) return 'not_on_sale';
    if (b.body && b.body.length && !b.body.includes(m.body)) return 'body';
    if (b.notBody && b.notBody.includes(m.body)) return 'body';
    if (b.seats === 7 && !seven(m)) return 'seats';
    if (b.chinese === 'exclude' && m.chinese) return 'chinese';
    if (b.brandsExclude && b.brandsExclude.includes(m.brand_id)) return 'brand';
    if (b.avoid && b.avoid.includes(m.id)) return 'brand';
    const tr = currentTrims(m).filter(t => ptOk(t, b.pt));
    if (!tr.length) return 'powertrain';
    if (Math.min(...tr.map(t => t.min)) > terr.ceil) return 'budget';
    return null;
  }

  function versions(m, b, terr) {
    const tr = currentTrims(m).filter(t => ptOk(t, b.pt));
    const fit = tr.filter(t => t.min <= terr.ceil).sort((x, y) => x.min - y.min);
    const within = fit.filter(t => t.min <= terr.budget);
    // the version the budget buys: the best one at or under budget, else the first one in the stretch
    const pick = within.length ? within[within.length - 1] : fit[0];
    return { all: tr.sort((x, y) => x.min - y.min), fit, pick, entry: fit[0] };
  }

  /* ---------- scoring ---------- */
  const median = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const norm01 = (v, lo, hi) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  function features(m, b, terr) {
    const v = versions(m, b, terr);
    const fitPts = [...new Set(v.fit.map(t => t.pt))];
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
      est: established(m),
    };
  }

  function refSize(b, byId) {
    const refs = (b.reference || []).concat(b.attraction === 'size' ? b.aspiration || [] : []).map(id => byId[id]).filter(Boolean);
    const s = refs.map(size).filter(Boolean);
    return s.length ? { size: s.reduce((a, c) => a + c, 0) / s.length, kind: refs[0].body, ids: refs.map(r => r.id) } : null;
  }

  // weights: fit to budget always; the rest only when the brief calls for it
  function score(F, b, ctx) {
    const { terr, med, rng, ref } = ctx;
    const parts = {};
    // budget: the version the budget buys, as close to the budget as possible (over budget costs more than under)
    const r = F.price / terr.budget;
    parts.budget = r <= 1 ? 1 - (1 - r) * 1.2 : 1 - (r - 1) * 4;
    const pr = b.priorities || [];
    if (ref) {
      const s = F.size != null ? F.size : med.size;
      parts.ref = 1 - Math.min(1, Math.abs(s - ref.size) * 0.45) - (ref.kind && F.kind !== ref.kind ? 0.35 : 0);
    }
    if (b.seats === 7 || pr.includes('space') || (b.who || []).includes('kids') || (b.who || []).includes('family')) {
      const s = F.size != null ? F.size : med.size;
      parts.space = norm01(s + (F.seven ? 1 : 0), rng.sizeLo, rng.sizeHi + 1) * (pr.includes('space') ? 1 : 0.4);
    }
    if (pr.includes('easy')) parts.easy = 1 - norm01(F.size != null ? F.size : med.size, rng.sizeLo, rng.sizeHi);
    if (pr.includes('performance')) parts.perf = norm01(F.hp != null ? F.hp : med.hp, rng.hpLo, rng.hpHi);
    if (pr.includes('warranty')) parts.warranty = norm01(F.warranty != null ? F.warranty : med.warranty, rng.wLo, rng.wHi);
    if (pr.includes('pocket')) parts.pocket = 1 - norm01(F.entry, terr.floor, terr.ceil);
    if (pr.includes('popular')) parts.popular = norm01(F.pop, rng.popLo, rng.popHi);
    if (pr.includes('economy')) parts.economy = F.hybrid ? 1 : F.ev ? (b.usage === 'long' ? 0.5 : 1) : 0.2;
    // powertrain preference and driving pattern
    // default evidence, always on: warranty length and being established here
    parts.est = F.est;
    parts.warrantyD = norm01(F.warranty != null ? F.warranty : med.warranty, rng.wLo, rng.wHi);
    if (b.pt === 'hybrid') parts.pt = F.hybrid ? 1 : F.ev ? 0.1 : 0.3;
    if (b.pt === 'ev') parts.pt = F.anyEv ? 1 : 0;
    if (b.usage === 'city') parts.usage = F.hybrid || F.anyEv ? 1 : 0.5;
    if (b.usage === 'long') parts.usage = F.ev ? 0.2 : 0.8;
    if (b.brandsPrefer && b.brandsPrefer.length) parts.brand = b.brandsPrefer.includes(F.m.brand_id) ? 1 : 0;
    if (b.chinese === 'prefer_not') parts.origin = F.m.chinese ? 0 : 1;
    // what drew them to an out-of-reach car
    if (b.attraction && (b.aspiration || []).length) {
      const asp = b.aspiration.map(id => ctx.byId[id]).filter(Boolean);
      if (b.attraction === 'brand') parts.attr = asp.some(a => a.brand_id === F.m.brand_id) ? 1 : asp.some(a => a.origin === F.m.origin) ? 0.7 : F.premium ? 0.5 : 0;
      if (b.attraction === 'premium') parts.attr = F.premium ? 1 : asp.some(a => a.origin === F.m.origin) ? 0.5 : 0;
      if (b.attraction === 'performance') parts.attr = norm01(F.hp != null ? F.hp : med.hp, rng.hpLo, rng.hpHi);
    }
    const W = { est: 0.5, warrantyD: 0.25, budget: 1, ref: 1.4, space: 1, easy: 0.8, perf: 1, warranty: 0.8, pocket: 1, popular: 0.8, economy: 0.8, pt: 1.2, usage: 0.5, brand: 0.9, origin: 0.6, attr: 1 };
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) { s += W[k] * v; w += W[k]; }
    return { total: s / w, parts };
  }

  /* ---------- main ---------- */
  function recommend(U, b) {
    const models = U.models, byId = {};
    models.forEach(m => { byId[m.id] = m; });
    b = normalizeBrief(b, byId);
    const terr = territory(b);
    const mentioned = [...(b.shortlist || []), ...(b.aspiration || [])];
    const all = models.filter(m => m.u);
    const pool = [], cheaper = [], blocked = {};
    for (const m of all) {
      const why = blocker(m, b, terr);
      if (why) { blocked[why] = (blocked[why] || 0) + 1; continue; }
      const v = versions(m, b, terr);
      const top = v.fit[v.fit.length - 1].min;
      if (top < terr.floor) cheaper.push(m); else pool.push(m);
    }
    // too few cars in the budget territory: cheaper ones join (their budget score already reflects it)
    let widened = false;
    if (pool.length < 3 && cheaper.length) { pool.push(...cheaper.splice(0)); widened = true; }
    const Fs = pool.map(m => features(m, b, terr));
    const med = { size: median(Fs.map(f => f.size)) || 3, hp: median(Fs.map(f => f.hp)), warranty: median(Fs.map(f => f.warranty)) };
    const vals = (k, d) => { const a = Fs.map(f => (f[k] != null ? f[k] : d)); return a.length ? [Math.min(...a), Math.max(...a)] : [0, 1]; };
    const [sizeLo, sizeHi] = vals('size', med.size), [hpLo, hpHi] = vals('hp', med.hp), [wLo, wHi] = vals('warranty', med.warranty), [popLo, popHi] = vals('pop', 0);
    const ref = refSize(b, byId);
    const ctx = { terr, med, rng: { sizeLo, sizeHi, hpLo, hpHi, wLo, wHi, popLo, popHi }, ref, byId };
    const scored = Fs.map(F => ({ F, ...score(F, b, ctx) }))
      .sort((x, y) => y.total - x.total || x.F.price - y.F.price || x.F.m.id.localeCompare(y.F.m.id));
    // shortlisted models the buyer can afford always make the result set
    const out = { brief: b, terr, pool: scored.length, widened, blocked, ranked: scored.map(s => s.F.m.id) };
    if (!scored.length) return { ...out, hero: null, alts: [], nearest: nearest(all, b, terr), shortlist: verdict(b, byId, terr, scored, ctx) };

    const hero = scored[0];
    const alts = pickAlts(scored, hero, b);
    // "you could spend substantially less": only if it meets every must-have and is a strong fit on its own terms
    let less = null;
    if (cheaper.length && !(b.priorities || []).includes('pocket')) {
      const cF = cheaper.map(m => features(m, b, terr)).map(F => ({ F, ...score(F, { ...b, priorities: [...(b.priorities || [])] }, ctx) }));
      const matchRef = x => !ref || (x.F.size != null && Math.abs(x.F.size - ref.size) < 1 && x.F.kind === ref.kind);
      const cands = cF.filter(x => matchRef(x) && (x.F.size || 0) >= (hero.F.size || 0) - (b.seats === 7 ? 0 : 1))
        .sort((x, y) => (regLast12(y.F.m) - regLast12(x.F.m)));
      if (cands.length) {
        const c = cands[0];
        const saves = hero.F.price - c.F.v.fit[c.F.v.fit.length - 1].min;
        if (saves >= terr.budget * 0.2) less = { id: c.F.m.id, price: c.F.v.fit[c.F.v.fit.length - 1].min, entry: c.F.entry, saves, sameSize: hero.F.size != null && c.F.size === hero.F.size, seven: c.F.seven };
      }
    }
    const res = {
      ...out, hero: pack(hero, b, terr, ctx), alts: alts.map(a => pack(a, b, terr, ctx, hero)),
      less, shortlist: verdict(b, byId, terr, scored, ctx), aspiration: aspirations(b, byId, terr, scored, ctx),
      unmet: unmet(all, b, terr, scored),
    };
    return res;
  }

  function pickAlts(scored, hero, b) {
    const alts = [];
    const used = new Set([hero.F.m.id]);
    const add = (x, role) => { if (x && !used.has(x.F.m.id)) { alts.push({ ...x, role }); used.add(x.F.m.id); } };
    // 1: shortlisted cars the buyer named come first
    for (const id of b.shortlist || []) add(scored.find(s => s.F.m.id === id), 'yours');
    // 2: the next best fit, from another brand where possible
    add(scored.find(s => !used.has(s.F.m.id) && s.F.m.brand_id !== hero.F.m.brand_id) || scored.find(s => !used.has(s.F.m.id)), 'runner_up');
    // 3: a real different angle, only if it is close enough to matter
    if (alts.length < 2) {
      const top = hero.total;
      const close = scored.filter(s => !used.has(s.F.m.id) && s.total >= top - 0.25);
      const alt = close.find(s => (s.F.hybrid && !hero.F.hybrid) || (s.F.anyEv !== hero.F.anyEv && b.pt !== 'no_ev'));
      if (alt) add(alt, 'powertrain');
      else add(close.find(s => s.F.price <= hero.F.price * 0.9), 'cheaper');
      if (alts.length < 2) add(close.find(s => s.F.m.brand_id !== hero.F.m.brand_id), 'runner_up');
    }
    return alts.slice(0, 2);
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
      const why = blocker(m, b, terr);
      const tr = m.u ? currentTrims(m) : [];
      return { id, ok: false, why: why || 'below_floor', entry: tr.length ? Math.min(...tr.map(t => t.min)) : null };
    });
    const ok = rows.filter(r => r.ok).sort((x, y) => y.score - x.score);
    const res = { rows: rows.map(r => ({ id: r.id, ok: r.ok, why: r.why, entry: r.entry, rank: r.rank })), winner: null, margin: null, diffs: [] };
    if (ok.length >= 2) {
      res.winner = ok[0].id; res.second = ok[1].id; res.margin = +(ok[0].score - ok[1].score).toFixed(4);
      res.diffs = compare({ F: ok[0].F }, { F: ok[1].F });
      res.close = res.margin < 0.03;
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
  function aspirations(b, byId, terr, scored) {
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
    if (b.pt && b.pt !== 'open') tryB({ pt: 'open' }, 'powertrain');
    if (b.body && b.body.length) tryB({ body: null }, 'body');
    if (b.brandsExclude && b.brandsExclude.length) tryB({ brandsExclude: [] }, 'brand');
    // the lowest budget that gives at least one match
    const prices = all.filter(m => !blocker(m, { ...b, budget: 1e9, budgetMode: 'max', stretch: false }, { budget: 1e9, ceil: 1e9, floor: 0 }))
      .map(m => Math.min(...currentTrims(m).filter(t => ptOk(t, b.pt)).map(t => t.min))).sort((x, y) => x - y);
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

  // top-3 model ids for a brief — used to decide whether a follow-up question can change the answer
  function top3(U, b) { const r = recommend(U, b); return r.hero ? [r.hero.id, ...r.alts.map(a => a.id)] : []; }
  function material(U, b, variants) {
    const sets = variants.map(v => top3(U, { ...b, ...v }).join('|'));
    return new Set(sets).size > 1;
  }

  const api = { ENGINE_VERSION, STEP, recommend, territory, count, material, top3, normalizeBrief, established, currentTrims, size, premium, sizeKey, seven, SEG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
