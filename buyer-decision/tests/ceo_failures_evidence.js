// node evid.js <repo buyer-decision dir> <dataset dir> -> one JSON line per case
const [root, dsdir] = process.argv.slice(2);
const T = require(root + '/transport/reco.js'), E = T._internals.E;
const ds = T.loadAcceptedDataset(dsdir);
const DEF = { budget: { budget: 2000000, budgetMode: 'around' }, size: { sizePref: 'medium' }, pt: { pt: 'open' }, chinese: { chinese: 'open' }, usage: { usage: 'mixed' }, priorities: { priorities: [] }, drive: { drive4: false }, attraction: { attraction: 'size' }, body: { body: ['suv'] }, seats: { seats: 5 } };
const C = [['1 range', 'SUV from 1.2M to 1.5M'], ['1 range AR', 'من 1.2 مليون لـ 1.5 مليون عربية عالية'], ['1 +10%', 'SUV, budget 1.5M, can go up to 10% more'], ['1 +10% AR', 'عربية عالية ميزانيتي 1.5 مليون وممكن ازيد ١٠٪'],
  ['2 only', 'I only want a BYD, around 2M'], ['2 only', 'BYD, nothing else, 1.8M'], ['2 only AR', 'مش عايز غير BYD في حدود 2 مليون'], ['2 only AR', 'مش عايز غير تويوتا في حدود 1.5 مليون'], ['2 list', 'Toyota or Hyundai only, 1.5M'], ['2 except AR', 'عايز اي حاجه غير BYD في حدود 2 مليون'], ['2 brand', 'Mercedes-Benz only, 5M'],
  ['3 running cost', 'SUV 2M, I care most about resale value and low running costs'], ['3 fuel AR', 'عايز عربية عالية للعيلة في حدود 1.8 مليون، الأهم عندي البنزين والمساحة، ومش عايز صيني'],
  ['5 PHEV', 'plug-in hybrid SUV around 1.8M, no fully electric cars'], ['5 PHEV AR', 'عايز SUV هايبرد بتتشحن بحوالي ١.٨ مليون جنيه ومش عايز عربية كهربا بالكامل'], ['5 EV', 'fully electric SUV around 2M'],
  ['known GLC', 'I want a petrol SUV with maximum budget 5.5 million EGP. I am considering Mercedes GLC. No fully electric cars.'], ['known Corolla', 'petrol sedan max 1.5M, Toyota Corolla'], ['known EX5 AR', 'عايز جيلي اي اكس ٥ اي ام اي لحد ١.٨ مليون جنيه'], ['known K4', 'Kia K4 max 1,510,000']];
const keep = ['budget', 'budgetMin', 'budgetMode', 'stretch', 'body', 'brandsOnly', 'brandsExclude', 'brandsPrefer', 'pt', 'ptNo', 'priorities', 'checks', 'chinese', 'shortlist'];
for (const [k, t] of C) {
  const l = /[؀-ۿ]/.test(t) ? 'ar' : 'en';
  let b = T.understand(t, ds, { locale: l }); const p = JSON.parse(JSON.stringify(b)); const asked = [];
  try {
    for (let q, g = 0; (q = T.nextQuestion(b, asked, ds)) && g < 12; g++) { asked.push(q); b = T.mergeAnswer(b, DEF[q] || {}, ds); }
    b = T.normalize(b, ds); const r = E.recommend(ds.U, b); const o = T.execute(b, ds, { locale: 'en', asOf: '2026-11-03' });
    const brief = {}; for (const x of keep) if (p[x] != null && !(Array.isArray(p[x]) && !p[x].length)) brief[x] = p[x];
    console.log(JSON.stringify({ k, t, brief, asked, ceil: r.terr && r.terr.ceil, eligible: r.eligible, mode: o.mode, conf: o.confidence && o.confidence.level, cars: (o.hero ? [o.hero, ...o.alternatives] : []).map(c => c.id + ' ' + c.price_range.text) }));
  } catch (e) { console.log(JSON.stringify({ k, t, error: e.message.slice(0, 80) })); }
}
