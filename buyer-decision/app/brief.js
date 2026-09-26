/* Brief parser (EN + Egyptian Arabic). Deterministic keyword extraction — no model, no network.
   Turns "عايز عربية عالية في حدود 2.2 مليون" into { budget, budgetMode, body, ... }.
   Anything it is not sure about is left empty so the flow can ask. */
(function (root) {
  'use strict';

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function norm(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)))
      .replace(/٫/g, '.').replace(/[،؛]/g, ',')
      .replace(/[ً-ْـ]/g, '') // harakat, tatweel
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[‘’]/g, "'")
      .toLowerCase();
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // word boundary that works for Arabic and Latin
  const B = '(?:^|[^a-z0-9ء-ي])(?:و|ف|ب|ل|ال|لل|بال|وال|فال)?';
  const E = '(?=$|[^a-z0-9ء-ي])';
  const has = (t, words) => words.some(w => new RegExp(B + w + E).test(t));
  const find = (t, words) => { for (const w of words) { const m = new RegExp(B + '(' + w + ')' + E).exec(t); if (m) return m.index; } return -1; };

  const NEG = ['no', 'not', "don't", 'dont', 'without', 'except', 'avoid', 'nothing', 'never', 'rather not',
    'مش', 'بلاش', 'من غير', 'مابحبش', 'مبحبش', 'ماعدا', 'مش عايز', 'مش عاوز', 'بدون', 'ابعد عن', 'مافيش'];
  const negatedBefore = (t, idx) => {
    const pre = t.slice(Math.max(0, idx - 22), idx);
    return NEG.some(n => new RegExp(B + esc(n) + '\\s*(?:[^\\s,.;!?]+\\s*){0,2}$').test(pre));
  };

  /* ---------- budget ---------- */
  const UNIT_M = '(?:m|mn|mil|million|millions|مليون|ملايين|مليونين)';
  const UNIT_K = '(?:k|thousand|الف|الاف|ألف|آلاف)';
  const AROUND = ['around', 'about', 'approximately', 'approx', 'roughly', 'something around', 'in the range of', '~',
    'حوالي', 'حوالى', 'في حدود', 'فى حدود', 'تقريبا', 'قريب من', 'حاجه زي', 'ف حدود', 'على قد'];
  const MAX = ['max', 'maximum', 'up to', 'upto', 'under', 'below', 'no more than', 'not more than', 'at most', 'less than', 'cap',
    'لحد', 'اقصي', 'اقصى', 'مش اكتر من', 'ماتزيدش', 'متزيدش', 'ما يزيدش', 'تحت', 'اقل من', 'بالكتير', 'بالكثير'];
  const STRETCH = ['stretch', 'a bit more', 'a little more', 'flexible', 'can go higher', 'can add',
    'ممكن ازود', 'ممكن زياده', 'ازود شويه', 'ازود حاجه بسيطه', 'مرن', 'لو تستاهل'];
  const MONEY_CTX = ['budget', 'egp', 'le', 'pounds', 'price', 'spend', 'afford', 'ميزانيه', 'ميزانيتي', 'جنيه', 'جنية', 'سعر', 'حدود', 'حوالي', 'فلوس', 'معايا'];

  function parseBudget(t) {
    const found = [];
    // "1,500,000" -> 1500000
    t = t.replace(/(\d{1,3})(?:,(\d{3}))+(?!\d)/g, m => m.replace(/,/g, ''));
    const push = (v, idx) => { if (v >= 200000 && v <= 60000000) found.push({ v: Math.round(v), idx }); };
    let m;
    // Egyptian word forms
    const words = [
      [/مليونين\s*و\s*نص/, 2.5e6], [/مليونين\s*و\s*ربع/, 2.25e6], [/مليونين(?!\s*و)/, 2e6],
      [/(?:^|[^\d.])مليون\s*و\s*نص/, 1.5e6], [/(?:^|[^\d.])مليون\s*و\s*ربع/, 1.25e6], [/(?:^|[^\d.])مليون\s*الا\s*ربع/, 0.75e6],
      [/(?:^|[^\d.\s])\s*مليون\s*و\s*(\d{2,3})\s*(?:الف|ألف)?/, null],
      [/(?:^|\s)(?:نص|نصف)\s*مليون/, 0.5e6], [/(?:^|\s)ربع\s*مليون/, 0.25e6],
      [/(?:^|[^\d.\s])\s*مليون(?!\s*و)(?![ء-ي])/, 1e6],
      [/(?:^|\s)(?:one|a)\s+million/, 1e6], [/(?:^|\s)two\s+million/, 2e6], [/(?:^|\s)(?:one\s+and\s+a\s+half|1\s+and\s+a\s+half)\s+million/, 1.5e6],
    ];
    for (const [re, v] of words) {
      if ((m = re.exec(t))) { push(v === null ? 1e6 + (+m[1]) * 1000 : v, m.index); }
    }
    // "2 مليون و 200" / "2.2 مليون" / "2.2m" / "900k" / "900 الف"
    // "1.2 to 1.5 million" / "من 1.2 ل 1.5 مليون"
    const reR = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:-|–|to|and|ل|لـ|الى|لحد|و)\\s*(\\d+(?:\\.\\d+)?)\\s*' + UNIT_M + E);
    if ((m = reR.exec(t)) && +m[1] < 20 && +m[2] < 20) { push(parseFloat(m[1]) * 1e6, m.index); push(parseFloat(m[2]) * 1e6, m.index + 1); }
    const reMk = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_M + '(?:\\s*و\\s*(\\d{2,3})\\s*(?:الف|ألف)?)?' + E, 'g');
    while ((m = reMk.exec(t))) push(parseFloat(m[1]) * 1e6 + (m[2] ? +m[2] * 1000 : 0), m.index);
    const reK = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_K + E, 'g');
    while ((m = reK.exec(t))) push(parseFloat(m[1]) * 1e3, m.index);
    // plain big numbers
    const reN = /(?:^|[^\d.])(\d{6,8})(?![\d.])/g;
    while ((m = reN.exec(t))) push(+m[1], m.index);
    // bare "2.2" next to a budget word = millions
    if (!found.length && has(t, MONEY_CTX)) {
      const reS = /(?:^|[^\d.])(\d{1,2}(?:\.\d{1,2})?)(?![\d.])(?!\s*(?:seat|seats|seater|راكب|ركاب|كرسي|كراسي|مقاعد|مقعد|سنين|سنه|years|year|kids|children|عيال|اولاد|x|people|persons|نفر|افراد))/g;
      while ((m = reS.exec(t))) { const v = parseFloat(m[1]); if (v >= 0.3 && v <= 20) push(v * 1e6, m.index); }
    }
    if (!found.length) return null;
    found.sort((a, b) => a.idx - b.idx);
    // a range "1.5 to 2 million" -> the upper value is the budget
    const vals = [...new Set(found.map(f => f.v))];
    const hasRange = vals.length >= 2 && /(\d)\s*(?:-|–|to|and|ل|لـ|الى|إلى|لحد|و)\s*\d/.test(t);
    const v = hasRange ? Math.max(...vals) : found[0].v;
    const lo = hasRange ? Math.min(...vals) : null;
    const mode = has(t, MAX) && !has(t, AROUND) ? 'max' : 'around';
    return { budget: v, budgetMin: lo, budgetMode: hasRange ? 'range' : mode, stretch: has(t, STRETCH) };
  }

  /* ---------- vocabulary ---------- */
  const BODY = {
    suv: ['suv', 'suvs', 'crossover', 'cross over', 'cross', '4x4', 'jeep', 'high car', 'tall car', 'high riding', 'high-riding', 'off road', 'offroad',
      'عاليه', 'عالي', 'جيب', 'چيب', 'كروس', 'كروس اوفر', 'اس يو في', 'اس يو ڤي', 'دفع رباعي', 'رباعي', 'اوف رود'],
    sedan: ['sedan', 'saloon', 'سيدان', 'صالون', 'ملاكي عادي', 'عربيه عاديه', 'واطيه', 'بشنطه'],
    hatch: ['hatchback', 'hatch', 'هاتشباك', 'هاتش باك', 'هاتش'],
    mpv: ['mpv', 'minivan', 'mini van', 'van', 'people carrier', 'ميني فان', 'فان', 'ميكروباص'],
  };
  const SEVEN = ['7 seats', '7 seat', '7-seat', '7 seater', '7-seater', 'seven seats', 'seven seater', 'seven-seater', 'third row', '3rd row', '7 passengers', '7 people',
    '7 كراسي', '7 كرسي', '7 مقاعد', '7 ركاب', '7 راكب', '7 افراد', '7 نفر', 'سبع كراسي', 'سبعه كراسي', 'سبع ركاب', 'سبعه ركاب', 'سبعه مقاعد', 'سبع مقاعد', 'صف تالت', 'صف ثالث', 'تلات صفوف', 'ثلاث صفوف', '٣ صفوف', '3 صفوف'];
  const FIVE = ['5 seats', '5 seat', '5-seat', '5 seater', '5-seater', 'five seats', '5 كراسي', '5 ركاب', '5 مقاعد', 'خمس كراسي', 'خمسه كراسي'];
  const FAMILY = { wife: ['wife', 'my wife', 'مراتي', 'المدام', 'مدام', 'زوجتي', 'الجماعه'], husband: ['husband', 'جوزي', 'زوجي'],
    kids: ['kids', 'children', 'child', 'son', 'daughter', 'sons', 'daughters', 'baby', 'ولادي', 'الولاد', 'اولادي', 'الاولاد', 'عيالي', 'العيال', 'اطفال', 'بنتي', 'ابني', 'بناتي', 'البيبي'],
    family: ['family', 'العيله', 'عيلتي', 'العائله', 'اسرتي', 'اسره'], parents: ['parents', 'my mother', 'my father', 'mum', 'mom', 'ماما', 'بابا', 'والدتي', 'والدي', 'امي', 'ابويا'],
    self: ['first car', 'for myself', 'اول عربيه', 'ليا انا', 'عشاني'] };
  const USAGE = {
    city: ['city', 'traffic', 'town', 'commute', 'school run', 'short trips', 'inside cairo', 'زحمه', 'المدينه', 'جوه البلد', 'مشاوير', 'الشغل', 'المدرسه', 'المدارس', 'التجمع', 'اكتوبر', 'زايد', 'مصر الجديده', 'مدينه نصر'],
    long: ['highway', 'long trips', 'long distance', 'travel', 'road trips', 'sahel', 'north coast', 'sokhna', 'upper egypt', 'alex', 'alexandria',
      'سفر', 'بسافر', 'الساحل', 'الطريق', 'طرق سريعه', 'مسافات طويله', 'السخنه', 'الصعيد', 'اسكندريه', 'الغردقه', 'شرم'],
  };
  const PT = {
    ev: ['electric', 'ev', 'evs', 'bev', 'full electric', 'كهربا', 'كهرباء', 'كهربائي', 'كهربائيه', 'كهربيه'],
    hybrid: ['hybrid', 'hybrids', 'phev', 'plug-in', 'plug in', 'هايبرد', 'هايبريد', 'هجين'],
    petrol: ['petrol', 'gasoline', 'gas', 'fuel only', 'بنزين'],
  };
  const CHINESE = ['chinese', 'china', 'صيني', 'صيني', 'الصيني', 'صينيه', 'الصين'];
  const OPEN_WORDS = ['fine', 'ok', 'okay', 'open', 'no problem', "don't mind", 'dont mind', 'عادي', 'معنديش مشكله', 'مفيش مشكله', 'ماشي', 'مش فارق', 'مش فارقه'];
  const PRIORITY = {
    pocket: ['cheap', 'cheapest', 'save money', 'saving', 'value for money', 'good value', 'best value', 'affordable', 'اوفر', 'ارخص', 'رخيصه', 'توفير', 'اقتصاديه', 'تستاهل فلوسها', 'قيمه مقابل'],
    space: ['space', 'spacious', 'roomy', 'big', 'bigger', 'large', 'boot', 'trunk', 'luggage', 'واسعه', 'واسع', 'كبيره', 'مساحه', 'شنطه كبيره', 'رحبه'],
    performance: ['power', 'powerful', 'performance', 'fast', 'sporty', 'torque', 'turbo', 'قويه', 'قوه', 'عزم', 'سريعه', 'تيربو', 'رياضيه', 'بتسحب', 'سحب'],
    warranty: ['warranty', 'guarantee', 'ضمان'],
    economy: ['fuel economy', 'economical', 'fuel efficient', 'efficient', 'low fuel', 'consumption', 'موفره', 'موفر', 'استهلاك', 'بنزين قليل', 'بتصرف قليل', 'مش بتصرف'],
    popular: ['popular', 'common', 'everyone buys', 'most people', 'best seller', 'bestseller', 'منتشره', 'الناس بتشتريها', 'مشهوره', 'الاكثر مبيعا', 'اكتر مبيعا', 'اكتر حاجه بتتباع'],
    // recorded, not scored: we have no evidence to rank these on
    reliability: ['reliable', 'reliability', 'dependable', "doesn't break", 'no problems', 'trouble free', 'اعتماديه', 'مبتعطلش', 'متعطلش', 'مش بتعطل', 'يعتمد عليها', 'تتحمل', 'ماتعملش مشاكل', 'مشاكلها قليله'],
    resale: ['resale', 'resell', 'sell it later', 'holds value', 'depreciation', 'بيعها', 'تتباع', 'اعاده البيع', 'سعرها يفضل', 'بتخسر', 'تمنها يفضل'],
    aftersales: ['service', 'maintenance', 'aftersales', 'after-sales', 'spare parts', 'parts', 'agency', 'dealer network', 'صيانه', 'قطع غيار', 'الوكيل', 'التوكيل', 'مراكز الخدمه', 'خدمه ما بعد البيع'],
    safety: ['safe', 'safety', 'airbags', 'ncap', 'امان', 'أمان', 'ايرباج', 'وسائد هوائيه'],
    comfort: ['comfort', 'comfortable', 'smooth', 'quiet', 'مريحه', 'راحه', 'هاديه'],
    tech: ['tech', 'technology', 'screen', 'carplay', 'android auto', 'features', 'gadgets', 'تكنولوجيا', 'شاشه', 'كماليات', 'فيتشرز', 'مميزات'],
    design: ['looks', 'design', 'beautiful', 'stylish', 'shape', 'شكل', 'شكلها', 'حلوه', 'تصميم', 'شيك'],
    brand: ['brand', 'prestige', 'badge', 'luxury', 'premium', 'ماركه', 'اسم', 'فخمه', 'فخامه', 'بريستيج'],
    easy: ['easy to drive', 'easy to park', 'parking', 'compact', 'small', 'سهله', 'سهله في الركن', 'صغيره', 'ركن', 'سهله السواقه'],
  };
  const SCORED = ['pocket', 'space', 'performance', 'warranty', 'economy', 'popular', 'easy'];
  const REF_WORDS = ['like', 'around the', 'something around', 'similar to', 'size of', 'same size', 'similar size', 'something like', 'such as', 'comparable to', 'the size',
    'زي', 'شبه', 'في حجم', 'فى حجم', 'حجم', 'قد', 'نفس حجم', 'من نوعيه', 'نوعيه', 'في مستوي', 'مستوي'];
  const CONSIDER_WORDS = ['considering', 'deciding between', 'between', 'or', 'vs', 'versus', 'compare', 'thinking about', 'looking at', 'choose between',
    'بين', 'ولا', 'او', 'بفكر في', 'محتار بين', 'متردد بين', 'بقارن', 'قدامي'];

  const EN_BRAND_ALIAS = { mercedes: 'mercedes', benz: 'mercedes', merc: 'mercedes', vw: 'volkswagen', chevy: 'chevrolet', 'land rover': 'range-rover', 'range rover': 'range-rover', citroen: 'citroen', 'alfa': 'alfa-romeo', 'lynk': 'lynk-co' };
  // short all-letter names that are safe without the brand in front
  const SAFE_SHORT = ['glc', 'gle', 'gla', 'glb', 'gls', 'cla', 'eqa', 'eqb', 'eqs', 'rx9'];

  // in Egyptian Arabic "جيب" means any SUV, not the Jeep brand
  const NOT_BRAND = ['جيب', 'چيب'];
  let INDEX = null;
  function buildIndex(models) {
    const brands = {}, aliases = [];
    for (const m of models) {
      const b = m.brand_id;
      const bn = [norm(m.brand), norm(m.brand).split(/[\s-]/)[0], ...(m.ar && m.ar.brand || []).map(norm)];
      (brands[b] = brands[b] || new Set());
      bn.forEach(x => x && x.length > 1 && !NOT_BRAND.includes(x) && brands[b].add(x));
      const names = new Set([norm(m.model), norm(m.model).replace(/-/g, ' '), norm(m.model).replace(/[\s-]/g, ''), ...(m.ar && m.ar.model || []).map(norm)]);
      for (const n of names) {
        if (!n) continue;
        const letters = /[a-zء-ي]/.test(n), digits = /\d/.test(n);
        const standalone = n.length >= 4 && !/^\d+$/.test(n) || (letters && digits && n.length >= 2) || SAFE_SHORT.includes(n) || /[ء-ي]/.test(n) && n.length >= 3;
        aliases.push({ id: m.id, brand: b, alias: n, standalone, reg: (m.reg && m.reg.last12) || 0, u: !!m.u });
      }
    }
    for (const [a, b] of Object.entries(EN_BRAND_ALIAS)) if (brands[b]) brands[b].add(a);
    aliases.sort((x, y) => y.alias.length - x.alias.length);
    INDEX = { brands, aliases };
    return INDEX;
  }

  function findBrands(t) {
    const out = [];
    for (const [b, names] of Object.entries(INDEX.brands)) {
      for (const n of names) {
        const re = new RegExp(B + esc(n) + E, 'g');
        let m; while ((m = re.exec(t))) out.push({ brand: b, idx: m.index + (m[0].length - n.length), len: n.length });
      }
    }
    return out;
  }

  function findModels(t, brandHits) {
    const hits = [], taken = [];
    const overlaps = (s, e, al) => taken.some(([a, b, x]) => s < b && e > a && x !== al);
    for (const a of INDEX.aliases) {
      const re = new RegExp(B + esc(a.alias) + E, 'g');
      let m;
      while ((m = re.exec(t))) {
        const s = m.index + (m[0].length - a.alias.length), e = s + a.alias.length;
        if (overlaps(s, e, a.alias)) continue;
        const bh = brandHits.find(h => h.brand === a.brand && h.idx < s && s - (h.idx + h.len) <= 3);
        if (!a.standalone && !bh) continue;
        // "7 seats" / "2024" are not models
        if (/^\d{4}$/.test(a.alias)) continue;
        hits.push({ ...a, idx: bh ? bh.idx : s, end: e, withBrand: !!bh });
        taken.push([s, e, a.alias]);
      }
    }
    // same alias for several brands: keep the one with a brand next to it, else the most registered
    const byPos = {};
    for (const h of hits) { const k = h.end; (byPos[k] = byPos[k] || []).push(h); }
    const out = [];
    for (const list of Object.values(byPos)) {
      list.sort((x, y) => (y.withBrand - x.withBrand) || (y.u - x.u) || (y.reg - x.reg));
      if (!out.some(o => o.id === list[0].id)) out.push(list[0]);
    }
    return out.sort((a, b) => a.idx - b.idx);
  }

  function parse(text, models) {
    if (!INDEX) buildIndex(models);
    const raw = String(text || '');
    const t = ' ' + norm(raw) + ' ';
    const r = { text: raw, extracted: [] };
    const got = k => r.extracted.push(k);

    const bud = parseBudget(t);
    if (bud) { Object.assign(r, bud); got('budget'); }
    else if (has(t, STRETCH)) r.stretch = true;

    // body (negated words exclude that body)
    const bodies = [], notBodies = [];
    for (const [k, words] of Object.entries(BODY)) {
      const i = find(t, words.map(esc));
      if (i >= 0) (negatedBefore(t, i + 1) ? notBodies : bodies).push(k);
    }
    if (bodies.length) { r.body = bodies; got('body'); }
    if (notBodies.length) r.notBody = notBodies;

    if (has(t, SEVEN.map(esc)) || /(?:^|\D)7\s*(?:-|\s)?(?:seat|seater|passenger|راكب|ركاب|كراسي|كرسي|مقاعد|مقعد|افراد|نفر)/.test(t)) { r.seats = 7; got('seats'); }
    else if (has(t, FIVE.map(esc))) { r.seats = 5; got('seats'); }

    const who = [];
    for (const [k, words] of Object.entries(FAMILY)) if (has(t, words.map(esc))) who.push(k);
    if (who.length) { r.who = who; got('who'); }

    const city = has(t, USAGE.city.map(esc)), long = has(t, USAGE.long.map(esc));
    if (city || long) { r.usage = city && long ? 'mixed' : city ? 'city' : 'long'; got('usage'); }

    // powertrain: "no electric" -> exclude; "hybrid" -> prefer
    const ptWant = [], ptNot = [];
    for (const [k, words] of Object.entries(PT)) {
      const i = find(t, words.map(esc));
      if (i >= 0) (negatedBefore(t, i + 1) ? ptNot : ptWant).push(k);
    }
    if (ptNot.includes('ev') && !ptWant.length) { r.pt = 'no_ev'; got('pt'); }
    else if (ptWant.length === 1) { r.pt = ptWant[0]; got('pt'); }
    else if (ptWant.includes('hybrid')) { r.pt = 'hybrid'; got('pt'); }

    const ci = find(t, CHINESE.map(esc));
    if (ci >= 0) {
      const after = t.slice(ci, ci + 40);
      if (negatedBefore(t, ci + 1) || /(?:no|not|avoid|بلاش|مش|لا)/.test(after.slice(0, 18)) && !OPEN_WORDS.some(w => after.includes(w))) r.chinese = 'exclude';
      else if (OPEN_WORDS.some(w => after.includes(w)) || OPEN_WORDS.some(w => t.slice(Math.max(0, ci - 25), ci).includes(w))) r.chinese = 'open';
      else r.chinese = 'open';
      got('chinese');
    }

    const pr = [];
    for (const [k, words] of Object.entries(PRIORITY)) if (has(t, words.map(esc))) pr.push(k);
    // "big" inside "7 seats for a big family" still means space; "brand" words next to a model name are about that model
    if (pr.length) { r.priorities = pr.filter(p => SCORED.includes(p)); r.checks = pr.filter(p => !SCORED.includes(p)); got('priorities'); }

    // brands and models
    const bh = findBrands(t);
    const mh = findModels(t, bh);
    const modelBrandIdx = new Set(mh.filter(h => h.withBrand).map(h => h.idx));
    const bare = bh.filter(h => !modelBrandIdx.has(h.idx) && !mh.some(x => x.brand === h.brand && Math.abs(x.idx - h.idx) < 4));
    const prefer = [], avoid = [];
    for (const h of bare) (negatedBefore(t, h.idx + 1) ? avoid : prefer).push(h.brand);
    if (prefer.length) r.brandsPrefer = [...new Set(prefer)];
    if (avoid.length) r.brandsExclude = [...new Set(avoid)];

    const mentions = [];
    for (const h of mh) {
      const pre = t.slice(Math.max(0, h.idx - 26), h.idx);
      const post = t.slice(h.end, h.end + 14);
      const isRef = REF_WORDS.some(w => new RegExp(B + esc(w) + '\\s*(?:\\S+\\s*){0,3}$').test(pre)) || /^(?:'s|s)?\s*(?:size|price|class|sized|حجم|مقاس)/.test(post);
      const neg = negatedBefore(t, h.idx + 1);
      mentions.push({ id: h.id, role: neg ? 'avoid' : isRef ? 'reference' : 'consider' });
    }
    if (mentions.length) { r.mentions = mentions; got('models'); }
    return r;
  }

  const api = { parse, norm, buildIndex, SCORED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIBrief = api;
})(typeof window !== 'undefined' ? window : globalThis);
