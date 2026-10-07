import 'server-only';
import { BOUND, release, type Dataset, type Transport } from '../p1/release';
import { vehicles } from '../vehicles/read-model';
import { log } from '../http/guard';

/* Find My Car service: drives the P1 transport (P1-RELEASE-T1) exactly as P5-INTEGRATION.md §3 describes.
   P5 adds NO semantics: questions, answers, edits, ranking, copy and the result come from the released P1 code.
   The answer/edit/relax patches below are the released app.js UI patches (P1-INTEGRATION §3: "same patches as the
   released UI"); the source line is cited next to each.
   Privacy (§6): the brief holds the buyer's own text; it is returned only to the same buyer in a response body and
   never logged, put in a URL or sent to analytics. ci.reco.v1 is checked for leaks before it leaves the server. */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Brief = Record<string, any>;
export type Locale = 'en' | 'ar';
export class FmcError extends Error { constructor(public code: string, public status = 400) { super(code); } }

function bound(): { T: Transport; ds: Dataset } {
  const r = release();
  if (!r.ok) throw new FmcError('release_unavailable', 503);
  return { T: r.T, ds: r.ds };
}

// One presenter (released app/present.js) for UI pieces the transport does not wrap (question copy, names).
let pr: any = null;
function presenter(locale: Locale) {
  const { T, ds } = bound();
  pr ??= T._internals.Present.create(ds.U, T._internals.E, T._internals.I);
  pr.setLang(locale);
  return pr;
}
const S = (locale: Locale) => presenter(locale).S;

/* ---------- brief guard: shape only (the engine owns meaning) ---------- */
const MAX_BRIEF = 12_000;
export function checkBrief(b: unknown): Brief {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new FmcError('invalid_brief');
  if (JSON.stringify(b).length > MAX_BRIEF) throw new FmcError('invalid_brief');
  return b as Brief;
}
const checkAsked = (a: unknown): string[] => {
  if (!Array.isArray(a) || a.length > 16 || a.some(x => typeof x !== 'string' || x.length > 16)) throw new FmcError('invalid_brief');
  return a as string[];
};
const PATHS = ['text', 'guided', 'shared'];

/* ---------- consultation ---------- */
function describeQ(id: string, brief: Brief, asked: string[], path: string, locale: Locale) {
  const P = presenter(locale), s = P.S, D = s.q[id], nb = P.norm(brief), step = asked.length + 1;
  // verbatim behaviour of app.js renderQ (title fn for aspiration, seats hint, heard chips)
  const title = typeof D.t === 'function' ? D.t(P.nm(nb.aspiration[0]) + (nb.aspiration.length > 1 ? ` / ${P.nmShort(nb.aspiration[1])}` : '')) : D.t;
  let hint = D.h;
  if (id === 'seats') {
    const five = (nb.shortlist || []).filter((x: string) => P.byId[x] && P.byId[x].seats && Math.max(...P.byId[x].seats) < 7);
    if (five.length) hint = s.seats_named({ cars: P.joinList(five.map(P.nm)) });
  }
  const heard = step > 1 || path === 'text' ? P.summaryRows(nb).filter((r: any) => r.key !== 'notes').map((r: any) => r.value as string) : [];
  const { P: Parser } = bound().T._internals;
  const opts = D.o ? Object.entries(D.o as Record<string, [string, string]>).map(([v, [t, sub]]) => ({ v, t, s: sub, scored: Parser.SCORED.includes(v) })) : [];
  return {
    id, step, step_label: s.step(step), title, hint: hint ?? '', heard, options: opts,
    kind: id === 'budget' ? 'budget' : id === 'more' ? 'text' : id === 'priorities' ? 'multi' : 'single',
    placeholder: D.ph ?? null,
    budget: id === 'budget' ? { value: nb.budget || 1500000, mode: nb.budgetMode === 'max' ? 'max' : 'around', stretch: !!nb.stretch } : null,
  };
}

function advance(brief: Brief, asked: string[], path: string, locale: Locale) {
  const { T, ds } = bound();
  const q = T.nextQuestion(brief, asked, ds, { path });
  if (q) return { view: 'q' as const, brief, asked, path, q: describeQ(q, brief, asked, path, locale) };
  const nb = T.normalize(brief, ds); // app.js advance(): go({ view: 'summary', brief: norm(brief) })
  return { view: 'summary' as const, brief: nb, asked, path, rows: T.summary(nb, ds, { locale }) };
}

