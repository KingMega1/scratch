/* Find My Car — buyer-decision slice v2 (EN/AR), reading the P2 view. */
(function () {
  'use strict';
  const U = window.CI_UNIVERSE, E = window.CIEngine, T = window.CITrack, I = window.CII18N;
  T.setContext({ engine_version: E.ENGINE_VERSION, universe_version: `${U.meta.slice}@${U.meta.generated_as_of}` });

  const $ = (s, el = document) => el.querySelector(s);
  const screen = $('#screen');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('en-US');
  const num = n => `<span class="num">${fmt(n)}</span>`;

  /* ---------- language ---------- */
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } } };
  const qs = new URLSearchParams(location.search);
  let lang = qs.get('lang') || store.get('ci_lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'en');
  if (!I.S[lang]) lang = 'en';
  let S = I.S[lang];
  const money = n => `<span class="money">${S.egp(num(n))}</span>`;
  const date = d => (d ? I.DATE[lang](d.slice(0, 10)) : '');
  const name = m => `<span class="ltr">${esc(m.brand)} ${esc(m.model)}</span>`;
  const nameTxt = m => `${m.brand} ${m.model}`;
  const lat = s => `<span class="ltr">${esc(s)}</span>`;
  const SRC = { contactcars: 'ContactCars', hatla2ee: 'Hatla2ee', egycar: 'EgyCar', yallamotor: 'YallaMotor' };
  const srcName = s => SRC[s] || s;

  function applyLang() {
    S = I.S[lang];
    const h = document.documentElement;
    h.lang = lang; h.dir = S.dir; h.className = `lang-${lang}`;
    $('#lang-btn').textContent = S.lang_switch;
    $('#lang-btn').lang = lang === 'en' ? 'ar' : 'en';
    $('.skip').textContent = S.skip;
    $('#nav-find').textContent = S.nav_find;
    $('.trust').textContent = S.trust;
    $('#method').textContent = S.method(U.meta.models_in_slice, date(U.meta.generated_as_of), E.ENGINE_VERSION);
    $('.sheet-close').setAttribute('aria-label', S.close);
  }

  const ICON = {
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    seven: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4l-3 7M14 9h3M14 13h3M14 16h3"/>',
    city: '<path d="M3 21V9l5-3v15M8 21V4h8v17M16 21v-9l5 2v7M2 21h20"/><path d="M11 8h2M11 12h2M11 16h2"/>',
    mixed: '<path d="M3 20c4-8 7-3 9-8s5-6 9-8"/><circle cx="5" cy="18" r="1.5"/>',
    long: '<path d="M4 21 10 3h4l6 18"/><path d="M12 7v2M12 12v2M12 17v2"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4"/>',
    noplug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4M3 3l18 18"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.1"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h5"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    any: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    crowd: '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><circle cx="12" cy="6" r="3"/><path d="M1.5 20a5.5 5.5 0 0 1 11 0M11.5 20a5.5 5.5 0 0 1 11 0"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  };
  const ic = k => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;

  /* ---------- flow ---------- */
  const Q = [
    { id: 'seats', opts: [['five', 'person'], ['seven', 'seven']] },
    { id: 'usage', opts: [['city', 'city'], ['mixed', 'mixed'], ['long', 'long']] },
    { id: 'charging', filter: true, opts: [['yes', 'plug'], ['no', 'noplug'], ['unsure', 'q']] },
    { id: 'powertrain', filter: true, opts: [['petrol', 'fuel'], ['hybrid', 'leaf'], ['ev', 'bolt', a => a.charging !== 'no'], ['any', 'any']] },
    { id: 'priorities', multi: 2, opts: [['pocket', 'wallet'], ['popular', 'crowd'], ['warranty', 'shield']] },
  ];
  const DEFAULTS = { charging: 'unsure', powertrain: 'any', priorities: [] };
  const fresh = () => ({ budget: U.meta.budget_anchor_egp, stretch: false });
  let A = fresh(), stepIdx = 0, stepStart = 0, flowStart = 0, lastResult = null, current = null, restoring = false, backViaButton = false;
  const resultURL = () => location.pathname + location.search + '#a=' + encodeURIComponent(btoa(JSON.stringify(A)));
  // every screen is a history entry so the phone's back button walks back through the journey
  function nav(state) {
    if (restoring) return;
    const url = state.kind === 'result' ? resultURL() : location.pathname + location.search;
    if (state.replace) history.replaceState(state, '', url); else history.pushState(state, '', url);
  }

  const optsFor = q => q.opts.filter(o => !o[2] || o[2](A));
  const countWith = patch => E.countEligible(U, { ...DEFAULTS, ...A, ...patch });
  function shouldSkip(q) {
    if (!q.filter) return null; // ranking questions are always asked
    const live = optsFor(q).map(o => ({ v: o[0], n: countWith({ [q.id]: o[0] }) })).filter(c => c.n > 0);
    if (live.length && live.every(c => c.n === live[0].n)) return (live.find(c => c.v === 'any' || c.v === 'unsure') || live[0]).v;
    return null;
  }
  const askedCount = () => Q.filter(q => shouldSkip(q) === null).length;

  function go(html, focusSel) {
    screen.innerHTML = html;
    screen.classList.remove('screen'); void screen.offsetWidth; screen.classList.add('screen');
    const f = $(focusSel || 'h1, h2', screen); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  /* ---------- entry ---------- */
  const STRIP_MIN = 1_200_000, STRIP_MAX = 2_800_000;
  const pos = p => ((Math.min(Math.max(p, STRIP_MIN), STRIP_MAX) - STRIP_MIN) / (STRIP_MAX - STRIP_MIN)) * 100;
  const entryPrice = m => Math.min(...m.trims.map(t => t.max));

  function renderEntry(replace) {
    current = () => renderEntry(true);
    nav({ kind: 'entry', replace });
    const dots = U.models.map((m, i) => `<span class="dot" data-p="${entryPrice(m)}" style="left:${pos(entryPrice(m))}%;top:${16 + (i % 4) * 9}px"></span>`).join('');
    go(`
      <section class="entry" aria-labelledby="h-entry">
        <div>
          <p class="eyebrow">${S.entry_eyebrow}</p>
          <h1 id="h-entry">${S.entry_h1}</h1>
          <p class="lede">${S.entry_lede}</p>
        </div>
        <div class="budget-card">
          <div class="budget-row">
            <div><p class="label-mono">${S.budget_label}</p><div class="budget-val" id="bval"></div></div>
            <div class="stepper">
              <button class="icon-btn" id="bminus" aria-label="${S.budget_minus}">−</button>
              <button class="icon-btn" id="bplus" aria-label="${S.budget_plus}">+</button>
            </div>
          </div>
          <div class="strip" aria-hidden="true"><span class="band" id="band"></span>${dots}</div>
          <div class="strip-axis label-mono" aria-hidden="true"><span class="ltr">${fmt(STRIP_MIN / 1e6)}M</span><span>${S.strip_caption}</span><span class="ltr">${fmt(STRIP_MAX / 1e6)}M</span></div>
          <label class="check-line"><input type="checkbox" id="stretch"> ${S.stretch(Math.round(E.STRETCH * 100))}</label>
          <p class="count-line" id="bcount" aria-live="polite"></p>
        </div>
        <div><button class="btn btn-primary btn-big" id="start">${S.start}</button></div>
        <p class="muted small">${S.entry_foot(U.meta.models_in_slice, date(U.meta.generated_as_of))}</p>
      </section>`);
    const upd = () => {
      const lim = E.limitOf(A);
      $('#bval').innerHTML = money(A.budget);
      $('#band').style.width = pos(lim) + '%';
      screen.querySelectorAll('.dot').forEach(d => d.classList.toggle('in', +d.dataset.p <= lim));
      $('#bcount').innerHTML = S.count_line(countWith({ seats: 'five' }), money(lim));
      $('#bminus').disabled = A.budget <= U.meta.band[0]; $('#bplus').disabled = A.budget >= U.meta.band[1];
    };
    $('#bminus').onclick = () => { A.budget = Math.max(U.meta.band[0], A.budget - 100_000); upd(); };
    $('#bplus').onclick = () => { A.budget = Math.min(U.meta.band[1], A.budget + 100_000); upd(); };
    $('#stretch').checked = A.stretch;
    $('#stretch').onchange = e => { A.stretch = e.target.checked; upd(); };
    $('#start').onclick = () => { T.track('fmc_start', { budget: A.budget, stretch: A.stretch }); flowStart = performance.now(); nextQuestion(0); };
    upd();
  }

  /* ---------- questions ---------- */
  function nextQuestion(from) {
    for (let i = from; i < Q.length; i++) {
      const auto = shouldSkip(Q[i]);
      if (auto !== null) { A[Q[i].id] = auto; T.track('q_skipped', { q_id: Q[i].id, reason: 'no_effect', value: auto }); continue; }
      stepIdx = i; return renderQuestion(Q[i]);
    }
    revealThen(() => renderResult('flow'));
  }
  function prevQuestion(from) {
    for (let i = from - 1; i >= 0; i--) if (shouldSkip(Q[i]) === null) { stepIdx = i; return renderQuestion(Q[i]); }
    renderEntry();
  }
  const visibleStep = () => Q.slice(0, stepIdx + 1).filter(q => shouldSkip(q) === null).length;

  function renderQuestion(q, silent) {
    current = () => { restoring = true; renderQuestion(q, true); restoring = false; };
    nav({ kind: 'q', i: Q.indexOf(q) });
    const L = S.q[q.id];
    const sel = q.multi ? (A[q.id] || []) : A[q.id];
    const cards = optsFor(q).map(([v, icon]) => {
      const n = q.multi ? null : countWith({ [q.id]: v });
      const on = q.multi ? sel.includes(v) : sel === v;
      return `<button class="opt" data-v="${v}" ${q.multi ? `aria-pressed="${on}"` : `role="radio" aria-checked="${on}"`} ${n === 0 ? 'aria-disabled="true"' : ''}>
        ${n !== null ? `<span class="n">${S.matches(n)}</span>` : ''}${ic(icon)}<span class="t">${L.o[v][0]}</span><span class="s">${L.o[v][1]}</span></button>`;
    }).join('');
    const total = askedCount();
    go(`
      <section aria-labelledby="h-q">
        <div class="q-top"><button class="link-btn" id="back">${S.back}</button><span class="label-mono">${S.step(visibleStep(), total)}</span></div>
        <div class="progress" aria-hidden="true"><i style="width:${(visibleStep() / total) * 100}%"></i></div>
        <div class="q-head"><h2 id="h-q">${L.t}</h2><p class="q-hint">${L.h}</p></div>
        <div class="options" ${q.multi ? 'role="group"' : 'role="radiogroup"'} aria-labelledby="h-q">${cards}</div>
        ${q.multi ? `<div class="q-actions"><button class="btn btn-primary btn-big" id="done">${S.show_car}</button><button class="link-btn" id="skipq">${S.skip_prio}</button></div>` : ''}
      </section>`);
    if (!silent) { stepStart = performance.now(); T.track('q_view', { q_id: q.id, step: visibleStep() }); }
    $('#back').onclick = () => {
      backViaButton = true; T.track('q_back', { q_id: q.id, step: visibleStep(), via: 'button' });
      const prev = history.state;
      if (prev && prev.kind === 'q' && history.length > 1) { restoring = false; history.back(); } else prevQuestion(stepIdx);
    };
    screen.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      if (q.multi) {
        let cur = A[q.id] || [];
        cur = cur.includes(b.dataset.v) ? cur.filter(x => x !== b.dataset.v) : cur.concat(b.dataset.v).slice(-q.multi);
        A[q.id] = cur;
        screen.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-pressed', cur.includes(x.dataset.v)));
        return;
      }
      A[q.id] = b.dataset.v; delete A.pin;
      screen.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-checked', x === b));
      answered(q, b.dataset.v);
      setTimeout(() => nextQuestion(stepIdx + 1), 180);
    });
    if (q.multi) {
      $('#done').onclick = () => { answered(q, A[q.id] || []); revealThen(() => renderResult('flow')); };
      $('#skipq').onclick = () => { A[q.id] = []; answered(q, []); revealThen(() => renderResult('flow')); };
    }
  }
  function answered(q, value) {
    T.track('q_answer', { q_id: q.id, step: visibleStep(), value, ms_on_step: Math.round(performance.now() - stepStart), eligible_after: countWith({}) });
  }

  /* ---------- result ---------- */
  const say = x => { const f = S[x.code]; return f ? f(fmtParams(x.p)) : x.code; };
  function fmtParams(p) {
    const o = { ...p };
    ['price', 'limit', 'amount', 'budget', 'over', 'min', 'max', 'entry'].forEach(k => { if (typeof o[k] === 'number') o[k] = money(o[k]); });
    ['count'].forEach(k => { if (typeof o[k] === 'number') o[k] = num(o[k]); });
    if (typeof o.source === 'string') o.source = srcName(o.source);
    ['trim', 'source', 'text'].forEach(k => { if (typeof o[k] === 'string') o[k] = lat(o[k]); });
    return o;
  }
  const priceOf = t => (t.min !== t.max ? S.price_range(money(t.min), money(t.max)) : money(t.max));
  const ptText = g => (g ? S.pt[g] : `<span class="muted">${S.not_in_data}</span>`);
  const levelChip = (c, dark) => `<span class="chip lvl lvl-${c.level} ${dark ? 'dark' : ''}"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>${S.level[c.level]}</span>`;
  const seenDate = r => date(r.pick.observed_at || (r.model.freshness.price_snapshots.slice(-1)[0] || {}).observed_at);
  const adoptionLine = m => (m.registration.count ? S.adoption({ count: num(m.registration.count), rank: m.registration.rank, of: m.registration.of }) : '');
  const answersForTrack = () => { const { pin, ...rest } = A; return rest; };

  const SUV_SVG = `<svg class="suv" viewBox="0 0 600 200" aria-hidden="true" focusable="false">
    <defs><linearGradient id="sweep" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="body"><path d="M34 148V106q2-14 22-18l92-10 46-48q10-10 26-10h196q18 0 28 10l54 48 42 6q22 4 24 24v40Z"/></clipPath>
    <radialGradient id="beam" cx="0" cy=".5" r="1"><stop offset="0" stop-color="#1477D1" stop-opacity=".55"/><stop offset="1" stop-color="#1477D1" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="300" cy="190" rx="275" ry="9" fill="#000" opacity=".5"/>
    <path class="beam" d="M568 100 L600 78 L600 138 Z" fill="url(#beam)"/>
    <g class="car">
      <path d="M34 148V106q2-14 22-18l92-10 46-48q10-10 26-10h196q18 0 28 10l54 48 42 6q22 4 24 24v40Z" fill="#1d1f22" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>
      <path d="M206 34 166 78h140V34Z M318 34v44h172l-44-38q-6-6-16-6Z" fill="#2b3642"/>
      <path d="M56 112h506" stroke="rgba(255,255,255,.12)"/><path d="M34 132h536" stroke="rgba(255,255,255,.08)" stroke-width="6"/>
      <rect x="542" y="96" width="24" height="9" rx="4" fill="#E8F1FA"/>
      <rect x="36" y="96" width="14" height="10" rx="3" fill="#FFB020" opacity=".8"/>
      <g clip-path="url(#body)"><rect class="sweep" x="-200" y="0" width="160" height="200" fill="url(#sweep)"/></g>
      <g class="wheel"><circle cx="150" cy="150" r="38" fill="#0b0b0b" stroke="#3a3f46" stroke-width="3"/><circle cx="150" cy="150" r="17" fill="#6B7280"/><path d="M150 133v34M133 150h34" stroke="#3a3f46" stroke-width="3"/></g>
      <g class="wheel"><circle cx="458" cy="150" r="38" fill="#0b0b0b" stroke="#3a3f46" stroke-width="3"/><circle cx="458" cy="150" r="17" fill="#6B7280"/><path d="M458 133v34M441 150h34" stroke="#3a3f46" stroke-width="3"/></g>
    </g></svg>`;
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealThen(done) {
    const r = E.recommend(U, { ...DEFAULTS, ...A });
    if (reduceMotion() || !r.hero) return done();
    const steps = [S.match_all(U.meta.models_in_slice), S.match_fit(r.eligible), S.match_one];
    go(`<section class="matching" aria-live="polite"><div class="scan" aria-hidden="true"><i></i></div><p class="match-line" id="ml">${steps[0]}</p></section>`, '#ml');
    let i = 0;
    const tick = setInterval(() => { i++; if (i < steps.length) $('#ml').textContent = steps[i]; else { clearInterval(tick); done(); } }, 520);
  }

  function renderResult(source, pin) {
    if (pin !== undefined) A.pin = pin;
    const silent = !!arguments[2];
    current = () => renderResult('lang', undefined, true);
    const r = E.recommend(U, { ...DEFAULTS, ...A });
    lastResult = r;
    nav({ kind: 'result', replace: silent || source === 'shared_link' || source === 'promote' });
    if (!r.hero) return renderNoMatch(r, arguments[2]);
    const h = r.hero, m = h.model, alts = r.alternatives;
    const closeAlt = h.closeCall && U.models.find(x => x.id === h.closeCall);
    const gaps = ['seats', 'warranty', 'fuel_consumption', 'horsepower', 'trunk_capacity'].filter(k => !m.specs[k]).map(k => S.spec[k]);
    const sevenMissing = A.seats === 'seven' ? U.models.filter(x => !x.specs.seats).length : 0;
    go(`
      <div class="result">
        <section class="hero mode-${r.mode} ${silent ? '' : 'reveal'}" aria-labelledby="h-hero">
          <div class="stage">
            <p class="eyebrow r1">${S.mode[r.mode]}</p>
            <h1 id="h-hero" class="hero-name r2">${name(m)}</h1>
            <p class="hero-trim r3">${lat(h.pick.label)} · ${m.model_year} · ${ptText(h.group)}</p>
            ${SUV_SVG}
            <div class="hero-price r4"><p class="label-mono">${S.official_price(lat(h.pick.label))}</p><p class="price-big">${priceOf(h.pick)}</p></div>
          </div>
          ${S.mode_note[r.mode] ? `<p class="mode-note">${S.mode_note[r.mode]}</p>` : ''}
          ${closeAlt ? `<p class="mode-note">${S.close_call(name(closeAlt))}</p>` : ''}
          <div class="chips">${levelChip(h.confidence, true)}<span class="chip dark">${S.seen(seenDate(h))}</span>${m.registration.count ? `<span class="chip dark">${adoptionLine(m)}</span>` : ''}</div>
          <div class="cols">
            <div><h2 class="h3">${S.why_h}</h2><ul class="list">${r.hero.why.map(w => `<li><span class="mk good" aria-hidden="true">✓</span><span>${say(w)}</span></li>`).join('')}</ul></div>
            <div><h2 class="h3">${S.worth_h}</h2><ul class="list">${h.compromises.map(c => `<li><span class="mk bad" aria-hidden="true">!</span><span>${say(c)}</span></li>`).join('')}</ul>
              <h2 class="h3" style="margin-top:20px">${S.sure_h}</h2><ul class="list sure">${h.confidence.notes.map(c => `<li>${say(c)}</li>`).join('')}</ul></div>
          </div>
          <div class="hero-actions r5">
            <button class="btn btn-on-dark" data-cta="evidence" data-id="${m.id}">${S.actions.evidence}</button>
            <button class="btn btn-outline-dark" data-cta="share">${S.actions.share}</button>
          </div>
        </section>

        ${alts.length ? `<section aria-labelledby="h-alts">
          <p class="eyebrow">${S.alts_eyebrow}</p><h2 id="h-alts" class="sec-h">${S.alts_h}</h2>
          <div class="alts">${alts.map(x => `
            <article class="alt">
              <span class="chip role">${S.role[x.role]}</span>
              <h3>${name(x.model)}</h3>
              <p class="muted small">${lat((x.role === 'cheaper' ? x.entryTrim : x.pick).label)} · ${ptText(x.role === 'cheaper' ? x.entryTrim.powertrain : x.group)}</p>
              <p class="alt-price">${x.role === 'cheaper' ? `<span class="label-mono">${S.from}</span> ${money(x.entry)}` : priceOf(x.pick)}</p>
              <ul class="vs">${(x.role === 'stretch' ? [{ code: 'stretch_line', p: { price: x.pick.max } }] : x.vs).map(v => `<li>${say(v)}</li>`).join('')}</ul>
              ${x.compromises[0] ? `<p class="muted small">${say(x.compromises[0])}</p>` : ''}
              <div class="foot">${levelChip(x.confidence)}</div>
              <div class="foot">
                <button class="btn btn-ghost" data-promote="${x.id}" data-role="${x.role}">${S.make_pick}</button>
                <button class="link-btn" data-cta="evidence" data-id="${x.id}">${S.evidence_link}</button>
              </div>
            </article>`).join('')}</div>
          <div class="compare-toggle"><button class="btn btn-ghost" id="cmp-btn" aria-expanded="false" aria-controls="compare">${S.compare_btn(alts.length + 1)}</button></div>
          <div id="compare" hidden>${compareTable([h, ...alts])}</div>
        </section>` : ''}

        <section class="feedback" id="fb" aria-labelledby="h-fb"></section>

        <section class="notice" aria-labelledby="h-unc">
          <span class="ic" aria-hidden="true">i</span>
          <div><strong id="h-unc">${S.unknown_h}</strong>
            <ul>
              <li>${S.unknown_snapshot(seenDate(h))}</li>
              ${gaps.length ? `<li>${S.unknown_gaps(name(m), gaps.join(lang === 'ar' ? '، ' : ', '))}</li>` : ''}
              ${sevenMissing ? `<li>${S.seven_scarce(sevenMissing)}</li>` : ''}
              <li>${S.unknown_all(U.meta.not_in_data.map(k => I.NOT_IN_DATA[lang][k]).join(lang === 'ar' ? '، ' : ', '))}</li>
              <li>${S.unknown_scope(r.eligible, U.meta.models_in_slice)}</li>
            </ul></div>
        </section>

        <section aria-label="${S.answers_h}">
          <p class="label-mono" style="margin-bottom:8px">${S.answers_h}</p>
          <div class="answers"><button class="chip" data-edit="budget">${money(A.budget)}${A.stretch ? ' <span class="ltr">+10%</span>' : ''}</button>${
            Q.filter(q => !q.multi && A[q.id] && shouldSkip(q) === null).map(q => `<button class="chip" data-edit="${q.id}">${S.a[A[q.id]]}</button>`).join('')}${
            (A.priorities || []).map(p => `<button class="chip" data-edit="priorities">${S.a[p]}</button>`).join('')}<button class="link-btn" id="restart">${S.restart}</button></div>
        </section>
      </div>`, '#h-hero');
    if (!silent) {
      T.markResult();
      T.track('result_view', { hero_id: m.slug, alt_ids: alts.map(x => x.model.slug), alt_roles: alts.map(x => x.role), eligible: r.eligible,
        mode: r.mode, confidence: h.confidence.level, margin: r.margin, ms_to_result: flowStart ? Math.round(performance.now() - flowStart) : null, answers: answersForTrack(), source, pinned: !!A.pin });
    }
    wireResult(r);
    renderFeedback(m.slug);
  }

  function compareTable(all) {
    const rows = [
      ['price', x => priceOf(x.pick) + `<br><span class="muted small">${lat(x.pick.label)}</span>`],
      ['entry', x => money(x.entry)],
      ['pt', x => ptText(x.group)],
      ['warranty', x => (x.model.specs.warranty ? lat(x.model.specs.warranty.values[0].value) : `<span class="muted">${S.not_in_data}</span>`)],
      ['adoption', x => (x.model.registration.count ? num(x.model.registration.count) : `<span class="muted">${S.not_in_data}</span>`)],
      ['evidence', x => levelChip(x.confidence)],
    ];
    return `<div class="table-wrap" tabindex="0" role="region" aria-label="${S.compare_h}"><table class="cmp">
      <thead><tr><td></td>${all.map((x, i) => `<th scope="col" class="${i ? '' : 'is-hero'}">${name(x.model)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([k, f]) => `<tr><th scope="row">${S.rows[k]}</th>${all.map((x, i) => `<td class="${i ? '' : 'is-hero'}">${f(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function wireResult(r) {
    const heroSlug = r.hero.model.slug;
    screen.querySelectorAll('[data-cta]').forEach(b => b.onclick = () => {
      const cta = b.dataset.cta, id = b.dataset.id || r.hero.id;
      const slug = U.models.find(x => x.id === id).slug;
      T.track('cta_click', { cta, model_id: slug });
      if (cta === 'evidence') openEvidence(id, 'result');
      if (cta === 'share') share();
    });
    screen.querySelectorAll('[data-promote]').forEach(b => b.onclick = () => {
      T.track('alt_promote', { from_id: heroSlug, to_id: U.models.find(x => x.id === b.dataset.promote).slug, role: b.dataset.role });
      renderResult('promote', b.dataset.promote);
    });
    screen.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const q = b.dataset.edit; T.track('edit_answer', { q_id: q }); delete A.pin;
      if (q === 'budget') return renderEntry();
      stepIdx = Q.findIndex(x => x.id === q); renderQuestion(Q[stepIdx]);
    });
    $('#restart').onclick = () => { T.track('restart', { from: 'result' }); A = fresh(); renderEntry(); T.track('fmc_view', { entry: 'restart' }); };
    const btn = $('#cmp-btn');
    if (btn) btn.onclick = () => {
      const box = $('#compare'), open = box.hidden;
      box.hidden = !open; btn.setAttribute('aria-expanded', open);
      if (open) T.track('compare_view', { model_ids: [heroSlug, ...r.alternatives.map(x => x.model.slug)] });
    };
  }

  function renderNoMatch(r, silent) {
    go(`
      <section aria-labelledby="h-nm" class="nomatch">
        <p class="eyebrow">${S.nm_eyebrow}</p>
        <h2 id="h-nm">${S.nm_h}</h2>
        <p class="lede">${Object.entries(r.excluded).map(([k, n]) => S.nm_ruled(num(n), S.nm_reason[k] || k)).join(' · ')}</p>
        <div class="options">${r.relax.map(x => `<button class="opt" data-relax="${x.key}"><span class="n">${S.matches(x.count)}</span><span class="t">${S.relax[x.key]}</span></button>`).join('')}</div>
        <div><button class="link-btn" id="restart">${S.restart}</button></div>
      </section>`);
    if (!silent) T.track('no_match_view', { answers: answersForTrack(), relax_keys: r.relax.map(x => x.key) });
    screen.querySelectorAll('[data-relax]').forEach(b => b.onclick = () => {
      const x = r.relax.find(y => y.key === b.dataset.relax);
      T.track('relax_apply', { key: x.key }); Object.assign(A, x.patch); delete A.pin; renderResult('relax');
    });
    $('#restart').onclick = () => { T.track('restart', { from: 'no_match' }); A = fresh(); renderEntry(); };
  }

  /* ---------- evidence sheet ---------- */
  const sheet = $('#sheet');
  function sparkline(last12) {
    if (!last12.length) return '';
    const W = 288, H = 64, gap = 2, bw = (W - gap * (last12.length - 1)) / last12.length, max = Math.max(...last12.map(x => x[1]));
    const bars = last12.map(([mo, v], i) => {
      const h = Math.max(2, (v / max) * (H - 4)), x = i * (bw + gap), y = H - h;
      return `<path class="spark-bar" d="M${x},${H}V${y + 4}q0,-4 4,-4h${bw - 8}q4,0 4,4V${H}Z" tabindex="0"><title>${mo}: ${fmt(v)}</title></path>`;
    }).join('');
    return `<figure class="spark"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${last12.map(([mo, v]) => `${mo}: ${v}`).join(', ')}">${bars}<line x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}" class="spark-base"/></svg>
      <figcaption class="spark-axis label-mono"><span class="ltr">${last12[0][0]}</span><span class="ltr">max ${fmt(max)}</span><span class="ltr">${last12[last12.length - 1][0]}</span></figcaption></figure>`;
  }
  function openEvidence(id, source) {
    const m = U.models.find(x => x.id === id);
    const lim = E.limitOf(A);
    const pick = lastResult && [lastResult.hero, ...lastResult.alternatives].find(x => x && x.id === id);
    const max = Math.max(...m.trims.map(t => t.max));
    const urls = [...new Set(m.trims.flatMap(t => t.urls))];
    const fams = [...new Set(m.trims.flatMap(t => t.sources))].map(srcName);
    const specKeys = ['seats', 'transmission', 'engine_capacity', 'horsepower', 'drive_type', 'warranty', 'fuel_consumption', 'trunk_capacity', 'length', 'electric_range'];
    const have = specKeys.filter(k => m.specs[k]), missing = specKeys.filter(k => !m.specs[k]);
    $('#sheet-body').innerHTML = `
      <p class="eyebrow">${S.ev_title} · ${S.ev_my(m.model_year)}</p>
      <h2 id="sheet-title">${name(m)}</h2>
      <p class="muted small">${S.ev_meta(fams.length, date(m.freshness.price_snapshots.slice(-1)[0].observed_at))}</p>
      <section><h3>${S.ev_versions}</h3><p class="muted small">${S.ev_legend(money(lim))}</p>
        <div class="ladder">${m.trims.map(t => `
          <div class="rung ${t.max > lim ? 'over' : ''} ${t.status === 'AGREED' || t.status === 'NEAR_AGREEMENT' ? '' : 'single'} ${pick && pick.pick.key === t.key ? 'pick' : ''}">
            <span><strong>${lat(t.label)}</strong>${t.powertrain ? ` · ${S.pt[t.powertrain]}` : ''}</span>
            <span>${priceOf(t)}</span>
            <span class="bar"><i style="width:${(t.max / max) * 100}%"></i></span>
            <span class="muted small full">${t.status === 'CONFLICT' ? S.ev_disagree(money(t.min), money(t.max)) : t.sources.length > 1 ? S.ev_agree(lat(t.sources.map(srcName).join(', '))) : S.ev_only(lat(t.sources.map(srcName).join(', ')))}${t.changes.map(c => ` · ${S.ev_changed(money(c.from), money(c.to))}`).join('')}</span>
          </div>`).join('')}</div>
      </section>
      ${m.registration.count ? `<section><h3>${S.ev_adoption_h}</h3><p>${adoptionLine(m)}</p>${sparkline(m.registration.last12)}<p class="muted small">${S.adoption_note}${m.registration.alias_pending_review ? ' ' + S.ev_alias_pending : ''}</p></section>` : ''}
      ${have.length ? `<section><h3>${S.ev_specs_h}</h3><dl class="specs">${have.map(k => `<div><dt>${S.spec[k]}</dt><dd>${m.specs[k].values.map(v => `${lat(v.value)} <span class="muted small">(${lat(v.sources.join(', '))})</span>`).join('<br>')}${m.specs[k].status === 'MULTIPLE_VALUES' ? `<br><span class="muted small">${S.ev_multi}</span>` : ''}</dd></div>`).join('')}</dl></section>` : ''}
      <section><h3>${S.ev_gaps_h}</h3><p>${missing.map(k => S.spec[k]).join(lang === 'ar' ? '، ' : ', ')}</p></section>
      <section><h3>${S.ev_sources_h}</h3><ul class="src-list">${urls.map(u => `<li><a class="ltr" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(u)}</a></li>`).join('')}</ul></section>`;
    sheet.hidden = false; $('.sheet-panel').focus();
    history.pushState({ kind: 'sheet' }, '', location.href);
    T.track('evidence_open', { model_id: m.slug, source });
  }
  const closeSheet = () => { if (sheet.hidden) return; if (history.state && history.state.kind === 'sheet') history.back(); else sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  addEventListener('popstate', e => {
    const st = e.state || { kind: 'entry' };
    if (!sheet.hidden) { sheet.hidden = true; if (st.kind === 'result') return; }
    restoring = true;
    try {
      if (st.kind === 'q' && Q[st.i]) { if (!backViaButton) T.track('q_back', { q_id: Q[st.i].id, step: st.i + 1, via: 'browser' }); stepIdx = st.i; renderQuestion(Q[st.i], true); }
      else if (st.kind === 'result') renderResult('back', A.pin, true);
      else if (st.kind === 'entry') renderEntry(true);
    } finally { restoring = false; backViaButton = false; }
  });

  function share() {
    const url = location.href;
    if (navigator.share) navigator.share({ title: 'CarIndex', url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast(S.share_copied), () => toast(url));
    else toast(url);
  }
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }

  /* ---------- feedback ---------- */
  function renderFeedback(heroId) {
    const fb = $('#fb');
    fb.innerHTML = `
      <h2 id="h-fb" class="h3">${S.fb_q}</h2>
      <div class="fb-opts" role="radiogroup" aria-labelledby="h-fb">
        ${[['yes', S.fb_yes], ['somewhat', S.fb_some], ['no', S.fb_no]].map(([v, l]) => `<button class="opt" role="radio" aria-checked="false" data-h="${v}"><span class="t">${l}</span></button>`).join('')}
      </div>
      <div id="fb-more" hidden>
        <label for="fb-text" class="fb-label">${S.fb_more} <span class="muted">${S.fb_optional}</span></label>
        <textarea id="fb-text" maxlength="500" placeholder="${S.fb_ph}"></textarea>
        <div class="q-actions"><button class="btn btn-dark" id="fb-send">${S.fb_send}</button></div>
      </div>`;
    let helped = null, seen = false;
    const io = 'IntersectionObserver' in window && new IntersectionObserver(es => { if (!seen && es.some(e => e.isIntersecting)) { seen = true; T.track('feedback_view', { hero_id: heroId }); io.disconnect(); } }, { threshold: 0.5 });
    if (io) io.observe(fb);
    fb.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
      helped = b.dataset.h;
      fb.querySelectorAll('[data-h]').forEach(x => x.setAttribute('aria-checked', x === b));
      T.track('feedback_answer', { helped, hero_id: heroId });
      $('#fb-more').hidden = false;
    });
    fb.addEventListener('click', e => {
      if (e.target.id !== 'fb-send') return;
      const text = $('#fb-text').value.trim();
      if (text) T.track('feedback_text', { helped, hero_id: heroId, text_length: text.length, text });
      fb.innerHTML = `<p><strong>${text ? S.fb_thanks : S.fb_thanks_short}</strong></p>`;
    });
  }

  /* ---------- boot ---------- */
  $('#lang-btn').onclick = () => {
    const from = lang; lang = lang === 'en' ? 'ar' : 'en'; store.set('ci_lang', lang);
    applyLang(); T.track('lang_switch', { from, to: lang }); if (current) current();
  };
  applyLang();
  const hash = location.hash.match(/^#a=(.+)$/);
  let restored = null;
  if (hash) { try { restored = JSON.parse(atob(decodeURIComponent(hash[1]))); } catch (e) { restored = null; } }
  if (restored && typeof restored.budget === 'number') { A = restored; T.track('fmc_view', { entry: 'shared_link' }); renderResult('shared_link', A.pin); }
  else { T.track('fmc_view', { entry: 'direct' }); renderEntry(true); }
})();
