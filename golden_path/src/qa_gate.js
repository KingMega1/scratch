// CarIndex Buyer Check QA gate. Deterministic, no LLM. Runs after render, before Telegram.
// Any failure => the post stops (logged + Telegram alert), it never reaches approval.
// Used verbatim inside the n8n "QA Gate" Code node and by run_golden_path.js.

const QA_ROLES = ['cover', 'key_fact', 'why_it_matters', 'strengths', 'caveat', 'cta_source'];
const QA_HYPE = [
  /\bamazing\b/i, /\bincredible\b/i, /\bmust[- ]buy\b/i, /\bunbeatable\b/i, /\bgame[- ]changer\b/i,
  /\brevolutionary\b/i, /\binsane\b/i, /\bdon'?t miss\b/i, /\bdeal of the (year|century)\b/i,
  /رهيب/, /خرافي/, /أسطوري/, /اسطوري/, /متفوتش/, /لا تفوت/, /صفقة العمر/, /جبار/, /\bوحش\b/,
];
// Superlative CLAIMS only. Adverbs ("compare the Pro only", "confirm first") and comparatives
// with an explicit sourced amount ("أرخص بـ15,000") are not superlatives (false positives seen in test run 1).
const QA_SUPERLATIVE = [
  /\bcheapest\b/i, /\bbest\b(?!-selling)/i, /\bthe first\b/i, /\bfirst[- ]ever\b/i, /\bfor the first time\b/i,
  /\bthe only\b/i, /\bonly (one|car|model|suv|sedan|hybrid|ev)\b/i, /\bmost[- ](?!of\b)\w+/i, /\blargest\b/i, /\bfastest\b/i, /\blowest\b/i, /\bhighest\b/i,
  /الأرخص/, /أرخص (عربية|سيارة|فئة|كروس|SUV|سيدان|حاجة|طريقة)/, /الأفضل/, /أفضل (عربية|سيارة|اختيار)/,
  /لأول مرة/, /الأول(ى)? (في|على)/, /الوحيد/, /الأكبر/, /الأسرع/, /الأكثر/, /أكتر (موديل|عربية|سيارة|علامة)/,
];
const QA_LIMITS = { hook_ar: 70, hook_en: 80, title: 60, body: 220, point: 120 };
const AR_LETTER = /[؀-ۿ]/;
const AR_INDIC_DIGIT = /[٠-٩۰-۹]/;

function qaNumbers(text) {
  // Latin numbers like 1,080,000 / 6.92 / 145 -> normalized strings without separators.
  // Digits glued to a preceding Latin letter are model names (S05, U5, RX9), not claims.
  const out = [];
  const re = /(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[0].replace(/,/g, '').replace(/\.0+$/, ''));
  return out;
}

function qaNorm(v) {
  return v === null || v === undefined ? null : String(v).replace(/,/g, '').replace(/\.0+$/, '').trim();
}

// Text pairs (ar/en) that end up on slides or captions.
function qaTextPairs(c) {
  const pairs = [];
  // hook is printed on the cover, top-level caveat mirrors the caveat slide: inherit their facts.
  const factsOf = role => ((c.slides || []).find(s => s && s.role === role) || {}).fact_ids || [];
  if (c.hook) pairs.push({ where: 'hook', ar: c.hook.ar, en: c.hook.en, limitAr: QA_LIMITS.hook_ar, limitEn: QA_LIMITS.hook_en, facts: factsOf('cover') });
  if (c.caveat) pairs.push({ where: 'caveat', ar: c.caveat.ar, en: c.caveat.en, limitAr: QA_LIMITS.body, limitEn: QA_LIMITS.body, facts: factsOf('caveat') });
  for (const s of c.slides || []) {
    const facts = s.fact_ids || [];
    pairs.push({ where: `slide ${s.n} title`, ar: s.title_ar, en: s.title_en, limitAr: QA_LIMITS.title, limitEn: QA_LIMITS.title, facts });
    if (s.body_ar !== undefined || s.body_en !== undefined) {
      pairs.push({ where: `slide ${s.n} body`, ar: s.body_ar, en: s.body_en, limitAr: QA_LIMITS.body, limitEn: QA_LIMITS.body, facts });
    }
    (s.points || []).forEach((p, i) => pairs.push({ where: `slide ${s.n} point ${i + 1}`, ar: p.ar, en: p.en, limitAr: QA_LIMITS.point, limitEn: QA_LIMITS.point, facts: facts.concat(p.fact_ids || []) }));
    (s.skip_if || []).forEach((p, i) => pairs.push({ where: `slide ${s.n} skip_if ${i + 1}`, ar: p.ar, en: p.en, limitAr: QA_LIMITS.point, limitEn: QA_LIMITS.point, facts }));
  }
  return pairs;
}