export function start(path: string, text: string | null, locale: Locale) {
  const { T, ds } = bound();
  if (path === 'text') {
    if (!text || !text.trim() || text.length > 1000) throw new FmcError('invalid_brief');
    return advance(T.understand(text.trim(), ds, { locale }), [], 'text', locale);
  }
  if (path === 'guided') return advance({}, [], 'guided', locale);
  throw new FmcError('invalid_brief');
}

export function answer(briefIn: unknown, askedIn: unknown, path: string, q: string, value: unknown, locale: Locale) {
  const brief = checkBrief(briefIn), asked = checkAsked(askedIn);
  if (!PATHS.includes(path)) throw new FmcError('invalid_brief');
  const { T, ds } = bound();
  const P = presenter(locale), Parser = T._internals.P, D = P.S.q[q];
  if (!D || asked.includes(q)) throw new FmcError('invalid_answer');
  if (q === 'budget') { // app.js readBudget + wireBudget clamp
    const v = value as { budget?: unknown; mode?: unknown; stretch?: unknown };
    const n = Number(v?.budget);
    if (!Number.isFinite(n) || n < 300000 || n > 20000000 || !['around', 'max'].includes(String(v?.mode))) throw new FmcError('invalid_answer');
    const mode = String(v.mode);
    return advance({ ...brief, budget: n, budgetMode: mode, stretch: mode === 'max' && v.stretch === true, budgetMin: null, budgetFrom: null }, [...asked, q], path, locale);
  }
  if (q === 'more') { // app.js renderQ 'more' done()
    const text = typeof value === 'string' ? value.trim().slice(0, 1000) : '';
    if (!text) return advance(brief, [...asked, q], path, locale);
    const p = Parser.parse(text, ds.U.models);
    const b = P.merge(brief, p); b.notes = text;
    return advance(b, [...asked, q], path, locale);
  }
  if (q === 'priorities') { // app.js renderQ 'priorities' done(): up to 3
    const v = Array.isArray(value) ? value.filter(x => typeof x === 'string' && x in D.o) as string[] : [];
    if (v.length > 3) throw new FmcError('invalid_answer');
    if (!v.length) return advance(brief, [...asked, q], path, locale);
    return advance({ ...brief, priorities: v.filter(x => Parser.SCORED.includes(x)), checks: [...new Set([...(brief.checks || []), ...v.filter(x => !Parser.SCORED.includes(x))])] }, [...asked, q], path, locale);
  }
  const v = String(value);
  if (!D.o || !(v in D.o)) throw new FmcError('invalid_answer');
  const patch = ({ // app.js renderQ option patch table, verbatim
    body: v === 'any' ? { body: null, bodyAny: true } : { body: [v], bodyAny: false },
    seats: { seats: v === 'seven' ? 7 : 5 },
    drive: { drive4: v === 'yes' },
    attraction: v === 'design' ? { attraction: v, checks: [...new Set([...(brief.checks || []), 'design'])] } : { attraction: v },
    pt: { pt: v }, chinese: { chinese: v }, usage: { usage: v }, size: { sizePref: v },
  } as Record<string, Brief>)[q];
  if (!patch) throw new FmcError('invalid_answer');
  return advance({ ...brief, ...patch }, [...asked, q], path, locale);
}

export function summaryOf(briefIn: unknown, locale: Locale) {
  const { T, ds } = bound();
  const nb = T.normalize(checkBrief(briefIn), ds);
  return { view: 'summary' as const, brief: nb, rows: T.summary(nb, ds, { locale }) };
}

