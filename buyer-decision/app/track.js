/* CarIndex funnel instrumentation — event contract v1 (see docs/EVENT_SCHEMA.md).
   Transport: window.dataLayer (GTM-compatible) + optional beacon endpoint.
   No endpoint configured => events are buffered locally for QA only (nothing leaves the browser). */
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 'EV2';
  const FLOW_VERSION = 'F2-2026-09-25';
  const EVENTS = {
    fmc_view: [], fmc_start: ['budget'],
    q_view: ['q_id', 'step'], q_answer: ['q_id', 'step', 'value', 'ms_on_step', 'eligible_after'],
    q_skipped: ['q_id', 'reason'], q_back: ['q_id', 'step'],
    result_view: ['hero_id', 'alt_ids', 'eligible', 'mode', 'confidence', 'margin', 'ms_to_result', 'answers'],
    no_match_view: ['answers', 'relax_keys'], relax_apply: ['key'],
    alt_promote: ['from_id', 'to_id', 'role'], evidence_open: ['model_id', 'source'],
    compare_view: ['model_ids'], cta_click: ['cta', 'model_id'],
    edit_answer: ['q_id'], restart: ['from'],
    feedback_view: ['hero_id'], feedback_answer: ['helped', 'hero_id'], feedback_text: ['helped', 'hero_id', 'text_length'],
    lang_switch: ['from', 'to'],
    exit: ['last_event', 'reached_result'],
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  const uuid = () => (root.crypto && crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));

  let anon = store.get('ci_anon');
  if (!anon) { anon = uuid(); store.set('ci_anon', anon); }
  const session = uuid();
  const qs = new URLSearchParams(location.search);
  const utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => { if (qs.get(k)) utm[k] = qs.get(k); });
  const endpoint = (document.querySelector('meta[name="ci-track-endpoint"]') || {}).content || root.CI_TRACK_ENDPOINT || '';
  const debug = qs.get('debug') === '1';
  let last = null;
  let ctx = {};

  root.dataLayer = root.dataLayer || [];

  function viewport() { const w = innerWidth; return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'; }

  function track(event, props) {
    props = props || {};
    const req = EVENTS[event];
    if (!req) { console.warn('[ci-track] unknown event', event); return; }
    const missing = req.filter(k => !(k in props));
    if (missing.length) console.warn('[ci-track]', event, 'missing', missing);
    const e = {
      event, schema: SCHEMA_VERSION, event_id: uuid(), ts: new Date().toISOString(),
      session_id: session, anon_id: anon, flow_version: FLOW_VERSION,
      engine_version: ctx.engine_version, universe_version: ctx.universe_version,
      lang: document.documentElement.lang, viewport: viewport(),
      page: location.pathname, referrer: document.referrer || null, ...utm, props,
    };
    last = event;
    root.dataLayer.push(e);
    if (endpoint && navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([JSON.stringify(e)], { type: 'text/plain' }));
    const buf = JSON.parse(store.get('ci_events') || '[]');
    buf.push(e); store.set('ci_events', JSON.stringify(buf.slice(-500)));
    if (debug) renderDebug(e);
    return e;
  }

  let reached = false;
  addEventListener('pagehide', () => { if (last && last !== 'exit') track('exit', { last_event: last, reached_result: reached }); });

  function renderDebug(e) {
    let el = document.getElementById('ci-debug');
    if (!el) {
      el = document.createElement('pre'); el.id = 'ci-debug';
      el.style.cssText = 'position:fixed;inset-block-end:0;inset-inline-end:0;max-width:min(420px,100vw);max-height:40vh;overflow:auto;margin:0;padding:8px;background:#111;color:#9fe39f;font:11px/1.4 ui-monospace,monospace;z-index:99;opacity:.92';
      document.body.appendChild(el);
    }
    if (!document.getElementById('ci-export')) {
      const b = document.createElement('button'); b.id = 'ci-export'; b.textContent = 'Export events (JSON)';
      b.style.cssText = 'position:fixed;inset-block-end:40vh;inset-inline-end:0;z-index:100;font:12px ui-monospace,monospace;padding:6px 10px';
      b.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(root.CITrack.buffer())], { type: 'application/json' })); a.download = `carindex-events-${session}.json`; a.click(); };
      document.body.appendChild(b);
    }
    el.textContent = `${e.ts.slice(11, 19)} ${e.event} ${JSON.stringify(e.props)}\n` + el.textContent;
  }

  root.CITrack = {
    track, EVENTS, SCHEMA_VERSION, FLOW_VERSION,
    setContext(c) { ctx = { ...ctx, ...c }; },
    markResult() { reached = true; },
    buffer() { return JSON.parse(store.get('ci_events') || '[]'); },
    endpointConfigured: !!endpoint,
  };
})(window);
