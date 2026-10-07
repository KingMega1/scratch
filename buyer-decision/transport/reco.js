/* P1 recommendation transport — server-callable, no DOM/browser dependency.
   execute(brief, dataset, { locale }) -> ci.reco.v1

   It runs the RELEASED P1 implementation, unchanged:
     app/engine.js   eligibility, ranking, budget/stretch, ties, confidence          (required as-is)
     app/brief.js    free-text understanding, negation, comparative-brand handling   (required as-is)
     app/i18n.js     engine-owned EN/AR copy                                          (evaluated as-is in an isolated context)
     app/present.js  WHY / trade-offs / why-not / dependencies / notices, extracted VERBATIM from app/app.js
                     by tools/build_present.mjs (drift-guarded; app.js itself is not modified)
   Vehicle data is NOT part of this module: it is an accepted, versioned dataset passed in by the caller
   (loadAcceptedDataset), so a new accepted snapshot (U12, U13, ...) replaces U11 without touching engine code. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const APP = path.join(__dirname, '..', 'app');
const E = require(path.join(APP, 'engine.js'));
const P = require(path.join(APP, 'brief.js'));
const Present = require(path.join(APP, 'present.js'));
// i18n.js is a browser script (`(function (root) {...})(window)`); run the released bytes with a plain object as `window`
const I = (() => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'i18n.js'), 'utf8'), ctx, { filename: 'i18n.js' });
  return ctx.window.CII18N;
})();

const SCHEMA = 'ci.reco.v1';
const TRANSPORT_VERSION = 'T1-2026-10-07';
const LOCALES = ['en', 'ar'];
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/* ---------------- accepted dataset interface ---------------- */
const MODEL_REQUIRED = ['id', 'brand_id', 'brand', 'model', 'body', 'trims'];
const TRIM_REQUIRED = ['label', 'min'];

// Accepts the accepted recommendation view as an object ({meta, models}: e.g. the Postgres serving projection),
// or a path to a snapshot directory/manifest/JSON file. Validates shape; with a manifest, verifies the content hash.
function loadAcceptedDataset(source, { manifest = null } = {}) {
  let view, man = manifest, raw = null;
  if (typeof source === 'string') {
    let file = source;
    if (fs.statSync(source).isDirectory()) file = path.join(source, 'manifest.json');
    if (path.basename(file) === 'manifest.json') {
      man = JSON.parse(fs.readFileSync(file, 'utf8'));
      file = path.join(path.dirname(file), man.file);
    }
    raw = fs.readFileSync(file, 'utf8');
    view = JSON.parse(raw);
  } else view = source;
  if (!view || !view.meta || typeof view.meta.version !== 'string' || !Array.isArray(view.models)) throw new Error('dataset: expected { meta: { version }, models: [] }');
  const ids = new Set();
  for (const m of view.models) {
    for (const k of MODEL_REQUIRED) if (m[k] == null) throw new Error(`dataset: model ${m.id || '?'} missing ${k}`);
    if (ids.has(m.id)) throw new Error(`dataset: duplicate model id ${m.id}`);
    ids.add(m.id);
    for (const t of m.trims) for (const k of TRIM_REQUIRED) if (t[k] == null) throw new Error(`dataset: ${m.id} trim missing ${k}`);
  }
  const content = JSON.stringify(view);
  const contentSha = sha256(content);
  if (man) {
    if (man.universe_version && man.universe_version !== view.meta.version) throw new Error(`dataset: manifest universe ${man.universe_version} != data ${view.meta.version}`);
    if (raw != null && man.sha256 && sha256(raw) !== man.sha256) throw new Error('dataset: file hash does not match manifest');
    if (man.content_sha256 && man.content_sha256 !== contentSha) throw new Error('dataset: content hash does not match manifest');
  }
  return Object.freeze({
    id: (man && man.dataset_id) || `${view.meta.version}/recommendation_view`,
    universe_version: view.meta.version,
    sha256: contentSha,
    registry: man && man.registry ? { snapshot_id: man.registry.snapshot_id, registration_months: man.registry.registration_months, last12_window: man.registry.last12_window }
      : { snapshot_id: null, registration_months: view.meta.registration_months || null, last12_window: view.meta.last12_window || null },
    U: view,
  });
}
// the pinned launch snapshot (U11, 283-model universe); any other accepted snapshot loads the same way
const LAUNCH_SNAPSHOT = path.join(__dirname, '..', 'datasets', 'U11-2026-09-26');
const loadLaunchSnapshot = () => loadAcceptedDataset(LAUNCH_SNAPSHOT);

