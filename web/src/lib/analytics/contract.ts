/* EV3 analytics contract, extended for the website (source_app: 'web').
   Envelope fields preserved from P1 track.js EV3: schema, event_id, ts, session_id, anon_id, client_seq,
   engine_version, universe_version, env, is_test, consent_state, lang, viewport, page, referrer_origin, props.
   Added for the site: route, locale, journey_stage, result_id. No PII keys are ever allowed in props. */
export const SCHEMA_VERSION = 'EV3';
export const WEB_EVENTS = {
  page_view: ['route'],
  search_submit: ['q_chars', 'q_redacted', 'results'],
  search_result_click: ['group', 'target'],
  car_view: ['model_id'],
  compare_view: ['model_ids'],
  cta_click: ['cta'],
  lang_switch: ['from', 'to'],
  filter_apply: ['keys'],
  evidence_open: ['model_id'],
  fmc_view: [],
  identity_gate_view: [],
  exit: ['last_event'],
} as const;
export type WebEvent = keyof typeof WEB_EVENTS;
export const JOURNEY_STAGE: Record<string, string> = {
  home: 'awareness', market: 'discovery', cars: 'discovery', search: 'discovery', news: 'discovery',
  car: 'consideration', compare: 'consideration', 'find-my-car': 'decision', 'my-carindex': 'retention',
};
/* Keys that may never appear in an analytics payload (defense in depth; validated client and server side). */
export const FORBIDDEN_KEYS = /^(phone|mobile|msisdn|email|e_mail|name|full_name|first_name|last_name|address|national_id|otp|code|text|query|q)$/i;