/* ---------- edit (app.js renderEdit) ---------- */
export function editForm(briefIn: unknown, locale: Locale) {
  const b = checkBrief(briefIn), P = presenter(locale), s = P.S, Q = s.q;
  const o = (k: string) => Object.entries(Q[k].o as Record<string, [string, string]>).map(([v, x]) => ({ v, t: x[0] }));
  return {
    budget: { value: b.budget || 1500000, mode: b.budgetMode === 'max' ? 'max' : 'around', stretch: !!b.stretch },
    groups: [
      { key: 'body', label: s.s_rows.body, multi: true, options: o('body'), sel: b.body && b.body.length ? b.body : ['any'] },
      { key: 'seats', label: s.s_rows.seats, multi: false, options: [{ v: '5', t: s.s_seats[5] }, { v: '7', t: s.s_seats[7] }], sel: [String(b.seats || '')] },
      { key: 'size', label: s.s_rows.size, multi: false, options: o('size'), sel: [b.sizePref || ''] },
      { key: 'pt', label: s.s_rows.pt, multi: false, options: o('pt'), sel: [b.pt || ''] },
      { key: 'chinese', label: s.s_rows.chinese, multi: false, options: o('chinese'), sel: [b.chinese || ''] },
      { key: 'usage', label: s.s_rows.usage, multi: false, options: o('usage'), sel: [b.usage || ''] },
      { key: 'prio', label: s.s_rows.priorities, multi: true, full: true, options: o('priorities'), sel: [...(b.priorities || []), ...(b.checks || [])] },
      ...((b.aspiration || []).length ? [{ key: 'attr', label: `${s.s_rows.aspiration}: ${P.joinList(b.aspiration.map(P.nm))}`, multi: false, full: true, options: o('attraction'), sel: [b.attraction || ''] }] : []),
    ],
    only: (b.brandsOnly || []).map((id: string) => ({ id, html: P.brandName(id) })),
    excl: (b.brandsExclude || []).map((id: string) => ({ id, html: P.brandName(id) })),
    unresolved: (b.unresolved || []).map((u: any) => String(u.text)),
    cars: [...(b.shortlist || []), ...(b.aspiration || []), ...(b.reference || [])].filter((id: string) => P.byId[id]).map((id: string) => ({ id, html: P.nm(id), label: s.e_remove(P.byId[id].brand + ' ' + P.byId[id].model) })),
  };
}

// "Only these" / "Leave out" box and "add a car" box: the released parser reads names, nothing else (app.js addBrands/addCar)
export function parseNames(kind: 'brand' | 'car', text: unknown, locale: Locale) {
  if (typeof text !== 'string' || text.length > 200) throw new FmcError('invalid_brief');
  const { T, ds } = bound(); const P = presenter(locale);
  const p = T._internals.P.parse(text, ds.U.models);
  if (kind === 'brand') {
    const ids = [...new Set([...(p.brandsPrefer || []), ...(p.brandsOnly || []), ...(p.brandsExclude || []), ...(p.unresolved || []).map((u: any) => u.brand).filter(Boolean)])] as string[];
    return ids.map(id => ({ id, html: P.brandName(id) }));
  }
  return (p.mentions || []).map((x: any) => ({ id: x.id as string, html: P.nm(x.id), label: P.S.e_remove(P.byId[x.id].brand + ' ' + P.byId[x.id].model) }));
}

export function saveEdit(briefIn: unknown, e: any, locale: Locale) {
  const b = checkBrief(briefIn), P = presenter(locale), Parser = bound().T._internals.P;
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter(v => typeof v === 'string').slice(0, 20) as string[] : []);
  const sel = (k: string) => arr(e?.sel?.[k]);
  const n = Number(e?.budget?.value), mode = e?.budget?.mode === 'max' ? 'max' : 'around';
  if (!Number.isFinite(n) || n < 300000 || n > 20000000) throw new FmcError('invalid_answer');
  // app.js renderEdit save handler, verbatim order
  const nb: Brief = { ...b, budget: n, budgetMode: mode, stretch: mode === 'max' && e?.budget?.stretch === true, budgetMin: null, budgetFrom: null };
  const body = sel('body');
  nb.body = body.includes('any') || !body.length ? null : body; nb.bodyAny = !nb.body; nb.bodyImplied = false;
  nb.seats = sel('seats')[0] ? +sel('seats')[0] : null;
  nb.sizePref = sel('size')[0] || null;
  nb.pt = sel('pt')[0] || null; nb.chinese = sel('chinese')[0] || null; nb.usage = sel('usage')[0] || null;
  const prr = sel('prio'); nb.priorities = prr.filter(x => Parser.SCORED.includes(x)); nb.checks = prr.filter(x => !Parser.SCORED.includes(x));
  if ((b.aspiration || []).length) nb.attraction = sel('attr')[0] || null;
  const keep = new Set(arr(e?.cars));
  const fromBrief = (k: string) => (b[k] || []).filter((id: string) => keep.has(id));
  const added = arr(e?.addCars).filter(id => P.byId[id] && ![...(b.shortlist || []), ...(b.aspiration || []), ...(b.reference || [])].includes(id));
  Object.assign(nb, { shortlist: [...fromBrief('shortlist'), ...added], aspiration: fromBrief('aspiration'), reference: fromBrief('reference') });
  nb.brandsOnly = arr(e?.only); nb.brandsExclude = arr(e?.excl);
  const keepUn = new Set(arr(e?.unresolved));
  nb.unresolved = (b.unresolved || []).filter((u: any) => keepUn.has(String(u.text)));
  if (nb.pt === 'open') nb.ptNo = [];
  const out = P.renorm(nb);
  if (!nb.body) { out.body = null; out.bodyAny = true; out.bodyImplied = false; }
  return summaryOf(out, locale);
}