/* ---------------- helpers ---------------- */
const presenters = new WeakMap();
function presenter(ds, locale) {
  if (!ds || !ds.U) throw new Error('execute: dataset must come from loadAcceptedDataset()');
  if (!LOCALES.includes(locale)) throw new Error(`unsupported locale ${locale}`);
  let pr = presenters.get(ds);
  if (!pr) { pr = Present.create(ds.U, E, I); presenters.set(ds, pr); }
  pr.setLang(locale);
  return pr;
}
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const text = html => String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, e => ENT[e]).replace(/\s+/g, ' ').trim();
const frag = html => ({ html, text: text(html) });
// price freshness: the P1-reviewed rule (14 days, measured against the as-of date, default today)
const STALE_DAYS = 14;
const isStale = (d, asOf) => { const t0 = Date.parse(d), t1 = Date.parse(asOf); return isFinite(t0) && isFinite(t1) && (t1 - t0) > STALE_DAYS * 864e5; };

/* ---------------- execute ---------------- */
function execute(brief, dataset, opts = {}) {
  const locale = opts.locale || 'en';
  const asOf = opts.asOf || new Date().toISOString().slice(0, 10);
  const PR = presenter(dataset, locale), S = PR.S, U = dataset.U, byId = PR.byId;
  const b = JSON.parse(JSON.stringify(brief || {}));
  const r = E.recommend(U, b); // the released browser calls exactly this with the confirmed brief (app.js renderResult)

  const token = PR.enc(PR.slim(b));
  const result_id = 'cr1_' + sha256(JSON.stringify([SCHEMA, E.ENGINE_VERSION, dataset.sha256, locale, token])).slice(0, 32);
  const mode = !r.hero ? 'no_match' : r.shortlist && r.shortlist.allOut ? 'conflict' : r.heroFromShortlist ? 'shortlist' : r.equal ? 'equal' : 'single';

  const version = t => ({ label: t.label, min: t.min, year: t.year == null ? null : t.year, official: !!t.official, date: t.date || null,
    stale: t.date ? isStale(t.date, asOf) : null, powertrain: t.plugin ? 'plugin' : t.pt || null });
  const car = (p, isHero) => {
    const m = byId[p.id], lean = PR.isLean(p, r);
    const change = lean ? [...PR.changeBlock(r).matchAll(/<li><span>([\s\S]*?)<\/span><\/li>/g)].map(x => frag(x[1])) : [];
    const above = p.all.filter(t => t.min > r.terr.ceil);
    return {
      id: p.id, brand: m.brand, model: m.model, name: frag(PR.nm(p.id)),
      role: p.role, role_label: isHero ? null : frag(S.role[p.role] || S.role.runner_up),
      size: p.sizeKey ? frag(PR.heroSizeOf(p)) : null,
      price_range: { from: p.fit[0].min, to: p.fit[p.fit.length - 1].min, ...frag(PR.heroRangeOf(p)) },
      price_note: isHero ? frag(PR.heroSubOf(p)) : null,
      pick: { label: p.pick.label, min: p.pick.min },
      versions: p.fit.map(version),
      higher_versions_from: above.length ? Math.min(...above.map(t => t.min)) : null,
      stretch: p.stretch ? { over: p.stretch.over, buys: p.stretch.buys, vs: p.stretch.vs } : null,
      why_heading: lean ? S.why_h_lean : S.why_h,
      why: PR.reasons(p, r).map(frag),
      trade_offs: PR.trades(p, r).map(frag),
      what_could_change: change,
      card: isHero && !r.equal ? null : { why: PR.reasons(p, r).slice(0, 2).map(frag), vs: (p.role === 'equal' ? [] : PR.vsLine(p, r.hero)).map(frag), html: PR.altCard(p, r.hero, r) },
      image: m.image ? { src: m.image.src, credit: m.image.credit, page: m.image.page } : null,
      html: { detail: PR.detail(p, r, !!isHero), specs: PR.specs(p), versions: PR.versionsBlock(p, r), market: PR.marketBlock(m), next_steps: PR.nextSteps(p) },
    };
  };

  const hero = r.hero ? car(r.hero, true) : null;
  const out = {
    schema: SCHEMA,
    result_id,
    engine_version: E.ENGINE_VERSION,
    universe_version: U.meta.version,
    dataset: { id: dataset.id, sha256: dataset.sha256 },
    registry: dataset.registry,
    transport_version: TRANSPORT_VERSION,
    locale, dir: S.dir,
    price_as_of: asOf, stale_after_days: STALE_DAYS,
    share: { r: token, brief: PR.slim(b) },
    mode,
    confidence: r.confidence ? { level: r.confidence.level, depends: [...r.confidence.depends], vs: r.confidence.vs || null } : null,
    eyebrow: r.hero && !r.equal ? frag(PR.eyebrowOf(r)) : null,
    budget: { amount: r.terr.budget, mode: r.brief.budgetMode || null, ceiling: r.terr.ceil, ...frag(PR.mill(r.terr.budget)) },
    brief_bar: PR.summaryRows(b).filter(x => !['budget', 'notes', 'unresolved'].includes(x.key)).map(x => ({ key: x.key, label: x.label, value: frag(x.value) })),
    notices: PR.topCardsOf(r, b).map(frag),
    hero,
    alternatives: r.hero ? r.alts.map(a => car(a, false)) : [],
    equal: r.equal ? { heading: S.equal_h, sub: S.equal_sub, tier: r.tier } : null,
    compare_html: r.hero ? PR.compareTable([r.hero, ...r.alts], r) : null,
    less: r.hero && r.less ? { id: r.less.id, price: r.less.price, saves: r.less.saves, heading: S.less_h, ...frag(PR.lessHtml(r, b)), detail_html: PR.detail(PR.packFor(r.less.id, r), r, false) } : null,
    checks: r.hero ? PR.checksOf(b).map(k => ({ key: k, ...frag(S.check[k]) })) : [],
    no_match: r.hero ? null : {
      nearest_above: (r.nearestAbove || []).map(x => ({ id: x.id, price: x.price, over: x.over })),
      nearest_html: PR.nearestHtml(r), head_html: PR.nomatchHeadHtml(r),
      fixes: (r.nearest || []).map(f => ({ key: f.key, to: f.to || null, n: f.n == null ? null : f.n })), fixes_html: PR.fixesHtml(r.nearest || []),
    },
  };
  return out;
}

