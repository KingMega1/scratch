// Recommendation integrity: adversarial + randomized. Run from buyer-decision/: node tests/integrity.test.js [--print]
const fs = require('fs'), path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../data/p11_client.js'), 'utf8'));
const P = require('../app/brief.js'), E = require('../app/engine.js');
const U = window.CI_UNIVERSE, M = U.models, byId = {}; M.forEach(m => { byId[m.id] = m; });
const PRINT = process.argv.includes('--print');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('FAIL', msg); } };
const recs = r => (r.hero ? [r.hero, ...r.alts] : []).concat(r.less ? [{ id: r.less.id, less: true }] : []);

// every returned model must satisfy every confirmed hard constraint, checked independently of the engine
function audit(label, b, r) {
  const nb = E.normalizeBrief(b, byId), t = E.territory(nb);
  ok(!r.guardDropped, `${label}: guard had to drop ${r.guardDropped}`);
  for (const x of recs(r)) {
    const m = byId[x.id], tr = E.currentTrims(m);
    ok(m.u, `${label}: ${x.id} not on sale`);
    ok(tr.some(v => v.min <= t.ceil), `${label}: ${x.id} has no version within ceiling ${t.ceil}`);
    if (nb.seats === 7) ok(m.seats && m.seats.some(s => s >= 7), `${label}: ${x.id} lacks confirmed 7 seats`);
    if (nb.chinese === 'exclude') ok(m.chinese === false, `${label}: ${x.id} is Chinese`);
    if (nb.body && nb.body.length) ok(nb.body.includes(m.body), `${label}: ${x.id} body ${m.body}`);
    if ((nb.brandsOnly || []).length) ok(nb.brandsOnly.includes(m.brand_id), `${label}: ${x.id} brand not in only-list`);
    if ((nb.brandsExclude || []).length) ok(!nb.brandsExclude.includes(m.brand_id), `${label}: ${x.id} excluded brand`);
    const no = new Set(nb.ptNo || []); if (nb.pt === 'no_ev') no.add('ev'); if (nb.pt === 'petrol') { no.add('ev'); no.add('hybrid'); }
    if (no.size) ok(tr.some(v => v.min <= t.ceil && (v.pt || (m.powertrains.length === 1 && m.powertrains[0])) && !no.has(v.pt || m.powertrains[0])), `${label}: ${x.id} no allowed powertrain in budget`);
    ok(!(nb.aspiration || []).includes(x.id), `${label}: aspiration ${x.id} recommended`);
    if (!x.less) ok(x.fit && x.fit.every(v => v.min <= t.ceil), `${label}: ${x.id} shows a version above ceiling`);
  }
}

// 1. randomized fuzz
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const onSale = M.filter(m => m.u), pricey = onSale.filter(m => m.price_min > 3e6);
for (let i = 0; i < 1500; i++) {
  const b = {
    budget: Math.round((0.6 + rnd() * 5) * 10) * 100000, budgetMode: pick(['around', 'max']), stretch: rnd() < 0.3,
    body: rnd() < 0.5 ? [pick(['suv', 'sedan', 'hatch', 'mpv'])] : null, seats: rnd() < 0.25 ? 7 : null,
    chinese: pick([null, 'open', 'prefer_not', 'exclude']), pt: pick([null, 'open', 'no_ev', 'hybrid', 'petrol', 'ev']),
    ptNo: rnd() < 0.1 ? ['hybrid'] : [], brandsOnly: rnd() < 0.08 ? [pick(onSale).brand_id] : [], brandsExclude: rnd() < 0.1 ? [pick(onSale).brand_id] : [],
    priorities: [pick([null, 'space', 'performance', 'warranty', 'pocket', 'popular', 'economy', 'easy'])].filter(Boolean),
    usage: pick([null, 'city', 'mixed', 'long']),
    mentions: rnd() < 0.4 ? [{ id: pick(rnd() < 0.5 ? pricey : onSale).id, role: pick(['consider', 'consider', 'reference']) }] : [],
    attraction: pick([null, 'size', 'brand', 'premium', 'performance']),
  };
  audit(`fuzz#${i}`, b, E.recommend(U, b));
}

// 2. hostile: give every over-budget premium model perfect specs — it must still never appear
const hostile = { meta: U.meta, models: M.map(m => (m.price_min > 4e6 ? { ...m, hp: [900], warranty_years: 10, seats: [7], segment: 'Luxury SUV-5', reg: { ...(m.reg || {}), last12: 99999, rank_in_body_last12: 1 } } : m)) };
for (const t of ['EGP 1.5M SUV', 'عايز عربية عالية في حدود مليون ونص', '7 seats 2.2m', 'SUV 1.5 million, popular, powerful, long warranty, spacious']) {
  const b = P.parse(t, M), r = E.recommend(hostile, { ...b, priorities: ['performance', 'warranty', 'popular', 'space'] });
  audit(`hostile "${t}"`, b, r);
  ok(!recs(r).some(x => byId[x.id].price_min > 4e6), `hostile "${t}": a >4M model appeared`);
}