/* ---------- result ---------- */
const SHARE_KEYS = new Set(['drive4', 'offroad', 'sizePref', 'brandsOnly', 'ptNo', 'budget', 'budgetMin', 'budgetMode', 'stretch', 'budgetFrom', 'body', 'bodyAny', 'bodyImplied', 'notBody', 'seats', 'who', 'usage', 'pt', 'chinese', 'priorities', 'checks',
  'brandsPrefer', 'brandsExclude', 'shortlist', 'reference', 'aspiration', 'attraction', 'avoid']);

// §5 + §6 guards on every result. Throws: the route refuses to serve instead of serving an unverified or leaky result.
export function guardResult(r: any, brief: Brief, locale: Locale) {
  if (r?.schema !== BOUND.schema || r.engine_version !== BOUND.engine_version || r.transport_version !== BOUND.transport_version ||
      r.universe_version !== BOUND.universe_version || r.dataset?.sha256 !== BOUND.dataset_content_sha256 || r.dataset?.id !== BOUND.dataset_id ||
      r.locale !== locale || !/^cr1_[0-9a-f]{32}$/.test(r.result_id)) throw new FmcError('release_version_mismatch', 500);
  if (Object.keys(r.share?.brief || {}).some(k => !SHARE_KEYS.has(k))) throw new FmcError('privacy_guard', 500);
  const priv = [brief.text, brief.notes, ...(brief.unresolved || []).map((u: any) => u?.text)].filter((x): x is string => typeof x === 'string' && x.trim().length >= 4);
  const blob = JSON.stringify(r);
  if (priv.some(x => blob.includes(JSON.stringify(x).slice(1, -1)))) throw new FmcError('privacy_guard', 500);
}

/* Website browse projection (24 models) vs P1 universe (283). The result is never filtered or reordered here;
   only P5's own downstream links are attached when the car has a page in the projection (P5-INTEGRATION §8). */
export function websiteLinks(r: any): Record<string, string | null> {
  const ids = new Set<string>([r.hero?.id, ...(r.alternatives || []).map((a: any) => a.id), r.less?.id, ...(r.no_match?.nearest_above || []).map((x: any) => x.id)].filter(Boolean));
  const V = vehicles(), byId = presenter(r.locale).byId, out: Record<string, string | null> = {};
  const key = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const id of ids) {
    const slug = String(id).replace('/', '-'), car = V.get(slug), m = byId[id];
    out[id] = car && m && key(`${car.brand.en} ${car.model.en}`) === key(`${m.brand} ${m.model}`) ? slug : null;
  }
  return out;
}

export function execute(briefIn: unknown, locale: Locale) {
  const { T, ds } = bound();
  const nb = T.normalize(checkBrief(briefIn), ds); // mandatory: normalize() before execute() (P5-INTEGRATION §3)
  const r = T.execute(nb, ds, { locale });
  guardResult(r, nb, locale);
  // §5 audit set; share.r carries SHARE_KEYS only (no free text / PII).
  log('reco_result', { result_id: r.result_id, engine_version: r.engine_version, universe_version: r.universe_version, dataset_sha256: r.dataset.sha256,
    transport_version: r.transport_version, locale: r.locale, share_r: r.share.r, mode: r.mode });
  return { view: 'result' as const, brief: nb, result: r, website: websiteLinks(r) };
}

