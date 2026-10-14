/* Free-text redaction for analytics (EV3 contract, CEO decision D5: never persist unredacted free text).
   Same rules as P1 app/redact.js @ f994e7f (vendored server-side and re-applied by /api/v1/events). */
const toAscii = (s: string) => s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0));
const SEP = '[\\s\\-.()]*';
const RULES: [string, RegExp][] = [
  ['EMAIL', /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi],
  ['PHONE', new RegExp(`(?:(?:\\+|00)?20${SEP})?0?1[0125](?:${SEP}\\d){8}(?!\\d)`, 'g')],
  ['PHONE', new RegExp(`(?:(?:\\+|00)20${SEP}\\d{1,2}|(?<![\\d,])0\\d{1,2})(?:${SEP}\\d){7,8}(?!\\d)`, 'g')],
  ['NUMBER', /\d{9,}/g],
];
export function redact(text: string): { text_redacted: string; redactions: Record<string, number> } {
  let t = toAscii(String(text || ''));
  const redactions: Record<string, number> = { PHONE: 0, EMAIL: 0, NUMBER: 0 };
  for (const [tag, re] of RULES) t = t.replace(re, () => { redactions[tag]++; return `[${tag}]`; });
  return { text_redacted: t, redactions };
}
