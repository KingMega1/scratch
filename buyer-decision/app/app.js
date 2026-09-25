/* Find My Car — buyer-decision vertical slice v1 (EN). */
(function () {
  'use strict';
  const U = window.CI_UNIVERSE;
  const E = window.CIEngine;
  const T = window.CITrack;
  T.setContext({ engine_version: E.ENGINE_VERSION, universe_version: U.meta.universe_version });

  const $ = (s, el = document) => el.querySelector(s);
  const screen = $('#screen');
  const fmt = n => n.toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = m => `${m.brand} ${m.model}`;
  const ICON = {
    person: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    two: '<circle cx="9" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M14 14.5a5.5 5.5 0 0 1 7.5 5.5"/>',
    family: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="14" r="2.2"/><path d="M1.5 20a5.5 5.5 0 0 1 11 0M11.5 20a5.5 5.5 0 0 1 11 0"/>',
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
    suv: '<path d="M3 16v-4l2-5h11l4 5h1v4H3Z"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/>',
    sedan: '<path d="M2 16v-3l3-1 3-4h7l4 4 3 1v3H2Z"/><circle cx="6.5" cy="16.5" r="2"/><circle cx="17.5" cy="16.5" r="2"/>',
    hatch: '<path d="M3 16v-4l3-5h8l5 5h2v4H3Z"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    space: '<path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
  };
  const ic = k => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;

  /* ---------- Flow definition ---------- */
  const Q = [
    { id: 'who', title: 'Who will usually be in the car?', hint: 'This decides how much space matters.', opts: [
      { v: 'solo', t: 'Mostly just me', s: 'Commute, errands', i: 'person' },
      { v: 'couple', t: 'Me and one more', s: 'Partner or friend', i: 'two' },
      { v: 'family', t: 'Family with kids', s: 'School runs, weekends', i: 'family' },
      { v: 'seven', t: 'I need 7 seats', s: 'Big family, carpool', i: 'seven' } ] },
    { id: 'usage', title: 'Where do you drive most?', hint: 'We match the powertrain to your roads.', opts: [
      { v: 'city', t: 'Mostly city', s: 'Traffic, short trips', i: 'city' },
      { v: 'mixed', t: 'City and highway', s: 'Ring Road, New Capital', i: 'mixed' },
      { v: 'long', t: 'Lots of long trips', s: 'Sahel, Ain Sokhna, Upper Egypt', i: 'long' } ] },
    { id: 'charging', filter: true, title: 'Could you charge at home or work?', hint: 'Only matters if an electric car fits your budget.', opts: [
      { v: 'yes', t: 'Yes', s: 'Private parking with power', i: 'plug' },
      { v: 'no', t: 'No', s: 'Street or shared parking', i: 'noplug' },
      { v: 'unsure', t: 'Not sure yet', s: 'Keep electric in the mix', i: 'q' } ] },
    { id: 'powertrain', filter: true, title: 'Any preference on what powers it?', hint: 'Skip this if you are open.', opts: [
      { v: 'petrol', t: 'Petrol', s: 'Familiar, easy to service', i: 'fuel' },
      { v: 'hybrid', t: 'Hybrid', s: 'Less fuel in traffic', i: 'leaf' },
      { v: 'ev', t: 'Electric', s: 'Needs regular charging', i: 'bolt', when: a => a.charging !== 'no' },
      { v: 'any', t: 'No preference', s: 'Show me the best fit', i: 'any' } ] },
    { id: 'body', filter: true, title: 'Which shape do you picture?', hint: 'Pick "No preference" if the right car matters more.', opts: [
      { v: 'suv', t: 'SUV / crossover', s: 'Higher seat, more room', i: 'suv' },
      { v: 'sedan', t: 'Sedan', s: 'Separate boot', i: 'sedan' },
      { v: 'hatch', t: 'Hatchback', s: 'Compact, easy to park', i: 'hatch' },
      { v: 'any', t: 'No preference', s: '', i: 'any' } ] },
    { id: 'priorities', multi: 2, title: 'What matters most to you?', hint: 'Pick up to two. We give them extra weight.', opts: [
      { v: 'pocket', t: 'Keep money in my pocket', s: 'Spend less than the full budget', i: 'wallet' },
      { v: 'space', t: 'Most space', s: 'Body shape and seats', i: 'space' },
      { v: 'proof', t: 'A price I can trust', s: 'Confirmed by several sources', i: 'check' },
      { v: 'warranty', t: 'Longest warranty', s: 'As listed by our sources', i: 'shield' },
      { v: 'markup', t: 'Least dealer mark-up', s: 'Asking price close to official', i: 'tag' } ] },
  ];
  const DEFAULTS = { charging: 'unsure', powertrain: 'any', body: 'any', priorities: [] };

  let A = { budget: U.meta.budget_anchor_egp, stretch: false };
  let stepIdx = 0, stepStart = 0, flowStart = 0, lastResult = null;

  const optsFor = q => q.opts.filter(o => !o.when || o.when(A));
  const countWith = patch => E.countEligible(U, { ...DEFAULTS, ...A, ...patch });

  /* A question is skipped when every option that still has matches leads to the same set size:
     the answer could not change the recommendation. */
  function shouldSkip(q) {
    if (!q.filter) return null; // ranking-only questions are always asked
    const counts = optsFor(q).map(o => ({ v: o.v, n: countWith({ [q.id]: o.v }) }));
    const live = counts.filter(c => c.n > 0);
    if (live.length && live.every(c => c.n === live[0].n)) return live.find(c => c.v === 'any' || c.v === 'unsure')?.v || live[0].v;
    return null;
  }

  function go(html, focusSel) {
    screen.innerHTML = html;
    screen.classList.remove('screen'); void screen.offsetWidth; screen.classList.add('screen');
    const f = $(focusSel || 'h1, h2', screen); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------- Entry ---------- */
  const STRIP_MIN = 1_200_000, STRIP_MAX = 2_800_000;
  const pos = p => ((Math.min(Math.max(p, STRIP_MIN), STRIP_MAX) - STRIP_MIN) / (STRIP_MAX - STRIP_MIN)) * 100;

  function renderEntry() {
    const dots = U.models.map((m, i) => `<span class="dot" data-p="${m.price.official_min}" style="left:${pos(m.price.official_min)}%;top:${22 + (i % 4) * 11}px" title="${esc(name(m))}"></span>`).join('');
    go(`
      <section class="entry" aria-labelledby="h-entry">
        <div>
          <p class="eyebrow">Find My Car</p>
          <h1 id="h-entry">Around EGP 2M.<br>Which car should you buy?</h1>
          <p class="lede">Answer up to six quick taps. You get one clear recommendation, the real alternatives, and the evidence behind each.</p>
        </div>
        <div class="budget-card">
          <div class="budget-row">
            <div><p class="label-mono">Your budget</p><div class="budget-val"><small>EGP</small><span class="num" id="bval"></span></div></div>
            <div class="stepper">
              <button class="icon-btn" id="bminus" aria-label="Lower budget by 100,000">−</button>
              <button class="icon-btn" id="bplus" aria-label="Raise budget by 100,000">+</button>
            </div>
          </div>
          <div class="strip" aria-hidden="true"><span class="band" id="band"></span>${dots}</div>
          <div class="strip-axis label-mono" aria-hidden="true"><span>EGP ${fmt(STRIP_MIN / 1e6)}M</span><span>Each dot = one model's entry price</span><span>${fmt(STRIP_MAX / 1e6)}M</span></div>
          <label class="count-line" style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" id="stretch" style="width:20px;height:20px"> I can stretch about ${Math.round(E.STRETCH * 100)}% for the right car</label>
          <p class="count-line" id="bcount" aria-live="polite"></p>
        </div>
        <div><button class="btn btn-primary" id="start">Find my car</button></div>
        <p class="muted" style="font-size:14px">Prices as seen on 10 Sep 2026 across ${U.meta.models_in_scope} models with at least two sources. We never take money to rank a car.</p>
      </section>`);
    const upd = () => {
      const lim = E.limitOf(A);
      $('#bval').textContent = fmt(A.budget);
      const b = $('#band'); b.style.left = '0%'; b.style.width = pos(lim) + '%';
      screen.querySelectorAll('.dot').forEach(d => d.classList.toggle('in', +d.dataset.p <= lim));
      const n = countWith({});
      $('#bcount').innerHTML = `<b>${n}</b> models in our index start at or under EGP ${fmt(lim)}.`;
      $('#bminus').disabled = A.budget <= U.meta.band_min_egp; $('#bplus').disabled = A.budget >= U.meta.band_max_egp;
    };
    $('#bminus').onclick = () => { A.budget = Math.max(U.meta.band_min_egp, A.budget - 100_000); upd(); };
    $('#bplus').onclick = () => { A.budget = Math.min(U.meta.band_max_egp, A.budget + 100_000); upd(); };
    $('#stretch').checked = A.stretch;
    $('#stretch').onchange = e => { A.stretch = e.target.checked; upd(); };
    $('#start').onclick = () => { T.track('fmc_start', { budget: A.budget, stretch: A.stretch }); flowStart = performance.now(); stepIdx = 0; nextQuestion(0); };
    upd();
  }

  /* ---------- Questions ---------- */
  function visibleTotal() { return Q.length; }

  function nextQuestion(from) {
    for (let i = from; i < Q.length; i++) {
      const q = Q[i];
      const auto = shouldSkip(q);
      if (auto !== null) { A[q.id] = auto; T.track('q_skipped', { q_id: q.id, reason: 'no_effect', value: auto }); continue; }
      stepIdx = i; return renderQuestion(q);
    }
    renderResult('flow');
  }

  function prevQuestion(from) {
    for (let i = from - 1; i >= 0; i--) { if (shouldSkip(Q[i]) === null) { stepIdx = i; return renderQuestion(Q[i]); } }
    renderEntry();
  }

  function renderQuestion(q) {
    const opts = optsFor(q);
    const sel = q.multi ? (A[q.id] || []) : A[q.id];
    const cards = opts.map(o => {
      const n = q.multi ? null : countWith({ [q.id]: o.v });
      const on = q.multi ? sel.includes(o.v) : sel === o.v;
      const dis = n === 0;
      return `<button class="opt" data-v="${o.v}" ${q.multi ? `aria-pressed="${on}"` : `role="radio" aria-checked="${on}"`} ${dis ? 'aria-disabled="true"' : ''}>
        ${n !== null ? `<span class="n">${dis ? '0 matches' : n + (n === 1 ? ' car' : ' cars')}</span>` : ''}
        ${ic(o.i)}<span class="t">${o.t}</span>${o.s ? `<span class="s">${o.s}</span>` : ''}</button>`;
    }).join('');
    go(`
      <section aria-labelledby="h-q">
        <div class="q-top"><button class="link-btn" id="back">← Back</button><span class="label-mono">Step ${stepIdx + 1} of ~${visibleTotal()}</span></div>
        <div class="progress" aria-hidden="true"><i style="width:${((stepIdx + 1) / visibleTotal()) * 100}%"></i></div>
        <div class="q-head"><h2 id="h-q">${q.title}</h2><p class="q-hint">${q.hint}</p></div>
        <div class="options" ${q.multi ? 'role="group"' : 'role="radiogroup"'} aria-labelledby="h-q">${cards}</div>
        ${q.multi ? `<div class="q-actions"><button class="btn btn-primary" id="done">Show my car</button><button class="link-btn" id="skipq">Skip — no priorities</button></div>` : ''}
      </section>`);
    stepStart = performance.now();
    T.track('q_view', { q_id: q.id, step: stepIdx + 1 });
    $('#back').onclick = () => { T.track('q_back', { q_id: q.id, step: stepIdx + 1 }); prevQuestion(stepIdx); };
    screen.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      if (q.multi) {
        let cur = A[q.id] || [];
        cur = cur.includes(b.dataset.v) ? cur.filter(x => x !== b.dataset.v) : cur.concat(b.dataset.v).slice(-q.multi);
        A[q.id] = cur;
        screen.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-pressed', cur.includes(x.dataset.v)));
        return;
      }
      A[q.id] = b.dataset.v;
      screen.querySelectorAll('.opt').forEach(x => x.setAttribute('aria-checked', x === b));
      answered(q, b.dataset.v);
      setTimeout(() => nextQuestion(stepIdx + 1), 180);
    });
    if (q.multi) {
      $('#done').onclick = () => { answered(q, A[q.id] || []); renderResult('flow'); };
      $('#skipq').onclick = () => { A[q.id] = []; answered(q, []); renderResult('flow'); };
    }
  }

  function answered(q, value) {
    T.track('q_answer', { q_id: q.id, step: stepIdx + 1, value, ms_on_step: Math.round(performance.now() - stepStart), eligible_after: countWith({}) });
  }

  /* ---------- Result ---------- */
  const ROLE = { stretch: 'Just over budget', cheaper: 'Costs less', powertrain: 'Different powertrain', space: 'More space', evidence: 'Best-confirmed price', runner_up: 'Runner-up' };
  const PT = { petrol: 'Petrol', hybrid: 'Hybrid', ev: 'Electric' };
  const ptText = r => (r.groups.length ? r.groups.map(g => PT[g]).join(' / ') : '<span class="muted">Not in our data</span>');
  const trimLine = r => `${esc(r.bestTrim.label)} · ${r.model.model_year_latest}`;
  const srcChip = t => t.status === 'verified'
    ? `<span class="chip ok">${ic('check')} ${t.agreeing_sources.length} sources agree</span>`
    : `<span class="chip warn">1 source · ${esc(t.agreeing_sources[0] || '')}</span>`;
  const ANSWER_TEXT = {
    who: { solo: 'Mostly me', couple: 'Two people', family: 'Family', seven: '7 seats' },
    usage: { city: 'City', mixed: 'City + highway', long: 'Long trips' },
    charging: { yes: 'Can charge', no: "Can't charge", unsure: 'Charging: unsure' },
    powertrain: { petrol: 'Petrol', hybrid: 'Hybrid', ev: 'Electric', any: 'Any powertrain' },
    body: { suv: 'SUV', sedan: 'Sedan', hatch: 'Hatchback', any: 'Any shape' },
  };
  const PRIO_TEXT = { pocket: 'Keep money', space: 'Space', proof: 'Trusted price', warranty: 'Warranty', markup: 'Low mark-up' };

  function answersForTrack() { const { pin, ...rest } = A; return rest; }

  function renderResult(source, pin) {
    if (pin !== undefined) A.pin = pin;
    const a = { ...DEFAULTS, ...A };
    const r = E.recommend(U, a);
    lastResult = r;
    history.replaceState(null, '', '#a=' + encodeURIComponent(btoa(JSON.stringify(A))));
    if (!r.hero) return renderNoMatch(r);
    const h = r.hero, m = h.model;
    const alts = r.alternatives;
    const cmpRows = [
      ['Price, fitting trim', x => `<span class="num">EGP ${fmt(x.bestTrim.official_price)}</span><br><span class="muted">${esc(x.bestTrim.label)}</span>`],
      ['Entry price', x => `<span class="num">EGP ${fmt(x.entry)}</span>`],
      ['Trims in budget', x => x.trimsInBudget],
      ['Body', x => esc(x.model.body_type)],
      ['Powertrain', x => ptText(x)],
      ['Seats', x => x.model.seats.length ? esc(x.model.seats.join(', ')) : '<span class="muted">Not in our data</span>'],
      ['Warranty', x => x.model.warranty.length ? esc(x.model.warranty[0]) : '<span class="muted">Not in our data</span>'],
      ['Price confirmed by', x => x.bestTrim.status === 'verified' ? `${x.bestTrim.agreeing_sources.length} sources` : `1 source`],
      ['Dealer mark-up', x => x.model.market_premium_pct_median == null ? '<span class="muted">Not in our data</span>' : `${x.model.market_premium_pct_median}% median`],
      ['Open disagreements', x => x.model.conflicts.length || 'None'],
    ];
    const all = [h, ...alts];
    const answerChips = Q.filter(q => !q.multi).map(q => A[q.id] && ANSWER_TEXT[q.id][A[q.id]] ? `<button class="chip" data-edit="${q.id}">${ANSWER_TEXT[q.id][A[q.id]]}</button>` : '').join('')
      + (A.priorities || []).map(p => `<button class="chip" data-edit="priorities">${PRIO_TEXT[p]}</button>`).join('');
    go(`
      <div class="result">
        <section class="hero" aria-labelledby="h-hero">
          <div class="hero-top">
            <div>
              <p class="eyebrow">Our pick for you</p>
              <h1 id="h-hero" class="hero-name">${esc(name(m))}</h1>
              <p class="hero-trim">${trimLine(h)} · ${esc(m.body_type)} · ${ptText(h)}</p>
            </div>
            <div class="hero-price"><p class="label-mono">Official price, ${esc(h.bestTrim.label)}</p><span class="num">EGP ${fmt(h.bestTrim.official_price)}</span></div>
          </div>
          <div class="chips">
            ${h.bestTrim.status === 'verified' ? `<span class="chip dark">${ic('check')} ${h.bestTrim.agreeing_sources.length} sources agree on this price</span>` : `<span class="chip warn">Price from 1 source only</span>`}
            ${m.has_official_source ? '<span class="chip dark">Includes official distributor</span>' : ''}
            <span class="chip dark">Seen 10 Sep 2026</span>
          </div>
          <div class="cols">
            <div><h3>Why it fits you</h3><ul class="list">${h.why.map(w => `<li><span class="mk good">✓</span><span>${esc(w.text)}</span></li>`).join('')}</ul></div>
            <div><h3>Worth knowing</h3><ul class="list">${(h.compromises.length ? h.compromises : ['Nothing flagged in our data for this model.']).map(c => `<li><span class="mk bad">!</span><span>${esc(c)}</span></li>`).join('')}</ul></div>
          </div>
          <div class="hero-actions">
            <button class="btn btn-on-dark" data-cta="evidence" data-id="${m.id}">See prices, trims & sources</button>
            <button class="btn btn-outline-dark" data-cta="compare">Compare with alternatives</button>
            <button class="btn btn-outline-dark" data-cta="share">Save / share this shortlist</button>
          </div>
        </section>

        ${alts.length ? `<section aria-labelledby="h-alts">
          <div class="section-head"><div><p class="eyebrow">Real alternatives</p><h2 id="h-alts">Why someone would choose differently</h2></div></div>
          <div class="alts">${alts.map(x => `
            <article class="alt">
              <span class="chip ${x.role === 'evidence' ? 'ok' : ''}" style="justify-self:start">${ROLE[x.role]}</span>
              <h3>${esc(name(x.model))}</h3>
              <p class="muted">${trimLine(x)} · ${esc(x.model.body_type)} · ${ptText(x)}</p>
              <p>${x.role === 'cheaper' ? `<span class="label-mono">From</span> <span class="num price">EGP ${fmt(x.entry)}</span>` : `<span class="num price">EGP ${fmt(x.bestTrim.official_price)}</span>`}</p>
              <p class="why">${esc(x.whyInstead)}</p>
              ${x.compromises[0] ? `<p class="muted" style="font-size:14px">But: ${esc(x.compromises[0])}</p>` : ''}
              <div class="foot">${srcChip(x.bestTrim)}</div>
              <div class="foot">
                <button class="btn btn-ghost" data-promote="${x.id}" data-role="${x.role}">Make this my pick</button>
                <button class="link-btn" data-cta="evidence" data-id="${x.id}">Evidence</button>
              </div>
            </article>`).join('')}</div>
        </section>` : ''}

        <section aria-labelledby="h-cmp" id="compare">
          <div class="section-head"><div><p class="eyebrow">Side by side</p><h2 id="h-cmp">Compare</h2></div></div>
          <div class="table-wrap" tabindex="0" role="region" aria-labelledby="h-cmp">
            <table class="cmp">
              <thead><tr><th scope="col"><span class="sr-only">Attribute</span></th>${all.map((x, i) => `<th scope="col" class="${i ? '' : 'is-hero'}">${esc(name(x.model))}${i ? '' : ' <span class="label-mono" style="color:#A7ADB7">Pick</span>'}</th>`).join('')}</tr></thead>
              <tbody>${cmpRows.map(([k, f]) => `<tr><th scope="row">${k}</th>${all.map((x, i) => `<td class="${i ? '' : 'is-hero'}">${f(x)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>
        </section>

        <section class="notice" aria-labelledby="h-unc">
          <span class="ic" aria-hidden="true">i</span>
          <div>
            <strong id="h-unc">What we can't tell you yet</strong>
            <ul>
              <li>Prices are a single snapshot from 10 Sep 2026. Confirm with the dealer before you pay.</li>
              ${h.uncertainty.gaps.length ? `<li>For the ${esc(name(m))}, our sources don't give: ${esc(h.uncertainty.gaps.join(', '))}.</li>` : ''}
              <li>Not in our data for any car: ${esc(U.meta.not_in_data.join(', '))}. None of these affected this recommendation.</li>
              <li>We compared ${r.eligible} model${r.eligible === 1 ? '' : 's'} that match your answers, out of ${U.meta.models_in_scope} with at least two sources in this price band.</li>
            </ul>
          </div>
        </section>

        <section aria-label="Your answers">
          <p class="label-mono" style="margin-bottom:8px">Your answers — tap to change</p>
          <div class="answers"><button class="chip" data-edit="budget">EGP ${fmt(A.budget)}${A.stretch ? ' +10%' : ''}</button>${answerChips}<button class="link-btn" id="restart">Start over</button></div>
        </section>

        <section class="feedback" id="fb" aria-labelledby="h-fb"></section>
      </div>`, '#h-hero');

    T.markResult();
    T.track('result_view', { hero_id: h.id, alt_ids: alts.map(x => x.id), alt_roles: alts.map(x => x.role), eligible: r.eligible, ms_to_result: flowStart ? Math.round(performance.now() - flowStart) : null, answers: answersForTrack(), source, pinned: !!A.pin });
    wireResult(r);
    renderFeedback(h.id);
  }

  function wireResult(r) {
    screen.querySelectorAll('[data-cta]').forEach(b => b.onclick = () => {
      const cta = b.dataset.cta, id = b.dataset.id || r.hero.id;
      T.track('cta_click', { cta, model_id: id });
      if (cta === 'evidence') openEvidence(id, 'result');
      if (cta === 'compare') $('#compare').scrollIntoView({ behavior: 'smooth' });
      if (cta === 'share') share();
    });
    screen.querySelectorAll('[data-promote]').forEach(b => b.onclick = () => {
      T.track('alt_promote', { from_id: r.hero.id, to_id: b.dataset.promote, role: b.dataset.role });
      renderResult('promote', b.dataset.promote);
    });
    screen.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const q = b.dataset.edit; T.track('edit_answer', { q_id: q }); delete A.pin;
      if (q === 'budget') return renderEntry();
      const i = Q.findIndex(x => x.id === q); stepIdx = i; renderQuestion(Q[i]);
    });
    $('#restart').onclick = () => { T.track('restart', { from: 'result' }); A = { budget: U.meta.budget_anchor_egp, stretch: false }; renderEntry(); T.track('fmc_view', { entry: 'restart' }); };
    const cmp = $('#compare');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { T.track('compare_view', { model_ids: [r.hero.id, ...r.alternatives.map(x => x.id)] }); io.disconnect(); } }, { threshold: 0.4 });
      io.observe(cmp);
    }
  }

  function renderNoMatch(r) {
    go(`
      <section aria-labelledby="h-nm" style="max-width:720px;display:grid;gap:24px">
        <p class="eyebrow">No exact match</p>
        <h2 id="h-nm">No car in our index fits every answer.</h2>
        <p class="lede">${Object.entries(r.excluded).map(([k, n]) => `${n} ruled out by ${({ over_budget: 'budget', powertrain: 'powertrain', seats: 'seat count', seats_unknown: 'unknown seat count', body: 'body style', no_charging: 'no charging' })[k] || k}`).join(' · ')}</p>
        <div class="options">${r.relax.map(x => `<button class="opt" data-relax="${x.key}"><span class="n">${x.count} cars</span><span class="t">${x.label}</span></button>`).join('')}</div>
        <div><button class="link-btn" id="restart">Start over</button></div>
      </section>`);
    T.track('no_match_view', { answers: answersForTrack(), relax_keys: r.relax.map(x => x.key) });
    screen.querySelectorAll('[data-relax]').forEach(b => b.onclick = () => {
      const x = r.relax.find(y => y.key === b.dataset.relax);
      T.track('relax_apply', { key: x.key }); Object.assign(A, x.patch); delete A.pin; renderResult('relax');
    });
    $('#restart').onclick = () => { T.track('restart', { from: 'no_match' }); A = { budget: U.meta.budget_anchor_egp, stretch: false }; renderEntry(); };
  }

  /* ---------- Evidence sheet (next decision step) ---------- */
  const sheet = $('#sheet');
  function openEvidence(id, source) {
    const m = U.models.find(x => x.id === id);
    const lim = E.limitOf(A);
    const pick = lastResult && [lastResult.hero, ...lastResult.alternatives].find(x => x && x.id === id);
    const max = Math.max(...m.trims.map(t => t.official_price));
    const urls = [...new Set(m.trims.flatMap(t => t.source_urls))];
    $('#sheet-body').innerHTML = `
      <p class="eyebrow">Evidence · ${esc(m.model_year_latest)} model year</p>
      <h2 id="sheet-title">${esc(name(m))}</h2>
      <p class="muted">${esc(m.body_type)} · official prices from ${m.source_families.length} sources · seen ${esc(m.collection_date.join(', '))}</p>
      <section><h3>Trims and official prices</h3><p class="muted" style="font-size:14px">Blue = at least two sources list the same price. Striped = one source only. Faded = above your EGP ${fmt(lim)} limit.</p>
        <div class="ladder">${m.trims.map(t => `
          <div class="rung ${t.official_price > lim ? 'over' : ''} ${t.status !== 'verified' ? 'single' : ''} ${pick && pick.bestTrim.label === t.label ? 'pick' : ''}">
            <span><strong>${esc(t.label)}</strong>${t.powertrain ? ` · ${t.powertrain}` : ''}${t.label_aliases && t.label_aliases.length ? `<br><span class="muted" style="font-size:13px">Also listed as: ${esc(t.label_aliases.join(', '))}</span>` : ''}</span>
            <span class="num">EGP ${fmt(t.official_price)}</span>
            <span class="bar"><i style="width:${(t.official_price / max) * 100}%"></i></span>
            <span class="muted" style="font-size:13px;grid-column:1/-1">${t.status === 'verified' ? `Agree: ${esc(t.agreeing_sources.join(', '))}` : t.status === 'conflict' ? `Sources differ: also ${t.other_prices.map(fmt).join(', ')}` : `Only ${esc(t.agreeing_sources.join(', '))}`}${t.market_price ? ` · dealer asking EGP ${fmt(t.market_price)}` : ''}</span>
          </div>`).join('')}</div>
        ${m.older_year_listings_excluded ? `<p class="muted" style="font-size:13px;margin-top:8px">${m.older_year_listings_excluded} older model-year listing(s) left out.</p>` : ''}
      </section>
      ${m.conflicts.length ? `<section><h3>Where sources disagree</h3><ul class="src-list">${m.conflicts.map(c => `<li><strong>${esc(c.variant)}</strong>: ${esc(c.note)}</li>`).join('')}</ul></section>` : ''}
      <section><h3>Not in our data</h3><p>${esc(m.gaps.join(', ') || 'No gaps in the fields we track.')}</p></section>
      <section><h3>Sources</h3><ul class="src-list">${urls.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(u)}</a></li>`).join('')}</ul></section>`;
    sheet.hidden = false; $('.sheet-panel').focus();
    T.track('evidence_open', { model_id: id, source });
  }
  sheet.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) sheet.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) sheet.hidden = true; });

  function share() {
    const url = location.href;
    const done = () => toast('Link copied. It opens this exact shortlist.');
    if (navigator.share) navigator.share({ title: 'My CarIndex shortlist', url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url));
    else toast(url);
  }
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }

  /* ---------- Feedback ---------- */
  function renderFeedback(heroId) {
    const fb = $('#fb');
    fb.innerHTML = `
      <h2 id="h-fb" style="font-size:22px">Did this help you get closer to a decision?</h2>
      <div class="fb-opts" role="radiogroup" aria-labelledby="h-fb">
        <button class="opt" role="radio" aria-checked="false" data-h="yes"><span class="t">Yes</span></button>
        <button class="opt" role="radio" aria-checked="false" data-h="somewhat"><span class="t">Somewhat</span></button>
        <button class="opt" role="radio" aria-checked="false" data-h="no"><span class="t">No</span></button>
      </div>
      <div id="fb-more" hidden>
        <label for="fb-text" style="display:block;margin-bottom:8px;font-weight:600">How can we do better? <span class="muted" style="font-weight:400">(optional)</span></label>
        <textarea id="fb-text" maxlength="500" placeholder="What was missing, wrong or confusing? Please don't include your phone number or email."></textarea>
        <div class="q-actions"><button class="btn btn-dark" id="fb-send">Send</button></div>
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
      if (text) T.track('feedback_text', { helped, text_length: text.length, text });
      fb.innerHTML = `<p><strong>Thank you.</strong> ${text ? 'We read every note.' : ''}</p>`;
    });
  }

  $('#method').textContent = `Method: ${U.meta.models_in_scope} models, official prices seen ${U.meta.snapshot.slice(3)}, model-level ranking with no paid inputs. Universe ${U.meta.universe_version} · engine ${E.ENGINE_VERSION}.`;

  /* ---------- Boot ---------- */
  const hash = location.hash.match(/^#a=(.+)$/);
  let restored = null;
  if (hash) { try { restored = JSON.parse(atob(decodeURIComponent(hash[1]))); } catch (e) { restored = null; } }
  if (restored && typeof restored.budget === 'number') {
    A = restored; T.track('fmc_view', { entry: 'shared_link' }); renderResult('shared_link', A.pin);
  } else {
    T.track('fmc_view', { entry: 'direct' }); renderEntry();
  }
})();
