/* Find My Car — P1.1 buyer consultation (EN/AR).
   Brief (free text or quick questions) → only the follow-ups that change the answer → "Here's what we understood"
   → confirm/edit → a few MODELS, why each fits, trade-offs, evidence, next steps. */
(function () {
  'use strict';
  const U = window.CI_UNIVERSE, E = window.CIEngine, T = window.CITrack, I = window.CII18N, P = window.CIBrief;
  T.setContext({ engine_version: E.ENGINE_VERSION, universe_version: U.meta.version });
  const byId = {}; U.models.forEach(m => { byId[m.id] = m; });
  const ON_SALE = U.models.filter(m => m.u).length;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const screen = $('#screen');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('en-US');
  const num = n => `<span class="num">${fmt(n)}</span>`;

  /* ---------- language ---------- */
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } } };
  const qs = new URLSearchParams(location.search);
  let lang = qs.get('lang') || store.get('ci_lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'en');
  if (!I.S[lang]) lang = 'en';
  let S = I.S[lang];
  const money = n => `<span class="money">${S.egp(num(Math.round(n)))}</span>`;
  const millTxt = n => { const v = n / 1e6; return (Math.round(v * 100) / 100).toString(); };
  const mill = n => `<span class="money">${S.mill(`<span class="num">${millTxt(n)}</span>`)}</span>`;
  const nm = id => { const m = byId[id]; return m ? `<span class="ltr">${esc(m.brand)} ${esc(m.model)}</span>` : ''; };
  const nmShort = id => { const m = byId[id]; return m ? `<span class="ltr">${esc(m.model)}</span>` : ''; };
  const lat = s => `<span class="ltr">${esc(s)}</span>`;

  function applyLang() {
    S = I.S[lang];
    const h = document.documentElement;
    h.lang = lang; h.dir = S.dir; h.className = `lang-${lang}`;
    $('#lang-btn').textContent = S.lang_switch;
    $('#lang-btn').lang = lang === 'en' ? 'ar' : 'en';
    $('.skip').textContent = S.skip;
    $('#nav-find').textContent = S.nav_find;
    $('.trust').textContent = S.trust;
    $('#method').textContent = S.method;
    $('.sheet-close').setAttribute('aria-label', S.close);
    document.title = `${S.nav_find} — CarIndex`;
  }

  /* ---------- state + history ---------- */
  // st = { view, q, brief, asked[], path, t0 }
  let st = { view: 'welcome', brief: {}, asked: [], path: 'text' };
  let qStart = Date.now(), t0 = null;
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  const SHARE_KEYS = ['budget', 'budgetMin', 'budgetMode', 'stretch', 'budgetFrom', 'body', 'bodyAny', 'bodyImplied', 'notBody', 'seats', 'who', 'usage', 'pt', 'chinese', 'priorities', 'checks',
    'brandsPrefer', 'brandsExclude', 'shortlist', 'reference', 'aspiration', 'attraction', 'avoid'];
  const slim = b => { const o = {}; SHARE_KEYS.forEach(k => { const v = b[k]; if (v != null && v !== false && !(Array.isArray(v) && !v.length)) o[k] = v; }); return o; };
  function urlFor(s) {
    const p = new URLSearchParams();
    p.set('lang', lang);
    if (s.view === 'result') p.set('r', enc(slim(s.brief)));
    if (qs.get('debug') === '1') p.set('debug', '1');
    return `${location.pathname}?${p}`;
  }
  function go(next, push = true) {
    st = { ...st, ...next };
    const snap = { kind: 'view', st: JSON.parse(JSON.stringify(st)) };
    if (push) history.pushState(snap, '', urlFor(st)); else history.replaceState(snap, '', urlFor(st));
    render();
  }
  addEventListener('popstate', e => {
    const sheet = $('#sheet');
    if (!sheet.hidden) { sheet.hidden = true; if (e.state && e.state.kind === 'view' && e.state.st.view === st.view) return; }
    if (e.state && e.state.kind === 'view') {
      if (st.view === 'q' && e.state.st.view === 'q') T.track('q_back', { q_id: st.q, step: st.asked.length });
      st = e.state.st; render(true);
    }
  });

  function render(fromHistory) {
    applyLang();
    screen.innerHTML = '';
    screen.className = 'screen';
    ({ welcome: renderWelcome, q: renderQ, summary: renderSummary, edit: renderEdit, result: renderResult })[st.view](fromHistory);
    const h = $('h1, h2', screen);
    if (h && !fromHistory) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    scrollTo(0, 0);
  }

  /* ---------- brief helpers ---------- */
  const norm = b => E.normalizeBrief(b, byId);
  // re-derive shortlist/aspiration after a budget change ("GLC" becomes reachable or not)
  function renorm(b) {
    const x = { ...b };
    x.mentions = [...(x.shortlist || []), ...(x.aspiration || [])].map(id => ({ id, role: 'consider' }))
      .concat((x.reference || []).map(id => ({ id, role: 'reference' })));
    x.shortlist = []; x.aspiration = []; x.reference = [];
    if (x.bodyImplied) { delete x.body; delete x.bodyImplied; }
    return norm(x);
  }
  function merge(b, p) {
    const o = { ...b };
    for (const [k, v] of Object.entries(p)) {
      if (k === 'text' || k === 'extracted' || v == null) continue;
      if (Array.isArray(v)) o[k] = [...new Set([...(o[k] || []), ...(k === 'mentions' ? [] : v)])];
      else o[k] = v;
    }
    if (p.mentions) o.mentions = [...(o.mentions || []), ...p.mentions.filter(x => !(o.mentions || []).some(y => y.id === x.id))];
    return o;
  }
  const family = b => (b.who || []).some(w => ['kids', 'family', 'parents'].includes(w));

  function nextQ(brief, asked, path) {
    const nb = norm(brief);
    const derived = nb.budgetFrom && nb.budgetFrom !== 'shortlist';
    if (!asked.includes('budget') && !brief.budget && !derived) return 'budget';
    if ((nb.aspiration || []).length && !nb.attraction && !asked.includes('attraction')) return 'attraction';
    if (!(nb.body && nb.body.length) && !nb.bodyAny && nb.seats !== 7 && !asked.includes('body')) return 'body';
    const bodyAllows7 = !(nb.body && nb.body.length) || nb.body.some(x => x === 'suv' || x === 'mpv');
    if (nb.seats == null && !asked.includes('seats') && bodyAllows7 && (path === 'guided' || family(nb)) && E.material(U, nb, [{ seats: null }, { seats: 7 }])) return 'seats';
    if (!nb.pt && !asked.includes('pt') && E.material(U, nb, [{ pt: 'open' }, { pt: 'no_ev' }, { pt: 'hybrid' }])) return 'pt';
    if (!nb.chinese && !asked.includes('chinese') && E.material(U, nb, [{ chinese: 'open' }, { chinese: 'exclude' }])) return 'chinese';
    if (!nb.usage && !asked.includes('usage') && E.material(U, nb, [{ usage: 'city' }, { usage: 'long' }])) return 'usage';
    if (!asked.includes('priorities') && !(nb.priorities || []).length && !(nb.checks || []).length && E.count(U, nb) > 3) return 'priorities';
    if (!asked.includes('more')) return 'more';
    return null;
  }
  function advance(brief, asked) {
    const q = nextQ(brief, asked, st.path);
    if (q) { qStart = Date.now(); go({ view: 'q', q, brief, asked }); }
    else { const nb = norm(brief); go({ view: 'summary', brief: nb, asked }); }
  }

  /* ---------- welcome ---------- */
  function renderWelcome() {
    T.track('fmc_view', {});
    screen.innerHTML = `
      <section class="welcome">
        <p class="eyebrow">${S.w_eyebrow}</p>
        <h1>${S.w_h1}</h1>
        <p class="lede">${S.w_lede}</p>
        <form id="brief-form" class="brief-card" novalidate>
          <label for="brief" class="fb-label">${S.w_label}</label>
          <textarea id="brief" rows="3" placeholder="${esc(S.w_ph)}" dir="auto">${esc(st.brief && st.brief.text || '')}</textarea>
          <p class="muted small" id="brief-err" hidden>${S.w_empty}</p>
          <div class="q-actions"><button class="btn btn-primary btn-big" type="submit" id="go">${S.w_go}</button></div>
        </form>
        <div>
          <p class="label-mono">${S.w_examples}</p>
          <div class="examples">${S.examples.map((x, i) => `<button type="button" class="chip ex" data-i="${i}">${esc(x)}</button>`).join('')}</div>
        </div>
        <button class="link-btn" id="guided" type="button">${S.w_guided}</button>
        <p class="muted small">${S.w_foot(num(ON_SALE))}</p>
      </section>`;
    $$('.ex', screen).forEach(b => b.addEventListener('click', () => { $('#brief').value = S.examples[+b.dataset.i]; $('#brief').focus(); }));
    $('#brief-form').addEventListener('submit', e => {
      e.preventDefault();
      const text = $('#brief').value.trim();
      if (!text) { $('#brief-err').hidden = false; return; }
      const example = S.examples.includes(text);
      const p = P.parse(text, U.models);
      T.track('fmc_start', { path: 'text' });
      T.track('brief_submit', { chars: text.length, extracted: p.extracted, source: example ? 'example' : 'typed' });
      t0 = Date.now();
      st.path = 'text';
      const brief = merge({ text }, p);
      advance(brief, []);
    });
    $('#guided').addEventListener('click', () => {
      T.track('fmc_start', { path: 'guided' });
      t0 = Date.now();
      st.path = 'guided';
      advance({}, []);
    });
  }

  /* ---------- questions ---------- */
  function heardChips(b) {
    const rows = summaryRows(norm(b)).filter(r => r.key !== 'notes');
    if (!rows.length) return '';
    return `<div class="heard"><span class="muted small">${S.heard}</span> ${rows.map(r => `<span class="chip">${r.value}</span>`).join('')}</div>`;
  }
  function renderQ() {
    const id = st.q, D = S.q[id], step = st.asked.length + 1;
    T.track('q_view', { q_id: id, step });
    const nb = norm(st.brief);
    const top = `<div class="q-top"><button class="link-btn" id="back" type="button">← ${S.back}</button><span class="label-mono">${S.step(step)}</span></div>`;
    const title = typeof D.t === 'function' ? D.t(nm(nb.aspiration[0]) + (nb.aspiration.length > 1 ? ` / ${nmShort(nb.aspiration[1])}` : '')) : D.t;
    const head = `<div class="q-head"><h2 id="h-q">${title}</h2><p class="q-hint">${D.h}</p></div>`;
    let body = '';
    if (id === 'budget') {
      const b = nb.budget || 1500000;
      body = budgetCard(b, nb.budgetMode === 'max' ? 'max' : 'around', !!nb.stretch) + `<div class="q-actions"><button class="btn btn-primary btn-big" id="done" type="button">${S.cont}</button></div>`;
    } else if (id === 'more') {
      body = `<textarea id="more" rows="3" dir="auto" placeholder="${esc(D.ph)}"></textarea>
        <div class="q-actions"><button class="btn btn-primary btn-big" id="done" type="button">${S.cont}</button><button class="link-btn" id="skip" type="button">${S.skip_q}</button></div>`;
    } else if (id === 'priorities') {
      body = `<div class="options">${Object.entries(D.o).map(([k, [t, s]]) => `<button class="opt" type="button" role="checkbox" aria-checked="false" data-v="${k}"><span class="t">${t}</span><span class="s">${s}</span></button>`).join('')}</div>
        <div class="q-actions"><button class="btn btn-primary btn-big" id="done" type="button">${S.cont}</button><button class="link-btn" id="skip" type="button">${S.skip_q}</button></div>`;
    } else {
      body = `<div class="options">${Object.entries(D.o).map(([k, [t, s]]) => `<button class="opt" type="button" data-v="${k}"><span class="t">${t}</span><span class="s">${s}</span></button>`).join('')}</div>`;
    }
    screen.innerHTML = `<section class="question">${top}${step > 1 || st.path === 'text' ? heardChips(st.brief) : ''}${head}${body}</section>`;
    $('#back').addEventListener('click', () => history.back());
    const answer = (value, patch, extraAsked = []) => {
      T.track('q_answer', { q_id: id, step, value, ms_on_step: Date.now() - qStart });
      advance({ ...st.brief, ...patch }, [...st.asked, id, ...extraAsked]);
    };
    if (id === 'budget') {
      wireBudget(screen);
      $('#done').addEventListener('click', () => { const v = readBudget(screen); answer(v.budget, v); });
    } else if (id === 'more') {
      const done = skip => {
        const text = skip ? '' : $('#more').value.trim();
        if (!text) { T.track('q_skipped', { q_id: id, reason: 'skip' }); advance(st.brief, [...st.asked, id]); return; }
        const p = P.parse(text, U.models);
        T.track('q_answer', { q_id: id, step, value: p.extracted.join(',') || 'text', ms_on_step: Date.now() - qStart });
        const b = merge(st.brief, p); b.notes = text;
        advance(b, [...st.asked, id]);
      };
      $('#done').addEventListener('click', () => done(false));
      $('#skip').addEventListener('click', () => done(true));
    } else if (id === 'priorities') {
      const opts = $$('.opt', screen);
      opts.forEach(o => o.addEventListener('click', () => {
        const on = o.getAttribute('aria-checked') === 'true';
        if (!on && opts.filter(x => x.getAttribute('aria-checked') === 'true').length >= 3) return;
        o.setAttribute('aria-checked', String(!on));
      }));
      const done = skip => {
        const v = skip ? [] : opts.filter(x => x.getAttribute('aria-checked') === 'true').map(x => x.dataset.v);
        if (!v.length) { T.track('q_skipped', { q_id: id, reason: 'skip' }); advance(st.brief, [...st.asked, id]); return; }
        answer(v.join(','), { priorities: v.filter(x => P.SCORED.includes(x)), checks: [...new Set([...(st.brief.checks || []), ...v.filter(x => !P.SCORED.includes(x))])] });
      };
      $('#done').addEventListener('click', () => done(false));
      $('#skip').addEventListener('click', () => done(true));
    } else {
      $$('.opt', screen).forEach(o => o.addEventListener('click', () => {
        const v = o.dataset.v;
        o.setAttribute('aria-pressed', 'true');
        const patch = {
          body: v === 'any' ? { body: null, bodyAny: true } : { body: [v], bodyAny: false },
          seats: { seats: v === 'seven' ? 7 : 5 },
          attraction: v === 'design' ? { attraction: v, checks: [...new Set([...(st.brief.checks || []), 'design'])] } : { attraction: v },
          pt: { pt: v }, chinese: { chinese: v }, usage: { usage: v },
        }[id];
        setTimeout(() => answer(v, patch), 120);
      }));
    }
  }

  /* ---------- budget control ---------- */
  function budgetCard(b, mode, stretch) {
    return `<div class="budget-card" data-b="${b}">
      <div class="budget-row">
        <button class="icon-btn" type="button" data-step="-1" aria-label="${esc(S.minus)}">−</button>
        <div class="budget-val" aria-live="polite">${money(b)}</div>
        <button class="icon-btn" type="button" data-step="1" aria-label="${esc(S.plus)}">+</button>
      </div>
      <div class="seg" role="radiogroup">${['around', 'max'].map(k => `<button type="button" role="radio" class="chip seg-b" aria-checked="${mode === k}" data-mode="${k}">${S.e_budget_mode[k]}</button>`).join('')}</div>
      <label class="check-line"><input type="checkbox" id="stretch" ${stretch ? 'checked' : ''} ${mode === 'max' ? '' : 'disabled'}> ${S.e_stretch}</label>
    </div>`;
  }
  function wireBudget(root) {
    const card = $('.budget-card', root);
    const show = () => { $('.budget-val', card).innerHTML = money(+card.dataset.b); };
    $$('[data-step]', card).forEach(btn => btn.addEventListener('click', () => {
      const v = Math.max(300000, Math.min(20000000, +card.dataset.b + (+btn.dataset.step) * E.STEP));
      card.dataset.b = v; show();
    }));
    $$('.seg-b', card).forEach(x => x.addEventListener('click', () => {
      $$('.seg-b', card).forEach(y => y.setAttribute('aria-checked', String(y === x)));
      $('#stretch', card).disabled = x.dataset.mode !== 'max';
    }));
  }
  function readBudget(root) {
    const card = $('.budget-card', root);
    const mode = ($('.seg-b[aria-checked="true"]', card) || {}).dataset.mode || 'around';
    return { budget: +card.dataset.b, budgetMode: mode, stretch: mode === 'max' && $('#stretch', card).checked, budgetMin: null, budgetFrom: null };
  }

  /* ---------- summary ---------- */
  const joinList = a => a.join(lang === 'ar' ? '، ' : ', ');
  function summaryRows(b) {
    const R = [];
    const add = (key, value) => { if (value) R.push({ key, label: S.s_rows[key], value }); };
    if (b.budget) {
      const from = b.budgetFrom === 'shortlist' ? S.s_budget_from_sl : b.budgetFrom && byId[b.budgetFrom] ? S.s_budget_from(nm(b.budgetFrom)) : '';
      const val = b.budgetMode === 'range' && b.budgetMin ? S.s_range(mill(b.budgetMin), mill(b.budget)) : mill(b.budget);
      add('budget', S.s_budget(val, b.budgetMode, b.stretch, from));
    }
    if (b.body && b.body.length) add('body', joinList(b.body.map(x => S.body[x])) + (b.bodyImplied ? ` <span class="muted">(${S.s_body_implied})</span>` : ''));
    else if (b.bodyAny) add('body', S.s_any);
    if (b.seats) add('seats', S.s_seats[b.seats]);
    if ((b.who || []).length) add('who', joinList(b.who.map(w => S.who[w])));
    if (b.usage) add('usage', S.usage_v[b.usage]);
    if (b.pt) add('pt', S.pt_v[b.pt]);
    if (b.chinese) add('chinese', S.chinese_v[b.chinese]);
    if ((b.shortlist || []).length) add('shortlist', joinList(b.shortlist.map(nm)));
    if ((b.reference || []).length) add('reference', joinList(b.reference.map(nm)));
    if ((b.aspiration || []).length) add('aspiration', joinList(b.aspiration.map(nm)) + (b.attraction ? ` — ${S.attr_v[b.attraction]}` : ''));
    if ((b.brandsPrefer || []).length) add('brands', joinList(b.brandsPrefer.map(brandName)));
    const avoid = [...(b.brandsExclude || []).map(brandName), ...(b.avoid || []).map(nm)];
    if (avoid.length) add('avoid', joinList(avoid));
    if ((b.priorities || []).length) add('priorities', joinList(b.priorities.map(p => S.prio_v[p])));
    if ((b.checks || []).length) add('checks', joinList(b.checks.map(p => S.prio_v[p])));
    if (b.notes) add('notes', `<span dir="auto">“${esc(b.notes)}”</span>`);
    return R;
  }
  function brandName(bid) { const m = U.models.find(x => x.brand_id === bid); return m ? lat(m.brand) : esc(bid); }

  function renderSummary() {
    const b = st.brief, rows = summaryRows(b);
    T.track('summary_view', { keys: rows.map(r => r.key) });
    screen.innerHTML = `
      <section class="summary">
        <div class="q-top"><button class="link-btn" id="back" type="button">← ${S.back}</button></div>
        <p class="eyebrow">${S.s_eyebrow}</p>
        <h2 id="h-summary">${S.s_h}</h2>
        <dl class="specs understood">${rows.map(r => `<div><dt>${r.label}</dt><dd>${r.value}</dd></div>`).join('')}</dl>
        <p class="h3">${S.s_q}</p>
        <div class="q-actions"><button class="btn btn-primary btn-big" id="confirm" type="button">${S.s_yes}</button><button class="btn btn-ghost" id="edit" type="button">${S.s_edit}</button></div>
      </section>`;
    $('#back').addEventListener('click', () => history.back());
    $('#confirm').addEventListener('click', () => { T.track('summary_confirm', { keys: rows.map(r => r.key) }); matchingThen(() => go({ view: 'result', matched: true })); });
    $('#edit').addEventListener('click', () => { T.track('summary_edit', {}); go({ view: 'edit', back: 'summary' }); });
  }

  function matchingThen(fn) {
    screen.innerHTML = `<section class="matching" role="status"><p class="match-line">${S.matching(num(ON_SALE))}</p><div class="scan"><i></i></div></section>`;
    setTimeout(fn, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100);
  }

  /* ---------- edit ---------- */
  function renderEdit() {
    const b = st.brief;
    const chipGroup = (name, opts, sel, multi) => `<div class="chips" data-group="${name}" data-multi="${multi ? 1 : 0}">${opts.map(([k, t]) => `<button type="button" class="chip pick" aria-pressed="${sel.includes(k)}" data-v="${k}">${t}</button>`).join('')}</div>`;
    const Q = S.q;
    const bodySel = b.body && b.body.length ? b.body : ['any'];
    screen.innerHTML = `
      <section class="edit">
        <div class="q-top"><button class="link-btn" id="back" type="button">← ${S.back}</button></div>
        <h2 id="h-edit">${S.e_h}</h2>
        <div class="edit-grid">
          <div><p class="fb-label">${S.s_rows.budget}</p>${budgetCard(b.budget || 1500000, b.budgetMode === 'max' ? 'max' : 'around', !!b.stretch)}</div>
          <div><p class="fb-label">${S.s_rows.body}</p>${chipGroup('body', Object.entries(Q.body.o).map(([k, v]) => [k, v[0]]), bodySel, true)}</div>
          <div><p class="fb-label">${S.s_rows.seats}</p>${chipGroup('seats', [['5', S.s_seats[5]], ['7', S.s_seats[7]]], [String(b.seats || '')], false)}</div>
          <div><p class="fb-label">${S.s_rows.pt}</p>${chipGroup('pt', Object.entries(Q.pt.o).map(([k, v]) => [k, v[0]]), [b.pt || ''], false)}</div>
          <div><p class="fb-label">${S.s_rows.chinese}</p>${chipGroup('chinese', Object.entries(Q.chinese.o).map(([k, v]) => [k, v[0]]), [b.chinese || ''], false)}</div>
          <div><p class="fb-label">${S.s_rows.usage}</p>${chipGroup('usage', Object.entries(Q.usage.o).map(([k, v]) => [k, v[0]]), [b.usage || ''], false)}</div>
          <div class="full"><p class="fb-label">${S.s_rows.priorities}</p>${chipGroup('prio', Object.entries(Q.priorities.o).map(([k, v]) => [k, v[0]]), [...(b.priorities || []), ...(b.checks || [])], true)}</div>
          ${(b.aspiration || []).length ? `<div class="full"><p class="fb-label">${S.s_rows.aspiration}: ${joinList(b.aspiration.map(nm))}</p>${chipGroup('attr', Object.entries(Q.attraction.o).map(([k, v]) => [k, v[0]]), [b.attraction || ''], false)}</div>` : ''}
          <div class="full"><p class="fb-label">${S.s_rows.shortlist}</p>
            <div class="chips" id="cars">${[...(b.shortlist || []), ...(b.aspiration || []), ...(b.reference || [])].map(id => `<button type="button" class="chip" data-rm="${id}" aria-label="${esc(S.e_remove(byId[id].brand + ' ' + byId[id].model))}">${nm(id)} ×</button>`).join('')}</div>
            <div class="add-row"><input id="add-car" type="text" dir="auto" placeholder="${esc(S.e_add_ph)}" aria-label="${esc(S.e_add)}"><button type="button" class="btn btn-ghost" id="add-btn">+</button></div>
          </div>
        </div>
        <div class="q-actions"><button class="btn btn-primary btn-big" id="save" type="button">${S.e_save}</button></div>
      </section>`;
    $('#back').addEventListener('click', () => history.back());
    wireBudget(screen);
    $$('[data-group]', screen).forEach(g => g.addEventListener('click', e => {
      const c = e.target.closest('.pick'); if (!c) return;
      const on = c.getAttribute('aria-pressed') === 'true';
      if (g.dataset.multi === '1') {
        if (g.dataset.group === 'body') {
          if (c.dataset.v === 'any') $$('.pick', g).forEach(x => x.setAttribute('aria-pressed', String(x === c)));
          else { $('.pick[data-v="any"]', g).setAttribute('aria-pressed', 'false'); c.setAttribute('aria-pressed', String(!on)); }
        } else c.setAttribute('aria-pressed', String(!on));
      } else $$('.pick', g).forEach(x => x.setAttribute('aria-pressed', String(x === c && !on)));
    }));
    let cars = { shortlist: [...(b.shortlist || [])], aspiration: [...(b.aspiration || [])], reference: [...(b.reference || [])] };
    $('#cars').addEventListener('click', e => {
      const c = e.target.closest('[data-rm]'); if (!c) return;
      for (const k of Object.keys(cars)) cars[k] = cars[k].filter(x => x !== c.dataset.rm);
      c.remove();
    });
    const addCar = () => {
      const p = P.parse($('#add-car').value, U.models);
      (p.mentions || []).forEach(x => { if (![...cars.shortlist, ...cars.aspiration, ...cars.reference].includes(x.id)) { cars.shortlist.push(x.id); $('#cars').insertAdjacentHTML('beforeend', `<button type="button" class="chip" data-rm="${x.id}">${nm(x.id)} ×</button>`); } });
      $('#add-car').value = '';
    };
    $('#add-btn').addEventListener('click', addCar);
    $('#add-car').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCar(); } });
    $('#save').addEventListener('click', () => {
      const sel = g => $$(`[data-group="${g}"] .pick[aria-pressed="true"]`, screen).map(x => x.dataset.v);
      const nb = { ...b, ...readBudget(screen), budgetFrom: null };
      const body = sel('body');
      nb.body = body.includes('any') || !body.length ? null : body; nb.bodyAny = !nb.body; nb.bodyImplied = false;
      nb.seats = sel('seats')[0] ? +sel('seats')[0] : null;
      nb.pt = sel('pt')[0] || null; nb.chinese = sel('chinese')[0] || null; nb.usage = sel('usage')[0] || null;
      const pr = sel('prio'); nb.priorities = pr.filter(x => P.SCORED.includes(x)); nb.checks = pr.filter(x => !P.SCORED.includes(x));
      if ((b.aspiration || []).length) nb.attraction = sel('attr')[0] || null;
      Object.assign(nb, cars);
      const out = renorm(nb);
      if (!nb.body) { out.body = null; out.bodyAny = true; out.bodyImplied = false; }
      T.track('brief_edit_save', { changed: Object.keys(slim(out)).filter(k => JSON.stringify(slim(out)[k]) !== JSON.stringify(slim(b)[k])) });
      go({ view: 'summary', brief: out });
    });
  }

  /* ---------- result pieces ---------- */
  function warrantyTxt(m) {
    if (!m.warranty_years) return null;
    const raw = (m.warranty || []).join(' ');
    const km = raw.match(/(\d{1,3}(?:,\d{3})+|\d{5,6})\s*km/i);
    return S.warranty_v(`<span class="num">${m.warranty_years}</span>`, km ? num(+km[1].replace(/,/g, '')) : null);
  }
  const pts = trims => { const s = new Set(); trims.forEach(t => s.add(t.plugin ? 'plugin' : t.pt)); return [...s].filter(Boolean); };

  function reasons(p, r) {
    const m = byId[p.id], b = r.brief, B = r.terr.budget, out = [];
    const tr = lat(p.pick.label);
    const d = p.price - B;
    if (Math.abs(d) <= B * 0.01) out.push(S.why.budget_at({ trim: tr, price: money(p.price) }));
    else if (d < 0) out.push(S.why.budget_under({ trim: tr, price: money(p.price), amount: money(-d) }));
    else out.push(S.why.budget_over({ trim: tr, price: money(p.price), amount: money(d) }));
    if (b.seats === 7 && p.seven) out.push(S.why.seven({ family: family(b) || (b.who || []).includes('wife') }));
    if (p.ref && p.ref.kind && p.ref.diff === 0) out.push(S.why.ref_same({ ref: nm(p.ref.ids[0]) }));
    if (p.ref && p.ref.diff > 0 && ((b.priorities || []).includes('space') || b.seats === 7)) out.push(S.why.ref_bigger({ ref: nm(p.ref.ids[0]) }));
    const pr = b.priorities || [], parts = p.parts || {};
    if (pr.includes('space') && parts.space >= 0.6 && p.sizeKey) out.push(S.why.space({ size: S.size(p.sizeKey) }));
    if (pr.includes('easy') && parts.easy >= 0.6 && p.sizeKey) out.push(S.why.easy({ size: S.size(p.sizeKey) }));
    if (pr.includes('performance') && parts.perf >= 0.6 && p.hp) out.push(S.why.perf({ hp: num(p.hp) }));
    if (pr.includes('warranty') && parts.warranty >= 0.6 && p.warranty) out.push(S.why.warranty({ w: warrantyTxt(m) }));
    if (pr.includes('pocket') && p.entry < B) out.push(S.why.pocket({ entry: money(p.entry), amount: money(B - p.entry) }));
    if (pr.includes('popular') && m.reg && m.reg.rank_in_body_last12) out.push(S.why.popular({ rank: num(m.reg.rank_in_body_last12), of: num(m.reg.of_body), body: S.body_pl[m.body] }));
    if ((b.pt === 'hybrid' || pr.includes('economy') || b.usage === 'city') && p.hybrid) out.push(S.why.hybrid());
    else if (b.usage === 'city' && p.anyEv && b.pt === 'open') out.push(S.why.ev_city());
    if ((b.brandsPrefer || []).includes(m.brand_id)) out.push(S.why.brand({ brand: lat(m.brand) }));
    const asp = (b.aspiration || []).map(id => byId[id]).filter(Boolean);
    if (asp.length && b.attraction) {
      const a = asp[0];
      if (b.attraction === 'brand' && a.brand_id === m.brand_id) out.push(S.why.attr_brand({ brand: lat(m.brand), asp: nm(a.id) }));
      else if (b.attraction === 'brand' && a.origin === m.origin) out.push(S.why.attr_origin({ origin: S.origin(m.origin), asp: nm(a.id) }));
      else if (b.attraction === 'premium' && p.premium) out.push(S.why.attr_premium({ asp: nm(a.id) }));
      else if (b.attraction === 'performance' && p.hp) out.push(S.why.attr_perf({ hp: num(p.hp) }));
      else if (b.attraction === 'size' && p.ref && p.ref.diff >= 0 && p.sizeKey) out.push(S.why.space({ size: S.size(p.sizeKey) }));
    }
    if (out.length < 3 && m.reg && m.reg.trend !== 'new' && (m.reg.last12 || 0) >= 300) out.push(S.why.established({ n: num(m.reg.last12) }));
    if (out.length < 3 && p.warranty >= 5 && !pr.includes('warranty')) out.push(S.why.warranty_d({ w: warrantyTxt(m) }));
    return [...new Set(out)].slice(0, 5);
  }

  function trades(p, r) {
    const m = byId[p.id], b = r.brief, B = r.terr.budget, out = [];
    if (p.overBudget <= 0 && p.headroom < B * 0.03) out.push(S.trade.full());
    const higher = p.all.find(t => t.min > p.pick.min);
    if (p.fit.length === 1 && higher) out.push(S.trade.entry_only({ trim: lat(p.pick.label), price: money(higher.min) }));
    if (b.usage === 'city' && p.petrolOnly) out.push(S.trade.petrol_city());
    if (p.ev && b.usage === 'long') out.push(S.trade.ev_long());
    else if (p.ev && b.pt !== 'open' && b.pt !== 'ev') out.push(S.trade.ev_charge());
    if (p.ref && p.ref.diff < 0) out.push(S.trade.ref_smaller({ ref: nm(p.ref.ids[0]) }));
    if (p.ref && p.ref.diff > 0 && !((b.priorities || []).includes('space') || b.seats === 7)) out.push(S.trade.ref_bigger({ ref: nm(p.ref.ids[0]) }));
    if (m.reg && m.reg.trend === 'new') out.push(S.trade.new_model({ month: S.month(m.reg.first_month) }));
    else if (!m.reg || (m.reg.last12 || 0) < 100) out.push(S.trade.low_presence({ n: num((m.reg && m.reg.last12) || 0) }));
    if (family(b) && b.seats !== 7 && m.seats && Math.max(...m.seats) <= 5) out.push(S.trade.not_seven_family());
    return out.slice(0, 4);
  }

  function imageBlock(m, cls) {
    if (!m.image) return '';
    return `<figure class="${cls}"><img src="${esc(m.image.src)}" alt="${esc(m.brand + ' ' + m.model)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">
      <figcaption><a href="${esc(m.image.page)}" target="_blank" rel="noopener">${esc(S.photo(m.image.credit))}</a></figcaption></figure>`;
  }

  function specs(p) {
    const m = byId[p.id], rows = [];
    if (p.sizeKey) rows.push([S.sp.size, S.size(p.sizeKey)]);
    if (m.seats) rows.push([S.sp.seats, m.seats.map(num).join(' / ')]);
    const pt = pts(p.fit.length ? p.fit : p.all);
    if (pt.length) rows.push([S.sp.pt, joinList(pt.map(x => S.pt[x]))]);
    if (m.hp && m.hp.length) rows.push([S.sp.hp, S.hp(num(Math.max(...m.hp)))]);
    const w = warrantyTxt(m); if (w) rows.push([S.sp.warranty, w]);
    if (m.model_year) rows.push([S.sp.year, `<span class="num">${m.model_year}</span>`]);
    if (m.distributor) rows.push([S.sp.distributor, lat(m.distributor)]);
    return `<dl class="specs">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  }

  function versionsBlock(p, r) {
    const above = p.all.filter(t => t.min > r.terr.ceil);
    return `<ul class="vers">${p.fit.map(t => `<li class="${t === p.pick || (t.label === p.pick.label && t.min === p.pick.min) ? 'pick' : ''}"><span class="ltr">${esc(t.label)}</span><span>${money(t.min)}${t.official ? ` <span class="chip ok tiny">${S.official}</span>` : ''}</span></li>`).join('')}</ul>
      ${above.length ? `<p class="muted small">${S.above_range(money(Math.min(...above.map(t => t.min))))}</p>` : ''}`;
  }

  function marketBlock(m) {
    const g = m.reg;
    if (!g || !g.since_2021) return '';
    const tags = [];
    if (g.rank_in_body_last12 && g.rank_in_body_last12 <= 10) tags.push(S.mk.popular({ rank: num(g.rank_in_body_last12), of: num(g.of_body), body: S.body_pl[m.body] }));
    const years = Object.keys(g.yearly || {}).sort();
    if (years.length >= 5 && years[0] === '2021' && years.every(y => g.yearly[y] > 0)) tags.push(S.mk.consistent);
    if (g.trend === 'new') tags.push(S.mk.new({ month: S.month(g.first_month) }));
    else if (g.trend && S.mk[g.trend] && typeof S.mk[g.trend] === 'string') tags.push(S.mk[g.trend]);
    const max = Math.max(1, ...years.map(y => g.yearly[y]));
    const bars = years.map(y => `<div class="yb" title="${y}: ${fmt(g.yearly[y])}"><i style="height:${Math.max(2, Math.round(g.yearly[y] / max * 56))}px"></i><span class="num">${y === '2026' ? S.mk_year_partial(y) : y}</span><span class="num v">${fmt(g.yearly[y])}</span></div>`).join('');
    return `<div class="market">${tags.length ? `<div class="chips">${tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
      <p class="small">${S.mk_line({ last12: num(g.last12 || 0), total: num(g.since_2021) })}</p>
      <div class="years" dir="ltr">${bars}</div></div>`;
  }

  function nextSteps(p) {
    const m = byId[p.id];
    const off = p.fit.find(t => t.official);
    return `<p class="small">${off && m.distributor ? S.next_official({ d: lat(m.distributor), date: S.month(off.date.slice(0, 7)) }) : S.next_generic}</p>`;
  }

  function detail(p, r, dark) {
    const why = reasons(p, r), tr = trades(p, r);
    const mk = dark ? 'mk' : 'mk light';
    return `
      <div class="cols">
        <div><h3>${S.why_h}</h3><ul class="list">${why.map(x => `<li><span class="${mk} good" aria-hidden="true">✓</span><span>${x}</span></li>`).join('')}</ul></div>
        ${tr.length ? `<div><h3>${S.trade_h}</h3><ul class="list">${tr.map(x => `<li><span class="${mk} bad" aria-hidden="true">!</span><span>${x}</span></li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="cols">
        <div><h3>${S.versions_h}</h3>${versionsBlock(p, r)}</div>
        <div><h3>${S.specs_h}</h3>${specs(p)}</div>
      </div>
      ${marketBlock(byId[p.id]) ? `<div><h3>${S.market_h}</h3>${marketBlock(byId[p.id])}</div>` : ''}
      <div><h3>${S.next_h}</h3>${nextSteps(p)}</div>`;
  }

  function vsLine(p, hero) {
    const H = nm(hero.id);
    return (p.vs || []).slice(0, 3).map(d => S.vs[d.k]({ hero: H, amount: money(d.v || 0), a: num(d.a || 0), h: num(d.h || 0) }));
  }

  /* ---------- result ---------- */
  function renderResult(fromHistory) {
    const b = st.brief;
    const r = E.recommend(U, b);
    const topCards = [];
    // aspiration
    if (r.aspiration) {
      for (const a of r.aspiration) {
        if (!a.entry) continue;
        const cb = a.cheapestBrand && a.cheapestBrand.id !== a.id && a.cheapestBrand.p > r.terr.ceil ? `<p>${S.asp_brand({ brand: lat(byId[a.id].brand), n: nm(a.cheapestBrand.id), price: money(a.cheapestBrand.p) })}</p>` : '';
        topCards.push(`<section class="note-card"><h3>${S.asp_h(nm(a.id))}</h3><p>${S.asp_line({ n: nm(a.id), entry: money(a.entry), times: num(a.times), budget: mill(r.terr.budget) })}</p>${cb}
          ${b.attraction ? `<p>${S.asp_attr({ what: S.attr_v[b.attraction] })}</p>` : ''}</section>`);
        break;
      }
    }
    if (r.shortlist) topCards.push(shortlistCard(r));
    (r.unmet || []).forEach(u => topCards.push(`<div class="notice"><span class="ic" aria-hidden="true">i</span><p>${S.unmet[u.key]({ n: u.nearest ? nm(u.nearest.id) : '', price: u.nearest ? money(u.nearest.p) : '' })}</p></div>`));
    if (r.widened) topCards.push(`<div class="notice"><span class="ic" aria-hidden="true">i</span><p>${S.widened}</p></div>`);

    const briefBar = `
      <section class="brief-bar">
        <div class="section-head"><h2 class="h3" id="h-result">${S.r_based}</h2>
          <div class="hero-actions"><button class="link-btn" id="edit" type="button">${S.r_edit}</button><button class="link-btn" id="share" type="button">${S.share}</button><button class="link-btn" id="restart" type="button">${S.r_restart}</button></div></div>
        <div class="budget-inline"><span class="label-mono">${S.r_budget}</span>
          <button class="icon-btn" type="button" data-adj="-1" aria-label="${esc(S.minus)}">−</button><span class="price-big" id="bud">${mill(r.terr.budget)}</span><button class="icon-btn" type="button" data-adj="1" aria-label="${esc(S.plus)}">+</button></div>
        <div class="answers chips">${summaryRows(b).filter(x => !['budget', 'notes'].includes(x.key)).map(x => `<span class="chip"><span class="muted">${x.label}:</span> ${x.value}</span>`).join('')}</div>
      </section>`;

    if (!r.hero) {
      const fixes = r.nearest || [];
      T.track('no_match_view', { brief: slim(b), fix_keys: fixes.map(f => f.key) });
      screen.innerHTML = `<div class="result">${briefBar}${topCards.join('')}
        <section class="nomatch"><h2>${S.nomatch_h}</h2><p>${S.nomatch_p}</p>
        <div class="chips">${fixes.map(f => `<button class="btn btn-ghost" type="button" data-fix="${f.key}" data-to="${f.to || ''}">${f.key === 'budget' ? S.fix.budget(mill(f.to)) : S.fix[f.key](num(f.n))}</button>`).join('')}</div></section></div>`;
      wireResultBar(r);
      $$('[data-fix]', screen).forEach(x => x.addEventListener('click', () => {
        const k = x.dataset.fix; T.track('relax_apply', { key: k });
        const nb = { ...b };
        if (k === 'seats') nb.seats = null; if (k === 'chinese') nb.chinese = 'open'; if (k === 'powertrain') nb.pt = 'open';
        if (k === 'body') { nb.body = null; nb.bodyAny = true; } if (k === 'brand') nb.brandsExclude = [];
        if (k === 'budget') nb.budget = +x.dataset.to;
        go({ view: 'result', brief: k === 'budget' ? renorm(nb) : nb });
      }));
      return;
    }

    const h = r.hero, m = byId[h.id];
    const heroYours = (b.shortlist || []).includes(h.id);
    const alts = r.alts;
    const checks = [...new Set([...(b.checks || []).filter(c => S.check[c]), 'test', 'terms'])];
    screen.innerHTML = `
      <div class="result reveal">
        ${briefBar}
        ${topCards.join('')}
        <article class="hero">
          ${imageBlock(m, 'hero-img r1')}
          <div class="hero-top r2">
            <div>
              <p class="eyebrow">${heroYours ? S.eyebrow_hero_yours : S.eyebrow_hero}</p>
              <h2 class="hero-name" id="h-hero">${nm(h.id)}</h2>
              <p class="hero-trim">${h.sizeKey ? S.size(h.sizeKey) : ''}</p>
            </div>
            <div class="hero-price">
              <p class="label-mono">${S.suggested} · ${lat(h.pick.label)}</p>
              <p class="price-big">${money(h.price)}</p>
              <p class="small muted-dark">${S.in_range}: ${S.from_to(money(h.fit[0].min), money(h.fit[h.fit.length - 1].min))}</p>
            </div>
          </div>
          <div class="r3 hero-detail">${detail(h, r, true)}</div>
        </article>
        ${alts.length ? `<section class="r4"><div class="section-head"><h2 class="h3">${S.alts_h}</h2>${alts.length ? `<button class="link-btn" id="cmp-btn" type="button" aria-expanded="false">${S.compare}</button>` : ''}</div>
          <div class="alts">${alts.map(a => altCard(a, h, r)).join('')}</div>
          <div id="compare" hidden>${compareTable([h, ...alts], r)}</div></section>` : ''}
        ${r.less ? `<section class="note-card r4"><h3>${S.less_h}</h3><p>${S.less_line({ n: nm(r.less.id), price: money(r.less.price), saves: money(r.less.saves), seven: r.less.seven && b.seats === 7, same: r.less.sameSize })}</p>
          <button class="link-btn" type="button" data-detail="${r.less.id}">${S.details}</button></section>` : ''}
        <section class="note-card r5"><h3>${S.check_h}</h3><ul class="checks">${checks.map(c => `<li>${S.check[c]}</li>`).join('')}</ul></section>
        <section class="feedback r5" id="fb" aria-labelledby="fb-q">
          <p class="h3" id="fb-q">${S.fb_q}</p>
          <div class="fb-opts">${['yes', 'somewhat', 'no'].map(k => `<button class="opt" type="button" data-h="${k}" aria-pressed="false">${S.fb[k]}</button>`).join('')}</div>
          <div id="fb-more" hidden><label class="fb-label" for="fb-text">${S.fb_more}</label><textarea id="fb-text" dir="auto"></textarea>
            <div class="q-actions"><button class="btn btn-dark" id="fb-send" type="button">${S.fb_send}</button></div></div>
          <p id="fb-thanks" hidden>${S.fb_thanks}</p>
        </section>
      </div>`;
    if (fromHistory) screen.querySelector('.result').classList.remove('reveal');
    wireResultBar(r);
    T.markResult();
    T.track('result_view', { hero_id: h.id, alt_ids: alts.map(a => a.id), pool: r.pool, ms_to_result: t0 ? Date.now() - t0 : null, brief: slim(b) });
    T.track('feedback_view', { hero_id: h.id });
    $$('[data-detail]', screen).forEach(x => x.addEventListener('click', () => openDetail(x.dataset.detail, r)));
    const cb = $('#cmp-btn');
    if (cb) cb.addEventListener('click', () => {
      const box = $('#compare'); box.hidden = !box.hidden; cb.setAttribute('aria-expanded', String(!box.hidden));
      cb.textContent = box.hidden ? S.compare : S.compare_hide;
      if (!box.hidden) T.track('compare_view', { model_ids: [h.id, ...alts.map(a => a.id)] });
    });
    let helped = null;
    $$('[data-h]', screen).forEach(x => x.addEventListener('click', () => {
      helped = x.dataset.h;
      $$('[data-h]', screen).forEach(y => y.setAttribute('aria-pressed', String(y === x)));
      T.track('feedback_answer', { helped, hero_id: h.id });
      $('#fb-more').hidden = false;
    }));
    $('#fb-send').addEventListener('click', () => {
      const t = $('#fb-text').value.trim();
      T.track('feedback_text', { helped, hero_id: h.id, text_length: t.length, text: t.slice(0, 1000) });
      $('#fb-more').hidden = true; $('#fb-thanks').hidden = false;
    });
  }

  function shortlistCard(r) {
    const s = r.shortlist, lines = [];
    if (s.winner && s.second) {
      const a = nm(s.winner), bb = nm(s.second);
      lines.push(`<p class="verdict">${s.close ? S.sl_close({ a, b: bb, edge: S.sl_edge[s.edge] || S.sl_edge.budget }) : S.sl_win({ a, b: bb })}</p>`);
      if (!s.close && s.diffs.length) lines.push(`<ul class="vs">${s.diffs.slice(0, 3).map(d => `<li>${S.vs[d.k]({ hero: bb, amount: money(d.v || 0), a: num(d.a || 0), h: num(d.h || 0) })}</li>`).join('')}</ul>`);
      lines.push(`<ul class="vs">${s.picks.map(p => `<li>${nm(p.id)}: ${S.sl_budget_line({ trim: lat(p.trim), price: money(p.price) })}</li>`).join('')}</ul>`);
    } else if (s.winner) lines.push(`<p class="verdict">${S.sl_one({ a: nm(s.winner) })}</p>`);
    s.rows.filter(x => !x.ok).forEach(x => lines.push(`<p>${(S.sl_out[x.why] || S.sl_out.not_on_sale)({ n: nm(x.id), entry: x.entry ? money(x.entry) : '' })}</p>`));
    if (s.heroOutside && r.hero) {
      // why the recommendation beats the buyer's best named car: the named car's differences, turned around
      const INV = { smaller: 'bigger', bigger: 'smaller', less_hp: 'more_hp', more_hp: 'less_hp', shorter_warranty: 'longer_warranty', longer_warranty: 'shorter_warranty', cheaper: 'dearer', dearer: 'cheaper' };
      const named = r.alts.find(a => a.id === s.winner);
      const good = ['bigger', 'more_hp', 'longer_warranty', 'cheaper', 'seven', 'hybrid'];
      const inv = (named && named.vs || []).map(d => ({ ...d, k: INV[d.k] || null, a: d.h, h: d.a })).filter(d => good.includes(d.k));
      const why = inv.length ? joinList(inv.slice(0, 3).map(d => S.vs[d.k]({ hero: nm(s.winner), amount: money(d.v || 0), a: num(d.a || 0), h: num(d.h || 0) }))) + '.' : (reasons(r.hero, r).slice(1, 2)[0] || reasons(r.hero, r)[0]);
      lines.push(`<p>${S.sl_also({ n: nm(s.heroOutside), why })}</p>`);
    }
    return `<section class="note-card verdict-card"><h3>${S.sl_h}</h3>${lines.join('')}</section>`;
  }

  function altCard(a, h, r) {
    const m = byId[a.id];
    const why = reasons(a, r).slice(0, 2), vs = vsLine(a, h);
    return `<article class="alt">
      ${imageBlock(m, 'alt-img')}
      <span class="chip role">${S.role[a.role] || S.role.runner_up}</span>
      <h3>${nm(a.id)}</h3>
      <p class="muted small">${a.sizeKey ? S.size(a.sizeKey) : ''}</p>
      <p class="alt-price">${money(a.price)} <span class="label-mono">${lat(a.pick.label)}</span></p>
      <ul class="vs">${why.map(x => `<li>${x}</li>`).join('')}</ul>
      ${vs.length ? `<ul class="vs muted">${vs.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      <div class="foot"><button class="btn btn-ghost" type="button" data-detail="${a.id}">${S.details}</button></div>
    </article>`;
  }

  function compareTable(list, r) {
    const row = (label, f) => `<tr><th scope="row">${label}</th>${list.map((p, i) => `<td class="${i ? '' : 'is-hero'}">${f(p) || '—'}</td>`).join('')}</tr>`;
    return `<div class="table-wrap"><table class="cmp"><thead><tr><th></th>${list.map((p, i) => `<th class="${i ? '' : 'is-hero'}" scope="col">${nm(p.id)}</th>`).join('')}</tr></thead><tbody>
      ${row(S.suggested, p => `${money(p.price)}<br><span class="muted small ltr">${esc(p.pick.label)}</span>`)}
      ${row(S.in_range, p => S.from_to(money(p.fit[0].min), money(p.fit[p.fit.length - 1].min)))}
      ${row(S.sp.size, p => (p.sizeKey ? S.size(p.sizeKey) : ''))}
      ${row(S.sp.seats, p => { const m = byId[p.id]; return m.seats ? m.seats.map(num).join(' / ') : ''; })}
      ${row(S.sp.pt, p => joinList(pts(p.fit).map(x => S.pt[x])))}
      ${row(S.sp.hp, p => (p.hp ? S.hp(num(p.hp)) : ''))}
      ${row(S.sp.warranty, p => warrantyTxt(byId[p.id]))}
      ${row(S.market_h, p => { const g = byId[p.id].reg; return g ? S.mk_line({ last12: num(g.last12 || 0), total: num(g.since_2021 || 0) }) : ''; })}
    </tbody></table></div>`;
  }

  function wireResultBar(r) {
    $('#edit').addEventListener('click', () => { T.track('cta_click', { cta: 'edit', model_id: r.hero ? r.hero.id : null }); go({ view: 'edit' }); });
    $('#restart').addEventListener('click', () => { T.track('restart', { from: 'result' }); go({ view: 'welcome', brief: {}, asked: [] }); });
    $('#share').addEventListener('click', () => {
      T.track('cta_click', { cta: 'share', model_id: r.hero ? r.hero.id : null });
      const url = location.href;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast(S.copied)).catch(() => prompt('', url));
    });
    $$('[data-adj]', screen).forEach(x => x.addEventListener('click', () => {
      const from = st.brief.budget;
      const to = Math.max(300000, from + (+x.dataset.adj) * E.STEP);
      T.track('budget_adjust', { from, to });
      go({ view: 'result', brief: renorm({ ...st.brief, budget: to, budgetMin: null, budgetFrom: null }) }, false);
    }));
  }

  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1800); }

  /* ---------- detail sheet ---------- */
  const sheet = $('#sheet');
  function openDetail(id, r) {
    const p = [r.hero, ...r.alts].find(x => x.id === id) || packFor(id, r);
    const m = byId[id];
    T.track('evidence_open', { model_id: id, source: p.role || 'less' });
    $('#sheet-body').innerHTML = `${imageBlock(m, 'hero-img')}<p class="eyebrow">${p.sizeKey ? S.size(p.sizeKey) : ''}</p><h2 id="sheet-title">${nm(id)}</h2>
      <p class="price-big">${money(p.price)} <span class="label-mono">${lat(p.pick.label)}</span></p>${detail(p, r, false)}`;
    sheet.hidden = false; $('.sheet-panel').focus();
    history.pushState({ kind: 'sheet' }, '', location.href);
  }
  // the "spend less" car is outside the ranked pool: rank it alone against the same brief
  function packFor(id, r) {
    const b = { ...r.brief, budget: Math.max(...E.currentTrims(byId[id]).map(t => t.min)), budgetMode: 'around', shortlist: [], aspiration: [], reference: r.brief.reference };
    const x = E.recommend({ meta: U.meta, models: [byId[id], ...U.models.filter(mm => (r.brief.reference || []).includes(mm.id) && mm.id !== id)] }, b);
    const p = x.hero && x.hero.id === id ? x.hero : x.alts.find(a => a.id === id);
    return p || { id, pick: E.currentTrims(byId[id])[0], price: r.less.price, fit: E.currentTrims(byId[id]), all: E.currentTrims(byId[id]), parts: {}, vs: [] };
  }
  const closeSheet = () => { if (sheet.hidden) return; if (history.state && history.state.kind === 'sheet') history.back(); else sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  /* ---------- header ---------- */
  $('#lang-btn').addEventListener('click', () => {
    const from = lang; lang = lang === 'en' ? 'ar' : 'en'; store.set('ci_lang', lang);
    T.track('lang_switch', { from, to: lang });
    history.replaceState(history.state, '', urlFor(st));
    render(true);
  });
  $('.logo').addEventListener('click', e => { e.preventDefault(); T.track('restart', { from: 'logo' }); go({ view: 'welcome', brief: {}, asked: [] }); });
  $('#nav-find').addEventListener('click', e => { e.preventDefault(); go({ view: 'welcome', brief: {}, asked: [] }); });

  /* ---------- boot ---------- */
  store.set('ci_lang', lang);
  const shared = qs.get('r');
  if (shared) {
    try { st = { view: 'result', brief: dec(shared), asked: [], path: 'shared' }; } catch (e) { st = { view: 'welcome', brief: {}, asked: [], path: 'text' }; }
  }
  history.replaceState({ kind: 'view', st: JSON.parse(JSON.stringify(st)) }, '', urlFor(st));
  render();
})();
