// P1 transport tests (no browser). Run from buyer-decision/: node tests/transport/transport.test.js
// 1. engine equivalence: transport result == released engine on the regression corpus (and == regression snapshot)
// 2. accepted view (published projection) == full internal data for every corpus decision
// 3. determinism + share round-trip   4. ci.reco.v1 schema   5. engine-owned EN/AR copy exact (incl. U+2019)
// 6. privacy: no free text / notes / unresolved phrases in the result   7. parser behaviour through the transport
// 8. data swap: a different accepted snapshot runs through the same code   9. dataset integrity guards   10. no DOM
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const T = require(path.join(ROOT, 'transport/reco.js'));
const { E, I } = T._internals;

let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const ENGINE_SHA_BEFORE = sha('app/engine.js');

const ds = T.loadLaunchSnapshot();
const full = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/p11_client.js'), 'utf8'), ctx); return ctx.window.CI_UNIVERSE; })();
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/regression/corpus.json'), 'utf8'));
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/regression/snapshot.json'), 'utf8'));
const AS_OF = '2026-10-07';
const ids = r => (r.hero ? [r.hero.id, ...r.alts.map(a => a.id)] : []);
const decision = r => JSON.stringify({ ids: ids(r), roles: r.hero ? [r.hero, ...r.alts].map(x => x.role) : [], equal: !!r.equal, tier: r.tier, less: r.less ? r.less.id : null,
  conf: r.confidence ? [r.confidence.level, r.confidence.depends, r.confidence.vs || null] : null, near: (r.nearestAbove || []).map(x => x.id), fixes: (r.nearest || []).map(f => f.key),
  stretch: r.hero ? [r.hero, ...r.alts].map(x => (x.stretch ? [x.stretch.over, x.stretch.buys, x.stretch.vs] : null)) : [], ceil: r.terr.ceil, eligible: r.eligible && r.eligible.length });

// ---- 1-2. engine equivalence ----
const snapMode = r => (!r.hero ? (r.nearestAbove ? 'nearest_only' : 'no_match') : r.shortlist && r.shortlist.allOut ? 'conflict' : r.heroFromShortlist ? 'shortlist' : r.equal ? 'equal' : 'clear');
for (const c of corpus) {
  const rFull = E.recommend(full, JSON.parse(JSON.stringify(c.brief)));
  const rView = E.recommend(ds.U, JSON.parse(JSON.stringify(c.brief)));
  ok(decision(rFull) === decision(rView), `${c.id}: accepted view decides differently from internal data`);
  const s = snap[c.id];
  ok(s && s.hero === (rView.hero ? rView.hero.id : null) && JSON.stringify(s.alts) === JSON.stringify(rView.hero ? rView.alts.map(a => a.id) : []) && s.less === (rView.less ? rView.less.id : null) && s.mode === snapMode(rView),
    `${c.id}: differs from regression snapshot`);
  for (const locale of T.LOCALES) {
    const o = T.execute(c.brief, ds, { locale, asOf: AS_OF });
    ok(JSON.stringify(o.hero ? [o.hero.id, ...o.alternatives.map(a => a.id)] : []) === JSON.stringify(ids(rView)), `${c.id}/${locale}: transport ids != engine`);
    ok((o.less ? o.less.id : null) === (rView.less && rView.hero ? rView.less.id : null), `${c.id}/${locale}: less differs`);
    ok(JSON.stringify(o.confidence) === JSON.stringify(rView.confidence ? { level: rView.confidence.level, depends: rView.confidence.depends, vs: rView.confidence.vs || null } : null), `${c.id}/${locale}: confidence differs`);
    ok(o.engine_version === E.ENGINE_VERSION && o.universe_version === 'U11-2026-09-26' && o.dataset.sha256 === ds.sha256, `${c.id}/${locale}: provenance`);
    // ---- 3. determinism + share ----
    const o2 = T.execute(JSON.parse(JSON.stringify(c.brief)), ds, { locale, asOf: AS_OF });
    ok(JSON.stringify(o) === JSON.stringify(o2), `${c.id}/${locale}: non-deterministic`);
    const nb = T.normalize(c.brief, ds), viaNorm = T.execute(nb, ds, { locale, asOf: AS_OF }), viaShare = T.execute(T.decodeShare(viaNorm.share.r, ds), ds, { locale, asOf: AS_OF });
    ok(viaShare.result_id === viaNorm.result_id && JSON.stringify(viaShare.hero && viaShare.hero.id) === JSON.stringify(viaNorm.hero && viaNorm.hero.id), `${c.id}/${locale}: share link does not reproduce the confirmed result`);
    ok(T.execute(T.decodeShare(viaShare.share.r, ds), ds, { locale, asOf: AS_OF }).share.r === viaShare.share.r, `${c.id}/${locale}: share token not stable`);
    // ---- 4. schema ----
    const errs = validate(o); ok(!errs.length, `${c.id}/${locale}: schema ${errs.slice(0, 3).join('; ')}`);
    // ---- 6. privacy ----
    const json = JSON.stringify(o);
    for (const s of [c.brief.text, c.brief.notes, ...((c.brief.unresolved || []).map(u => u.text))].filter(x => x && x.length > 6)) ok(!json.includes(s), `${c.id}/${locale}: buyer free text leaks into ci.reco.v1`);
    ok(!['text', 'notes', 'unresolved', 'mentions', 'extracted'].some(k => k in o.share.brief), `${c.id}/${locale}: non-share-safe key in share.brief`);
    ok(!/"(lead|score|parts|F|basis|gain|fit_score|weights?)":/.test(json), `${c.id}/${locale}: internal scoring field exposed`);
    ok(o.dir === (locale === 'ar' ? 'rtl' : 'ltr'), `${c.id}/${locale}: dir`);
  }
}

