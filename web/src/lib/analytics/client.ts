'use client';
import { FORBIDDEN_KEYS, JOURNEY_STAGE, SCHEMA_VERSION, WEB_EVENTS, type WebEvent } from './contract';

/* Browser transport: window.dataLayer (GTM-compatible) + optional same-origin collector.
   With no endpoint configured events stay in a local QA buffer and nothing leaves the browser. */
type Props = Record<string, unknown>;
declare global { interface Window { dataLayer?: unknown[]; __ciCtx?: Record<string, unknown> } }

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
let anon: string | null = null, session: string | null = null, seq = 0;

function routeKey(path: string) {
  const p = path.split('/').filter(Boolean);
  if (p.length < 2) return 'home';
  if (p[1] === 'cars' && p.length >= 4) return 'car';
  return p[1];
}

export function setAnalyticsContext(c: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.__ciCtx = { ...(window.__ciCtx || {}), ...c };
}

export function track(event: WebEvent, props: Props = {}) {
  if (typeof window === 'undefined') return;
  const required = WEB_EVENTS[event] as readonly string[];
  if (!required) return;
  const clean: Props = {};
  for (const [k, v] of Object.entries(props)) if (!FORBIDDEN_KEYS.test(k)) clean[k] = v;
  if (!anon) { anon = store.get('ci_anon') || uuid(); store.set('ci_anon', anon); }
  if (!session) session = uuid();
  const qs = new URLSearchParams(location.search);
  const env = ['prod', 'staging', 'qa', 'dev'].includes(qs.get('env') || '') ? qs.get('env') : (document.documentElement.dataset.env || 'dev');
  const ctx = window.__ciCtx || {};
  const route = routeKey(location.pathname);
  let referrer_origin: string | null = null;
  try { referrer_origin = document.referrer ? new URL(document.referrer).origin : null; } catch { referrer_origin = null; }
  const e = {
    event, schema: SCHEMA_VERSION, event_id: uuid(), ts: new Date().toISOString(),
    session_id: session, anon_id: anon, client_seq: ++seq, source_app: 'web',
    engine_version: (ctx.engine_version as string) ?? null, universe_version: (ctx.universe_version as string) ?? null,
    result_id: (ctx.result_id as string) ?? null,
    env, is_test: env !== 'prod' || !!qs.get('synthetic_id'), consent_state: 'essential',
    lang: document.documentElement.lang, locale: document.documentElement.lang, viewport: innerWidth < 600 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop',
    page: location.pathname, route, journey_stage: JOURNEY_STAGE[route] || 'other', referrer_origin, props: clean,
  };
  (window.dataLayer = window.dataLayer || []).push(e);
  const endpoint = document.querySelector<HTMLMetaElement>('meta[name="ci-track-endpoint"]')?.content || '';
  if (endpoint && navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([JSON.stringify(e)], { type: 'application/json' }));
  // QA buffer (persistent browsing trail in localStorage): non-production builds only.
  if (document.documentElement.dataset.env !== 'prod') {
    try { const buf = JSON.parse(store.get('ci_events') || '[]'); buf.push(e); store.set('ci_events', JSON.stringify(buf.slice(-300))); } catch { /* ignore */ }
  }
  return e;
}
