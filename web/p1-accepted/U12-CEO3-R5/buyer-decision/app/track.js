/* CarIndex funnel instrumentation — event contract EV3.
   Transport: window.dataLayer (GTM-compatible) + optional beacon endpoint.
   No endpoint configured => events are buffered locally for QA only (nothing leaves the browser). */
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 'EV3';
  const FLOW_VERSION = 'F4-P1.2-2026-09-28';
  const EVENTS = {
    fmc_view: [], fmc_start: ['path'],
    brief_submit: ['chars', 'extracted', 'source'],
    q_view: ['q_id', 'step'], q_answer: ['q_id', 'step', 'value', 'ms_on_step'],
    q_skipped: ['q_id', 'reason'], q_back: ['q_id', 'step'],
    summary_view: ['keys'], summary_confirm: ['keys'], summary_edit: [], brief_edit_save: ['changed'],
    result_view: ['hero_id', 'alt_ids', 'pool', 'ms_to_result', 'brief', 'mode', 'confidence_level', 'margin'],
    no_match_view: ['brief', 'fix_keys'], relax_apply: ['key'], budget_adjust: ['from', 'to'],
    evidence_open: ['model_id', 'source'], compare_view: ['model_ids'], cta_click: ['cta', 'model_id'],
    restart: ['from'],
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
  // EV3 envelope (Analytics handoff): test traffic self-identifies via ?env= / ?synthetic_id=; no device blacklist
  const ENVS = ['prod', 'staging', 'qa', 'dev'];
  const env = ENVS.includes(qs.get('env')) ? qs.get('env') : /^(localhost|127\.)/.test(location.hostname) ? 'dev' : 'prod';
  const synthetic = qs.get('synthetic_id') || null;
  let referrerOrigin = null;
  try { referrerOrigin = document.referrer ? new URL(document.referrer).origin : null; } catch (e) { referrerOrigin = null; }
  let seq = 0;
  // events that belong to one rendered recommendation carry its recommendation_id
  const REC_EVENTS = ['result_view', 'feedback_view', 'feedback_answer', 'feedback_text', 'cta_click', 'evidence_open', 'compare_view', 'alt_promote'];
  const redact = t => (root.CIRedact ? root.CIRedact.redact(t) : { text_redacted: '[REDACTION UNAVAILABLE]', redactions: {} });
  // "auto" = the collector that served this page (same origin /e); empty = local buffer only
  let endpoint = (document.querySelector('meta[name="ci-track-endpoint"]') || {}).content || root.CI_TRACK_ENDPOINT || '';
  if (endpoint === 'auto') endpoint = /^https?:$/.test(location.protocol) ? location.origin + '/e' : '';
  const debug = qs.get('debug') === '1';
  let last = null;
  let ctx = {};

  root.dataLayer = root.dataLayer || [];

  function viewport() { const w = innerWidth; return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'; }

  function track(event, props) {
    props = props || {};
    const req = EVENTS[event];
    if (!req) { console.warn('[ci-track] unknown event', event); return; }
    // never send buyer free text as typed: only its redacted form (D5)
    if ('text' in props) { const x = redact(props.text); props = { ...props, text_redacted: x.text_redacted, redactions: x.redactions }; delete props.text; }
    if (ctx.recommendation_id && REC_EVENTS.includes(event)) props = { ...props, recommendation_id: ctx.recommendation_id };
    const missing = req.filter(k => !(k in props));
    if (missing.length) console.warn('[ci-track]', event, 'missing', missing);
    const e = {
      event, schema: SCHEMA_VERSION, event_id: uuid(), ts: new Date().toISOString(),
      session_id: session, page_instance_id: session, client_seq: ++seq, anon_id: anon, flow_version: FLOW_VERSION,
      engine_version: ctx.engine_version, universe_version: ctx.universe_version,
      source_app: 'p1_buyer', env, is_test: env !== 'prod' || !!synthetic, ...(synthetic ? { synthetic_id: synthetic } : {}), consent_state: 'essential',
      lang: document.documentElement.lang, viewport: viewport(),
      page: location.pathname, referrer_origin: referrerOrigin, ...utm, props,
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
    newRecommendation() { ctx = { ...ctx, recommendation_id: uuid() }; return ctx.recommendation_id; },
    markResult() { reached = true; },
    buffer() { return JSON.parse(store.get('ci_events') || '[]'); },
    endpointConfigured: !!endpoint,
  };
})(window);