// 3. budget smoothness: 1.59M vs 1.61M on a 2M budget are treated nearly the same
const terr2 = E.territory({ budget: 2e6, budgetMode: 'around' });
ok(Math.abs(E.priceFit(1.59e6, terr2) - E.priceFit(1.61e6, terr2)) < 0.02, 'no cliff between 1.59M and 1.61M at 2M');

// 4. popularity is not in the default score
const base = E.recommend(U, P.parse('SUV around 2 million', M));
const boosted = { meta: U.meta, models: M.map(m => ({ ...m, reg: m.reg ? { ...m.reg, last12: Math.round(rnd() * 20000) } : m.reg })) };
ok(E.recommend(boosted, P.parse('SUV around 2 million', M)).hero.id === base.hero.id, 'randomizing registrations does not change the default pick');

// 5. named adversarial briefs (printed for human review)
const cases = [
  ['EN', 'EGP 1M, SUV'], ['EN', 'EGP 1.5M SUV'], ['EN', 'SUV around EGP 2 million'], ['AR', 'عايز عربية عالية في حدود 2.2 مليون'],
  ['EN', 'SUV around 4 million'], ['EN', 'around 6 million, premium SUV'],
  ['EN', '7-seater, maximum EGP 2.2M, wife + children'], ['AR', 'عايز ٧ راكب لمراتي والأولاد واعتمادية مهمة، لحد 2.2 مليون'],
  ['EN', 'SUV 1.5 million, open to Chinese'], ['EN', 'SUV 1.5 million, prefer not Chinese'], ['EN', 'SUV 1.5 million, absolutely no Chinese brands'],
  ['AR', 'عايز عربية عالية في حدود مليون ونص ومش عندي مشكلة في الصيني'],
  ['EN', 'petrol only, 1.5M'], ['EN', '1.5M SUV, open to hybrid'], ['EN', '1.5M SUV, open to EV'], ['EN', 'no hybrid, no EV, SUV 1.5M'],
  ['EN', "something Qashqai-sized"], ['EN', 'small city car, 900k'], ['EN', '7-seat family car, 1.5m'],
  ['EN', "EGP 2M, I'm considering Tucson and Sportage."], ['AR', 'بفكر في توسان وسبورتاج ومعايا حوالي ٢ مليون'],
  ['EN', 'EGP 1.5M, I really like GLC/GLE because I want comfort and a premium feel.'],
  ['EN', 'Maximum EGP 1.5M, must be 7 seats, Mercedes only.'],
];
for (const [lang, t] of cases) {
  const b = P.parse(t, M), r = E.recommend(U, b);
  audit(`"${t}"`, b, r);
  if (PRINT) {
    const nb = r.brief, f = x => { const m = byId[x.id]; return `${m.brand} ${m.model} [${E.sizeKey(m) || m.body}${m.seats ? ' ' + m.seats.join('/') + 's' : ''}${m.chinese ? ' CN' : ''}] ${(x.fit[0].min / 1e6).toFixed(2)}–${(x.fit[x.fit.length - 1].min / 1e6).toFixed(2)}M`; };
    console.log(`\n${lang} "${t}"\n  understood: budget ${nb.budget / 1e6}M ${nb.budgetMode}${nb.body ? ' · ' + nb.body.join('/') : ''}${nb.seats ? ' · ' + nb.seats + ' seats' : ''}${nb.chinese ? ' · chinese:' + nb.chinese : ''}${nb.pt ? ' · pt:' + nb.pt : ''}${(nb.ptNo || []).length ? ' · no:' + nb.ptNo : ''}${(nb.brandsOnly || []).length ? ' · only:' + nb.brandsOnly : ''}${nb.shortlist.length ? ' · considering:' + nb.shortlist : ''}${nb.aspiration.length ? ' · aspiration:' + nb.aspiration + ' (' + (nb.attraction || '?') + ')' : ''}${nb.reference.length ? ' · like:' + nb.reference : ''}`);
    console.log(`  eligible ${r.eligible} · excluded ${JSON.stringify(r.blocked)} · unknown ${JSON.stringify(r.unknown)}`);
    if (!r.hero) console.log(`  NO MATCH → options: ${r.nearest.map(x => x.key + (x.n ? `(${x.n})` : x.to ? `(${x.to / 1e6}M)` : '')).join(', ')}`);
    else { console.log(`  1. ${f(r.hero)}${r.heroFromShortlist ? '  ← from buyer shortlist' : ''}`); r.alts.forEach((a, i) => console.log(`  ${i + 2}. ${f(a)}  (${a.role})`)); }
    if (r.less) console.log(`  spend less: ${byId[r.less.id].brand} ${byId[r.less.id].model} up to ${(r.less.price / 1e6).toFixed(2)}M`);
    if (r.shortlist) console.log(`  shortlist: ${JSON.stringify(r.shortlist.rows.map(x => x.id + (x.ok ? '' : ':' + x.why)))} winner ${r.shortlist.winner}`);
    if (r.aspiration) console.log(`  aspiration: ${r.aspiration.map(a => `${a.id} from ${(a.entry / 1e6).toFixed(2)}M (${a.times}x)`).join('; ')}`);
  }
}
console.log(`\n${checks} checks, ${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
process.exit(fails ? 1 : 0);