function qaDerivedOk(k, byId) {
  // derived: {"op": "diff"|"sum"|"pct_change", "of": ["kA","kB"]}  (diff = A - B)
  const d = k.derived;
  if (!d || !Array.isArray(d.of) || d.of.length !== 2) return false;
  const [a, b] = d.of.map(id => byId[id]);
  if (!a || !b || a.status !== 'verified' || b.status !== 'verified') return false;
  const x = Number(qaNorm(a.value)), y = Number(qaNorm(b.value)), v = Number(qaNorm(k.value));
  if (!isFinite(x) || !isFinite(y) || !isFinite(v)) return false;
  let expect;
  if (d.op === 'diff') expect = x - y;
  else if (d.op === 'sum') expect = x + y;
  else if (d.op === 'pct_change') expect = Math.round(((x - y) / y) * 10000) / 100;
  else return false;
  return Math.abs(Math.abs(expect) - Math.abs(v)) < 0.01;
}

// content: parsed Buyer Check JSON
// image: {url|path, source_url|library_ref, credit, ai_generated, registry_status, vehicle, width, height}
// rendered: [{filename, url|path, width, height, bytes}] in slide order
// opts: {postId, today: 'YYYY-MM-DD'}
function runQaGate(content, image, rendered, opts) {
  const failures = [];
  const warnings = [];
  const fail = (check, msg) => failures.push(`[${check}] ${msg}`);
  const warn = (check, msg) => warnings.push(`[${check}] ${msg}`);
  const c = content || {};

  // 1. Required fields
  if (c.format !== 'buyer_check') fail('fields', `format must be "buyer_check" (got ${JSON.stringify(c.format)})`);
  for (const f of ['language', 'story_type', 'objective']) if (!c[f]) fail('fields', `missing ${f}`);
  if (!c.car || !c.car.make || !c.car.model) fail('fields', 'missing car.make / car.model');
  if (!c.hook || !c.hook.ar || !c.hook.en) fail('fields', 'missing hook.ar / hook.en');
  if (!c.caveat || !c.caveat.ar || !c.caveat.en) fail('fields', 'missing caveat.ar / caveat.en');
  if (!c.visual_direction) fail('fields', 'missing visual_direction');
  if (!Array.isArray(c.key_data) || !c.key_data.length) fail('fields', 'key_data is empty');

  // 2. Slide count / order
  const slides = Array.isArray(c.slides) ? c.slides : [];
  if (slides.length !== 6) fail('slides', `expected 6 slides, got ${slides.length}`);
  QA_ROLES.forEach((role, i) => {
    if (!slides[i] || slides[i].role !== role || slides[i].n !== i + 1) fail('slides', `slide ${i + 1} must be role "${role}"`);
  });
  const st = slides.find(s => s && s.role === 'strengths');
  if (st && (!Array.isArray(st.points) || st.points.length < 2 || st.points.length > 3)) fail('slides', 'strengths needs 2-3 points');
  const cv = slides.find(s => s && s.role === 'caveat');
  if (cv && (!Array.isArray(cv.skip_if) || cv.skip_if.length < 1 || cv.skip_if.length > 2)) fail('slides', 'caveat needs 1-2 skip_if items');

  // 3. Sources
  const sources = Array.isArray(c.sources) ? c.sources : [];
  if (!sources.length) fail('source', 'no sources');
  const srcById = {};
  for (const s of sources) {
    srcById[s.id] = s;
    if (!s.outlet || !/^https?:\/\//.test(s.url || '') || !/^\d{4}-\d{2}-\d{2}$/.test(s.published || '')) {
      fail('source', `source ${s.id} needs outlet, http(s) url and published YYYY-MM-DD`);
    }
  }

  // 4. key_data integrity
  const byId = {};
  for (const k of c.key_data || []) byId[k.id] = k;
  for (const k of c.key_data || []) {
    if (k.status === 'verified') {
      if (qaNorm(k.value) === null || qaNorm(k.value) === '') fail('facts', `${k.id} verified but has no value`);
      if (k.derived) {
        if (!qaDerivedOk(k, byId)) fail('facts', `${k.id} derived value ${k.value} does not match ${k.derived.op} of ${(k.derived.of || []).join(',')}`);
      } else if (!k.source_id || !srcById[k.source_id]) {
        fail('facts', `${k.id} (${k.label_en}) has no valid source_id`);
      }
    } else if (k.status === 'missing' || k.status === 'conflict') {
      if (k.value !== null && k.value !== undefined && k.value !== '') fail('facts', `${k.id} is ${k.status} but carries a value`);
    } else {
      fail('facts', `${k.id} has invalid status ${JSON.stringify(k.status)}`);
    }
  }
  const kf = slides.find(s => s && s.role === 'key_fact');
  const headline = kf && byId[(kf.fact_ids || [])[0]];
  if (!headline) fail('facts', 'key_fact slide has no fact');
  else if (headline.status !== 'verified') fail('facts', `key_fact ${headline.id} is ${headline.status} - the post's main number must be verified`);
  else if (opts && opts.today && srcById[headline.source_id]) {
    const hs = srcById[headline.source_id];
    const ageDays = (Date.parse(opts.today) - Date.parse(hs.published)) / 86400000;
    if (ageDays > 14) warn('source', `headline figure comes from ${hs.outlet} (${hs.published}), ${Math.round(ageDays)} days old - re-check it is still current`);
  }
  for (const s of slides) for (const id of (s && s.fact_ids) || []) if (!byId[id]) fail('facts', `slide ${s.n} references unknown fact ${id}`);

  // 5. Every number in text must be a verified key_data value
  const verifiedNums = new Set((c.key_data || []).filter(k => k.status === 'verified').map(k => qaNorm(k.value)));
  const allowed = n => verifiedNums.has(n) || (/^\d$/.test(n)) || (/^20[2-3]\d$/.test(n));
  const pairs = qaTextPairs(c);
  const claimFacts = (c.key_data || []).filter(k => k.status === 'verified' && k.claim);
  for (const p of pairs) {
    for (const lang of ['ar', 'en']) {
      const t = p[lang] || '';
      for (const n of qaNumbers(t)) if (!allowed(n)) fail('claims', `${p.where} (${lang}) states "${n}" which is not a verified key_data value`);
      for (const re of QA_HYPE) if (re.test(t)) fail('hype', `${p.where} (${lang}) uses forbidden word ${re}`);
      for (const re of QA_SUPERLATIVE) {
        if (re.test(t)) {
          const covered = claimFacts.some(k => p.facts.includes(k.id));
          if (!covered) fail('claims', `${p.where} (${lang}) has superlative ${re} without a sourced claim fact on that slide`);
        }
      }
    }
    // 6. Arabic / English consistency
    if (!p.ar || !p.en) fail('language', `${p.where}: both ar and en required`);
    if (p.ar && !AR_LETTER.test(p.ar)) fail('language', `${p.where}: ar text has no Arabic script`);
    if (p.ar && AR_INDIC_DIGIT.test(p.ar)) fail('language', `${p.where}: ar text uses Arabic-Indic digits, use Latin digits`);
    if (p.en && AR_LETTER.test(p.en)) fail('language', `${p.where}: en text contains Arabic script`);
    const na = new Set(qaNumbers(p.ar)), ne = new Set(qaNumbers(p.en));
    const diff = [...na].filter(x => !ne.has(x)).concat([...ne].filter(x => !na.has(x)));
    if (diff.length) fail('language', `${p.where}: numbers differ between ar and en (${diff.join(', ')})`);
    if (p.ar && p.ar.length > p.limitAr) fail('length', `${p.where} ar is ${p.ar.length} chars (max ${p.limitAr})`);
    if (p.en && p.en.length > p.limitEn) fail('length', `${p.where} en is ${p.en.length} chars (max ${p.limitEn})`);
  }

  // 7. Image
  const img = image || {};
  if (!img.url && !img.path) fail('image', 'no image');
  if (img.ai_generated) fail('image', 'image is AI-generated - real image required');
  if (!img.source_url && !img.library_ref) fail('image', 'image has no provenance (source_url or library_ref)');
  if (img.registry_status !== 'approved') fail('image', `image registry status is ${JSON.stringify(img.registry_status || 'unknown')}, must be "approved"${(img.registry_reasons || []).length ? ' (' + img.registry_reasons.join('; ') + ')' : ''}`);
  for (const w of img.registry_warnings || []) if (!/original source/.test(w)) warn('image', w);
  if (img.width && img.width < 600) fail('image', `image width ${img.width}px < 600px`);
  else if (img.width && img.width < 1000) warn('image', `image width ${img.width}px, will be upscaled on the cover`);
  if (!img.source_url && img.library_ref) warn('image', 'image original source not recorded - confirm usage rights before posting');
  if (c.car && c.car.model) {
    // make + model only (trims are rarely visible); model keeps its suffix, e.g. "Monjaro EM-i".
    const want = [c.car.make, c.car.model].filter(Boolean).join(' ').toLowerCase().split(/\s+/).filter(Boolean);
    const have = String(img.vehicle || '').toLowerCase();
    const missingTok = want.filter(t => !have.includes(t));
    if (!img.vehicle) fail('image', 'image vehicle not recorded - cannot confirm it shows this car');
    else if (missingTok.length) fail('image', `image shows "${img.vehicle}", post is about "${want.join(' ')}" (missing: ${missingTok.join(', ')})`);
  }

  // 8. Rendered files + filenames
  const r = Array.isArray(rendered) ? rendered : [];
  if (r.length !== 6) fail('render', `expected 6 rendered files, got ${r.length}`);
  QA_ROLES.forEach((role, i) => {
    const f = r[i];
    const expected = `${opts && opts.postId}_${String(i + 1).padStart(2, '0')}_${role}.png`;
    if (!f) return;
    if (f.filename !== expected) fail('filename', `slide ${i + 1} file is "${f.filename}", expected "${expected}"`);
    if (!f.url && !f.path) fail('render', `slide ${i + 1} has no file url/path`);
    if (f.exists === false) fail('render', `slide ${i + 1} file missing on disk/server`);
    if (f.width && f.height && (f.width !== 1080 || f.height !== 1350)) fail('render', `slide ${i + 1} is ${f.width}x${f.height}, expected 1080x1350`);
    if (typeof f.bytes === 'number' && f.bytes < 20000) fail('render', `slide ${i + 1} is ${f.bytes} bytes - likely blank`);
    if (f.overflow && f.overflow.length) fail('render', `slide ${i + 1} text overflow in: ${f.overflow.join(', ')}`);
  });

  return { passed: failures.length === 0, failures, warnings, checkedAt: new Date().toISOString() };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runQaGate, qaNumbers };
}
