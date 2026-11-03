/* Client-side redaction of buyer free text before any event leaves the browser (CEO decision D5: never deliberately
   persist unredacted free text). Replaces phone numbers, emails and long digit runs; budgets (≤ 8 digits) are kept.
   Rules follow the Analytics EV3 handoff; to be reconciled with Analytics' reference lib/redact.mjs when received. */
(function (root) {
  'use strict';
  const toAscii = s => s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0));
  const SEP = '[\\s\\-.()]*';
  const RULES = [
    ['EMAIL', /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi],
    // Egyptian mobiles: 01[0125] + 8 digits, optionally +20 / 0020 / 20 prefixed, separators allowed
    ['PHONE', new RegExp(`(?:(?:\\+|00)?20${SEP})?0?1[0125](?:${SEP}\\d){8}(?!\\d)`, 'g')],
    // landlines with area code: 0 + 1–2 digit area code + 7–8 digits, or +20 / 0020 + area code + 7–8 digits
    ['PHONE', new RegExp(`(?:(?:\\+|00)20${SEP}\\d{1,2}|(?<![\\d,])0\\d{1,2})(?:${SEP}\\d){7,8}(?!\\d)`, 'g')],
    // any other contiguous run of 9+ digits
    ['NUMBER', /\d{9,}/g],
  ];
  function redact(text) {
    let t = toAscii(String(text || ''));
    const redactions = { PHONE: 0, EMAIL: 0, NUMBER: 0 };
    for (const [tag, re] of RULES) t = t.replace(re, () => { redactions[tag]++; return `[${tag}]`; });
    return { text_redacted: t, redactions };
  }
  const api = { redact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIRedact = api;
})(typeof window !== 'undefined' ? window : globalThis);