/* ---------------- consultation (before execute) ---------------- */
// free text -> brief: the released parser + the released merge. The returned brief is PRIVATE (holds the buyer's text):
// keep it server-side; never put it in share links, analytics or ci.reco.v1 (execute only emits the share-safe slim brief).
function understand(textIn, dataset, { locale = 'en' } = {}) {
  const PR = presenter(dataset, locale);
  const p = P.parse(textIn, dataset.U.models);
  return PR.merge({ text: textIn }, p);
}
// next follow-up question id, exactly as the released app chooses it (null = go to "Here's what we understood")
function nextQuestion(brief, asked, dataset, { path: pth = 'text' } = {}) { return presenter(dataset, 'en').nextQ(brief, asked || [], pth); }
const normalize = (brief, dataset) => presenter(dataset, 'en').norm(brief);
const mergeAnswer = (brief, patch, dataset) => presenter(dataset, 'en').merge(brief, patch);
// "Here's what we understood" rows (confirm step). Includes the unresolved comparative phrases verbatim (private view only).
function summary(brief, dataset, { locale = 'en' } = {}) {
  const PR = presenter(dataset, locale);
  return PR.summaryRows(PR.norm(brief)).map(x => ({ key: x.key, label: x.label, value: frag(x.value) }));
}
const decodeShare = (token, dataset) => presenter(dataset, 'en').dec(token);

module.exports = {
  SCHEMA, TRANSPORT_VERSION, ENGINE_VERSION: E.ENGINE_VERSION, LOCALES, STALE_DAYS,
  loadAcceptedDataset, loadLaunchSnapshot, LAUNCH_SNAPSHOT,
  execute, understand, nextQuestion, normalize, mergeAnswer, summary, decodeShare,
  _internals: { E, P, I, Present, text },
};
