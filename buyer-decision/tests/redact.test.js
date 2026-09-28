// Free-text redaction (EV3 handoff). Run from buyer-decision/: node tests/redact.test.js
const { redact } = require('../app/redact.js');
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) fails++; };
const r = t => redact(t).text_redacted;
const C = [
  ['call me on 01012345678', 'call me on [PHONE]'],
  ['+201012345678 please', '[PHONE] please'],
  ['00201112345678', '[PHONE]'],
  ['0122 345 6789', '[PHONE]'],
  ['010-1234-5678', '[PHONE]'],
  ['٠١٠١٢٣٤٥٦٧٨ كلمني', '[PHONE] كلمني'],
  ['رقمي ٠١٢ ٣٤٥ ٦٧٨٩٠', 'رقمي [PHONE]'],
  ['landline 02 2345 6789', 'landline [PHONE]'],
  ['+20 2 23456789', '[PHONE]'],
  ['03-4567890 Alex office', '[PHONE] Alex office'],
  ['mail me: a.b+cars@example.com.eg', 'mail me: [EMAIL]'],
  ['ref 123456789012', 'ref [NUMBER]'],
  ['budget 2200000, maybe 2,500,000', 'budget 2200000, maybe 2,500,000'],
  ['up to 25000000 EGP', 'up to 25000000 EGP'],
  ['SUV 1.5 million, 7 seats, 2026 model', 'SUV 1.5 million, 7 seats, 2026 model'],
  ['عايز عربية في حدود ٢٠٠٠٠٠٠', 'عايز عربية في حدود 2000000'],
];
for (const [i, o] of C) ok(r(i) === o, `${JSON.stringify(i)} -> ${JSON.stringify(r(i))}`);
const x = redact('01012345678 and a@b.co and 1234567890123');
ok(x.redactions.PHONE === 1 && x.redactions.EMAIL === 1 && x.redactions.NUMBER === 1, 'redaction counts');
ok(!('text' in x), 'never returns the raw text');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