// ---- 5. engine-owned copy exact (EN/AR), incl. punctuation/Unicode ----
const fresh = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'app/i18n.js'), 'utf8'), ctx); return ctx.window.CII18N.S; })();
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v]] : v && typeof v === 'object' ? flat(v, p + k + '.') : []));
ok(JSON.stringify(flat(I.S.en)) === JSON.stringify(flat(fresh.en)) && JSON.stringify(flat(I.S.ar)) === JSON.stringify(flat(fresh.ar)), 'transport copy != released i18n.js');
ok(I.S.en.dep.unknown_data === 'Details we don’t have yet for some of these cars', 'EN dependency copy (curly apostrophe U+2019)');
ok(I.S.en.dep.space === 'How much space matters to you', 'EN space dependency');
ok(I.S.ar.dep.space === 'المساحة مهمة لك قد إيه' && I.S.ar.dep.unknown_data === 'معلومات لسه ناقصانا عن بعض العربيات دي', 'AR dependency copy');
ok(I.S.ar.change_h === 'إيه اللي ممكن يغيّر الاختيار' && I.S.en.change_h === 'What could change the answer', 'change heading EN/AR');
ok(I.S.en.eyebrow_lean === 'Our current pick' && I.S.ar.eyebrow_lean === 'اختيارنا دلوقتي' && I.S.en.equal_h === 'Strong matches' && I.S.ar.equal_h === 'اختيارات قوية', 'state labels EN/AR');
{ // a known lean result end to end (IM 5, depends space + unknown_data)
  const b = { budget: 2000000, budgetMode: 'max', priorities: ['space', 'economy'] };
  const en = T.execute(b, ds, { locale: 'en', asOf: AS_OF }), ar = T.execute(b, ds, { locale: 'ar', asOf: AS_OF });
  ok(en.hero.id === 'im/im-5' && en.confidence.level === 'lean' && JSON.stringify(en.confidence.depends) === '["space","unknown_data"]', 'lean example');
  ok(en.eyebrow.text === 'Our current pick' && ar.eyebrow.text === 'اختيارنا دلوقتي' && en.hero.why_heading === 'Why this one', 'lean labels');
  ok(en.hero.what_could_change[0].text === 'How much space matters to you' && en.hero.what_could_change[1].text === 'Details we don’t have yet for some of these cars', 'EN what could change (exact)');
  ok(ar.hero.what_could_change[0].text === 'المساحة مهمة لك قد إيه' && ar.hero.what_could_change[1].text === 'معلومات لسه ناقصانا عن بعض العربيات دي', 'AR what could change (exact)');
  ok(en.hero.versions.every(v => v.stale === true) && en.price_as_of === AS_OF, 'stale state (IM 5 priced 2026-09-10, 27 days before as-of)');
  ok(en.result_id === T.execute(b, ds, { locale: 'en', asOf: '2027-01-01' }).result_id, 'result_id independent of as-of date');
}
{ // tie: equal cards, no eyebrow
  const o = T.execute({ budget: 2000000, budgetMode: 'max', body: ['suv'], priorities: ['space', 'economy'] }, ds, { locale: 'ar', asOf: AS_OF });
  ok(o.mode === 'equal' && o.equal.heading === 'اختيارات قوية' && o.eyebrow === null && [o.hero, ...o.alternatives].every(x => x.role === 'equal' && x.card), 'tie result');
  ok(JSON.stringify([o.hero.id, ...o.alternatives.map(a => a.id)]) === '["geely/okavango","baic/bj30","dongfeng/008"]', 'tie set');
}