export function executeShared(token: unknown, locale: Locale) {
  if (typeof token !== 'string' || token.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new FmcError('invalid_share');
  const { T, ds } = bound();
  let b: Brief;
  try { b = T.decodeShare(token, ds); } catch { throw new FmcError('invalid_share'); }
  if (!b || typeof b !== 'object' || Object.keys(b).some(k => !SHARE_KEYS.has(k))) throw new FmcError('invalid_share');
  return execute(b, locale);
}

// Result-screen actions (app.js wireResultBar budget +/-, no-match data-fix, conflict data-relax): brief changes, then execute.
export function adjust(briefIn: unknown, action: { kind: string; key?: string; to?: unknown; dir?: unknown }, locale: Locale) {
  const b = checkBrief(briefIn), { T, ds } = bound(), P = presenter(locale), E = T._internals.E;
  if (action.kind === 'budget') {
    const dir = action.dir === 1 ? 1 : action.dir === -1 ? -1 : 0;
    if (!dir || typeof b.budget !== 'number') throw new FmcError('invalid_answer');
    return execute(P.renorm({ ...b, budget: Math.max(300000, b.budget + dir * E.STEP), budgetMin: null, budgetFrom: null }), locale);
  }
  const k = String(action.key || ''), nb: Brief = { ...b };
  if (action.kind === 'fix') {
    if (!['seats', 'chinese', 'powertrain', 'body', 'brand', 'brand_only', 'drive', 'budget'].includes(k)) throw new FmcError('invalid_answer');
    if (k === 'seats') nb.seats = null; if (k === 'chinese') nb.chinese = 'open'; if (k === 'powertrain') nb.pt = 'open';
    if (k === 'body') { nb.body = null; nb.bodyAny = true; } if (k === 'brand') nb.brandsExclude = []; if (k === 'brand_only') nb.brandsOnly = []; if (k === 'drive') nb.drive4 = null;
    if (k === 'powertrain') nb.ptNo = [];
    if (k === 'budget') { const to = Number(action.to); if (!Number.isFinite(to) || to < 300000 || to > 50000000) throw new FmcError('invalid_answer'); nb.budget = to; }
    return execute(k === 'budget' ? P.renorm(nb) : nb, locale);
  }
  if (action.kind === 'relax') {
    if (!['seats', 'chinese', 'drive', 'body', 'brand', 'budget'].includes(k)) throw new FmcError('invalid_answer');
    if (k === 'seats') nb.seats = null; if (k === 'chinese') nb.chinese = 'open'; if (k === 'drive') nb.drive4 = null;
    if (k === 'body') { nb.body = null; nb.bodyAny = true; } if (k === 'brand') nb.brandsExclude = [];
    if (k === 'budget') {
      const r0 = E.recommend(ds.U, b);
      if (!r0.shortlist) throw new FmcError('invalid_answer');
      const e = Math.min(...r0.shortlist.rows.map((z: any) => z.entry || Infinity));
      nb.budget = Math.ceil(e / E.STEP) * E.STEP;
      return execute(P.renorm(nb), locale);
    }
    return execute(nb, locale);
  }
  throw new FmcError('invalid_answer');
}

/* ---------- engine-owned UI copy for the client (strings only; functions evaluated here) ---------- */
export function uiCopy(locale: Locale) {
  const s = S(locale), P = presenter(locale);
  const onSale = bound().ds.U.models.filter((m: any) => m.u).length;
  const SLOT = '\u0000';
  const split = (f: (x: string) => string) => f(SLOT).split(SLOT);
  return {
    dir: s.dir, w_label: s.w_label, w_ph: s.w_ph, w_empty: s.w_empty, w_go: s.w_go, w_examples: s.w_examples, examples: s.examples as string[],
    w_guided: s.w_guided, w_foot: s.w_foot(P.num(onSale)), back: s.back, cont: s.cont, skip_q: s.skip_q, heard: s.heard, prio_check_h: s.prio_check_h,
    s_eyebrow: s.s_eyebrow, s_h: s.s_h, s_q: s.s_q, s_yes: s.s_yes, s_edit: s.s_edit,
    e_h: s.e_h, e_brands: s.e_brands, e_brand_ph: s.e_brand_ph, e_brand_only: s.e_brand_only, e_brand_excl: s.e_brand_excl, e_add: s.e_add, e_add_ph: s.e_add_ph,
    e_save: s.e_save, e_budget_mode: s.e_budget_mode as Record<string, string>, e_stretch: s.e_stretch, s_rows: s.s_rows as Record<string, string>, unresolved_hint: s.unresolved_hint,
    r_based: s.r_based, r_edit: s.r_edit, share: s.share, r_restart: s.r_restart, r_budget: s.r_budget, minus: s.minus, plus: s.plus,
    alts_h: s.alts_h, compare: s.compare, compare_hide: s.compare_hide, details: s.details, check_h: s.check_h, in_range: s.in_range,
    matching: s.matching(P.num(onSale)), copied: s.copied, step_amount: T_STEP(), egp: split(s.egp), mill: split(s.mill),
  };
}
const T_STEP = () => bound().T._internals.E.STEP as number;
