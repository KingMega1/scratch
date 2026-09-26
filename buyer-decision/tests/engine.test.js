// P1.1 brief parser + engine v3 checks. Run from buyer-decision/: node tests/engine.test.js
const fs = require('fs'), path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../data/p11_client.js'), 'utf8'));
const P = require('../app/brief.js'), E = require('../app/engine.js');
const U = window.CI_UNIVERSE, M = U.models, byId = {}; M.forEach(m => { byId[m.id] = m; });
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) fails++; };
const run = t => E.recommend(U, P.parse(t, M));

// 1. parser: the brief's four example sentences + Egyptian Arabic forms
let p = P.parse('عايز عربية عالية في حدود 2.2 مليون.', M);
ok(p.budget === 2200000 && p.budgetMode === 'around' && p.body[0] === 'suv', 'AR: "عالية في حدود 2.2 مليون" = SUV around 2.2M');
p = P.parse("I want something around the Qashqai's size and price for my wife.", M);
ok(p.mentions[0].id === 'nissan/qashqai' && p.mentions[0].role === 'reference' && p.who.includes('wife'), 'EN: Qashqai size/price = reference, for wife');
p = P.parse('I need a reliable 7-seater for my wife and children.', M);
ok(p.seats === 7 && p.checks.includes('reliability') && p.who.includes('kids'), 'EN: 7-seater, reliability recorded as a check (not scored)');
p = P.parse("I'm considering Tucson and Sportage.", M);
ok(p.mentions.map(x => x.id).join() === 'hyundai/tucson,kia/sportage', 'EN: shortlist Tucson + Sportage');
p = P.parse('ميزانيتي مليون ونص ومش عايز صيني، عايزة عربية هايبرد للزحمة', M);
ok(p.budget === 1500000 && p.chinese === 'exclude' && p.pt === 'hybrid' && p.usage === 'city', 'AR: مليون ونص, no Chinese, hybrid, city');
p = P.parse('عايز جيب 7 كراسي بمليونين ونص', M);
ok(p.budget === 2500000 && p.seats === 7 && p.body[0] === 'suv' && !p.brandsPrefer, 'AR: "جيب" = SUV, not the Jeep brand');
p = P.parse('between 1.2 and 1.5 million sedan, no Kia', M);
ok(p.budget === 1500000 && p.budgetMin === 1200000 && p.brandsExclude[0] === 'kia', 'EN: range + brand exclusion');
p = P.parse('budget max 1,800,000 no electric, Toyota or Hyundai', M);
ok(p.budgetMode === 'max' && p.pt === 'no_ev' && p.brandsPrefer.length === 2, 'EN: max budget, no EV, negation stops at comma');

p = P.parse('محتار بين التوسان والسبورتاج.', M);
ok((p.mentions || []).map(x => x.id).join() === 'hyundai/tucson,kia/sportage', 'AR: "التوسان والسبورتاج" (al- prefix) = shortlist');
p = P.parse('عايز حاجة في حجم وسعر القشقاي، لمراتي.', M);
ok(p.mentions[0].id === 'nissan/qashqai' && p.mentions[0].role === 'reference', 'AR: "في حجم وسعر القشقاي" = reference');

// 2. hard constraints hold
const r7 = run('I need a 7-seater, budget 2.2m');
ok(r7.hero && [r7.hero, ...r7.alts].every(x => byId[x.id].seats.some(s => s >= 7)), '7 seats: every recommended model has 7 confirmed seats');
ok(r7.pool >= 3, `7 seats at 2.2M: ${r7.pool} candidates (not "only one")`);
const rc = run('SUV 1.5 million, no Chinese brands');
ok(rc.hero && [rc.hero, ...rc.alts].every(x => !byId[x.id].chinese), 'no Chinese: none recommended');
const rb = run('sedan around 1.2m');
ok([rb.hero, ...rb.alts].every(x => byId[x.id].body === 'sedan'), 'sedan: only sedans');

// 3. budget is an intention: results move with it, and stay near it
const lo = run('SUV around 1.2 million'), hi = run('SUV around 3 million');
ok(lo.hero.id !== hi.hero.id, `budget changes the pick (${lo.hero.id} vs ${hi.hero.id})`);
ok([hi.hero, ...hi.alts].every(x => x.price >= 3e6 * 0.8 && x.price <= 3e6 * 1.1), 'at 3M every pick is within 80–110% of budget');

// 4. shortlist + aspiration
const rs = run("I'm considering Tucson and Sportage.");
ok(rs.shortlist && rs.shortlist.winner && rs.shortlist.rows.length === 2, 'shortlist verdict names a winner between the two');
ok([rs.hero, ...rs.alts].some(x => x.id === 'hyundai/tucson') && [rs.hero, ...rs.alts].some(x => x.id === 'kia/sportage'), 'both named cars are shown');
const ra = run('I love the GLC or GLE, budget 1.5M');
ok(ra.aspiration && ra.aspiration[0].id === 'mercedes/glc' && ra.aspiration[0].times > 3, 'GLC at 1.5M = aspiration, >3x budget');
const rsz = E.recommend(U, { ...P.parse('I love the GLC or GLE, budget 1.5M', M), attraction: 'size' });
ok(byId[rsz.hero.id].body === 'suv', `aspiration "size" keeps SUVs (${rsz.hero.id})`);

// 5. coverage neutrality: a missing spec scores exactly like the median value (never zero, never a bonus)
const briefs = ['SUV around 2 million', 'I need a 7-seater, budget 2.5m', 'sedan around 1.2m', 'hatchback 1 million'];
for (const t of briefs) {
  const b = { ...P.parse(t, M), priorities: ['warranty'] }, base = E.recommend(U, b);
  if (!base.hero) continue;
  const id = base.hero.id;
  const pool = base.poolIds.map(x => byId[x].warranty_years).filter(v => v != null).sort((x, y) => x - y);
  const med = pool[Math.floor(pool.length / 2)];
  const withNull = E.recommend({ meta: U.meta, models: M.map(m => (m.id === id ? { ...m, warranty_years: null } : m)) }, b);
  const withMed = E.recommend({ meta: U.meta, models: M.map(m => (m.id === id ? { ...m, warranty_years: med } : m)) }, b);
  ok(withNull.poolIds.indexOf(id) === withMed.poolIds.indexOf(id), `"${t}": unknown warranty ranks like the median (#${withNull.poolIds.indexOf(id) + 1})`);
}
// 6. popularity is not in the score unless asked
const a = E.recommend(U, P.parse('SUV around 2 million', M));
const bump = { meta: U.meta, models: M.map(m => (m.reg && m.reg.last12 > 300 ? { ...m, reg: { ...m.reg, last12: m.reg.last12 * 10 } } : m)) };
ok(E.recommend(bump, P.parse('SUV around 2 million', M)).hero.id === a.hero.id, 'more registrations above the saturation point do not change the pick');

// 7. materiality: usage only asked when it changes the top 3
const nb = P.parse('عايز عربية عالية في حدود 2.2 مليون.', M);
ok(typeof E.material(U, nb, [{ usage: 'city' }, { usage: 'long' }]) === 'boolean', 'materiality check runs');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