// ---- 7. parser behaviour through the transport (comparative floor vs exclusion, EN/AR) ----
const u = t => T.normalize(T.understand(t, ds), ds);
{
  const a = u('SUV around 1.5M, 7 seats, no Chinese brands, nothing below a Hyundai');
  ok(!(a.brandsExclude || []).length && a.chinese === 'exclude' && a.seats === 7 && (a.unresolved || []).some(x => x.kind === 'brand_floor' && x.brand === 'hyundai' && x.text === 'nothing below a Hyundai'), 'EN floor stays unresolved');
  ok(T.summary(a, ds).some(r => r.key === 'unresolved' && r.label === 'Not applied' && r.value.text.includes('“nothing below a Hyundai”')), 'EN confirm row: Not applied');
  const o = T.execute(a, ds, { locale: 'en', asOf: AS_OF });
  ok(!o.brief_bar.some(r => r.key === 'unresolved') && !JSON.stringify(o).includes('nothing below'), 'unresolved phrase not in result');
  ok(JSON.stringify(u('SUV around 1.5M, exclude Hyundai').brandsExclude) === '["hyundai"]', 'EN exclude is hard');
  const r1 = T.execute(u('SUV around 1.5M, exclude Hyundai'), ds, { asOf: AS_OF });
  ok(![r1.hero, ...r1.alternatives].filter(Boolean).some(x => x.id.startsWith('hyundai/')), 'EN exclude: no Hyundai recommended');
  const f = u('عايز عربية عالية في حدود 1.5 مليون، مش عايز اقل من هيونداي');
  ok(!(f.brandsExclude || []).length && (f.unresolved || []).some(x => x.brand === 'hyundai'), 'AR floor stays unresolved');
  ok(T.summary(f, ds, { locale: 'ar' }).some(r => r.key === 'unresolved' && r.label === 'ماطبقناهوش'), 'AR confirm row');
  for (const t of ['عايز عربية عالية في حدود 1.5 مليون، مش عايز هيونداي', 'عايز عربية عالية في حدود 1.5 مليون، استبعد هيونداي']) ok(JSON.stringify(u(t).brandsExclude) === '["hyundai"]', `AR exclusion: ${t}`);
}

// ---- 8. data swap: another accepted snapshot through the same code ----
{
  // controlled fixture from the accepted U11 view itself: no new vehicle facts, a different (smaller) accepted set + version
  const base = T.execute({ budget: 2000000, budgetMode: 'max', priorities: ['space', 'economy'] }, ds, { asOf: AS_OF });
  const drop = new Set([base.hero.id]);
  const fixture = { meta: { ...ds.U.meta, version: 'TEST-U11-MINUS-HERO' }, models: ds.U.models.filter(m => !drop.has(m.id)) };
  const ds2 = T.loadAcceptedDataset(fixture);
  const b = { budget: 2000000, budgetMode: 'max', priorities: ['space', 'economy'] };
  const o = T.execute(b, ds2, { asOf: AS_OF });
  ok(ds2.universe_version === 'TEST-U11-MINUS-HERO' && o.universe_version === 'TEST-U11-MINUS-HERO' && o.dataset.sha256 === ds2.sha256 && o.dataset.sha256 !== ds.sha256, 'swap: provenance follows the dataset');
  ok(o.hero && o.hero.id !== base.hero.id && !drop.has(o.hero.id), 'swap: result follows the dataset');
  const direct = E.recommend(fixture, b);
  ok(o.hero.id === direct.hero.id && JSON.stringify(o.alternatives.map(a => a.id)) === JSON.stringify(direct.alts.map(a => a.id)), 'swap: transport == engine on the new dataset');
  ok(o.result_id !== base.result_id, 'swap: result_id changes with the dataset');
  // the same snapshot written as a versioned directory + manifest loads identically
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ci-ds-'));
  const body = JSON.stringify(fixture) + '\n';
  fs.writeFileSync(path.join(dir, 'recommendation_view.json'), body);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ schema: 'ci.dataset.v1', dataset_id: 'TEST-U11-MINUS-HERO/recommendation_view', universe_version: 'TEST-U11-MINUS-HERO', file: 'recommendation_view.json', sha256: crypto.createHash('sha256').update(body).digest('hex'), registry: { snapshot_id: 'TEST-REG', registration_months: null, last12_window: null } }));
  const ds3 = T.loadAcceptedDataset(dir), o3 = T.execute(b, ds3, { asOf: AS_OF });
  ok(o3.hero.id === o.hero.id && o3.dataset.id === 'TEST-U11-MINUS-HERO/recommendation_view' && o3.registry.snapshot_id === 'TEST-REG', 'swap: directory snapshot with manifest');
  ok(sha('app/engine.js') === ENGINE_SHA_BEFORE, 'swap: engine code untouched');
  // ---- 9. integrity guards ----
  fs.writeFileSync(path.join(dir, 'recommendation_view.json'), body.replace('"TEST-U11-MINUS-HERO"', '"TEST-U11-TAMPERED"'));
  let threw = false; try { T.loadAcceptedDataset(dir); } catch (e) { threw = true; } ok(threw, 'tampered snapshot rejected');
  threw = false; try { T.loadAcceptedDataset({ meta: { version: 'X' }, models: [{ id: 'a/b', brand: 'A' }] }); } catch (e) { threw = true; } ok(threw, 'invalid dataset rejected');
  threw = false; try { T.execute(b, ds.U); } catch (e) { threw = true; } ok(threw, 'unvalidated raw object rejected by execute');
  threw = false; try { T.execute(b, ds, { locale: 'fr' }); } catch (e) { threw = true; } ok(threw, 'unsupported locale rejected');
  const man = JSON.parse(fs.readFileSync(path.join(T.LAUNCH_SNAPSHOT, 'manifest.json'), 'utf8'));
  ok(man.sha256 === sha(path.relative(ROOT, path.join(T.LAUNCH_SNAPSHOT, 'recommendation_view.json'))) && man.models_in_universe === 283 && ds.U.models.filter(m => m.u).length === 283, 'launch snapshot: manifest hash + 283-model universe');
}

// ---- 10. no DOM / browser globals in the execution path ----
ok(typeof document === 'undefined' && typeof window === 'undefined' && typeof localStorage === 'undefined', 'transport ran without DOM/window/storage');
for (const f of ['transport/reco.js', 'app/present.js', 'app/engine.js', 'app/brief.js']) ok(!/\bdocument\.|localStorage|sessionStorage|navigator\.|location\.|history\./.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f}: browser API reference`);

console.log(`transport: ${n - fails}/${n} checks pass (${corpus.length} corpus briefs x EN/AR)`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);

// ---------- minimal JSON-schema check (the subset ci.reco.v1 uses) ----------
function validate(obj) {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'transport/ci.reco.v1.schema.json'), 'utf8'));
  const errs = [];
  const typeOk = (v, t) => (t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'integer' ? Number.isInteger(v) : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : typeof v === t);
  const run = (s, v, p) => {
    if (s.$ref) s = schema.$defs[s.$ref.split('/').pop()];
    if (s.oneOf) { const okk = s.oneOf.filter(x => { const e0 = errs.length; run(x, v, p); const good = errs.length === e0; errs.length = e0; return good; }); if (okk.length !== 1) errs.push(`${p}: oneOf matched ${okk.length}`); return; }
    if ('const' in s && v !== s.const) errs.push(`${p}: const`);
    if (s.enum && !s.enum.includes(v)) errs.push(`${p}: enum ${v}`);
    if (s.type && ![].concat(s.type).some(t => typeOk(v, t))) { errs.push(`${p}: type`); return; }
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errs.push(`${p}: pattern`);
    if (s.required) for (const k of s.required) if (!(v && k in v)) errs.push(`${p}.${k}: required`);
    if (s.properties && v && typeof v === 'object') {
      for (const [k, ss] of Object.entries(s.properties)) if (k in v) run(ss, v[k], `${p}.${k}`);
      if (s.additionalProperties === false) for (const k of Object.keys(v)) if (!(k in s.properties)) errs.push(`${p}.${k}: not allowed`);
    }
    if (s.items && Array.isArray(v)) v.forEach((x, i) => run(s.items, x, `${p}[${i}]`));
  };
  run(schema, obj, '$');
  return errs;
}
