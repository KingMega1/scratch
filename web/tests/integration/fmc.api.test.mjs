/* Targeted FMC / P1 integration tests (AT-43, P1-RELEASE-T1). Runs against a live server:
     FMC_BASE_URL=http://localhost:3100 [FMC_SERVER_LOG=/path/to/server.log] node --test tests/integration/fmc.api.test.mjs
   Proves: release/version binding, P5 output == P1 transport output (no drop / substitute / rerank / recopy),
   normalize-before-execute, EN/AR engine copy incl. U+2019, outside-24 handling, privacy guards, share round trip. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.FMC_BASE_URL || 'http://localhost:3100';
const HEADERS = { 'content-type': 'application/json', ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}) };
const require = createRequire(import.meta.url);
const T = require('../../p1-release/buyer-decision/transport/reco.js');
const record = JSON.parse(fs.readFileSync(new URL('../../p1-release/buyer-decision/release/P1-RELEASE-T1.json', import.meta.url)));
const schema = JSON.parse(fs.readFileSync(new URL('../../p1-release/buyer-decision/transport/ci.reco.v1.schema.json', import.meta.url)));
const corpus = JSON.parse(fs.readFileSync(new URL('../fixtures/p1-release/corpus.json', import.meta.url)));
const snapshot = JSON.parse(fs.readFileSync(new URL('../../data/registry/universe.snapshot.json', import.meta.url)));
const ds = T.loadLaunchSnapshot();
const SITE = new Set(snapshot.view.models.map(m => m.slug));

// The API keeps its per-client rate limit (120/min); the test waits out 429s instead of disabling it.
async function api(body, expect = 200) {
  let res;
  for (let i = 0; i < 6; i++) {
    res = await fetch(`${BASE}/api/v1/recommendation`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    if (res.status !== 429 || expect === 429) break;
    await new Promise(r => setTimeout(r, 1000 * Number(res.headers.get('retry-after') || 30)));
  }
  const j = await res.json();
  assert.equal(res.status, expect, `${body.op} -> ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
const direct = (brief, locale) => T.execute(T.normalize(JSON.parse(JSON.stringify(brief)), ds), ds, { locale });
const carIds = r => (r.hero ? [r.hero.id, ...r.alternatives.map(a => a.id)] : []);
function requiredKeys(obj, def, where) {
  for (const k of def.required || []) assert.ok(k in obj, `${where}: missing ${k}`);
  if (def.additionalProperties === false) for (const k of Object.keys(obj)) assert.ok(k in def.properties, `${where}: extra key ${k}`);
}

test('status: bound to P1-RELEASE-T1, engine/transport/universe/dataset, P3 V7', async () => {
  const j = await api({ op: 'status', locale: 'en' });
  assert.equal(j.status.status, 'ready');
  assert.equal(j.status.record, 'P1-RELEASE-T1');
  assert.equal(j.status.engine_version, record.engine_version);
  assert.equal(j.status.transport_version, record.transport_version);
  assert.equal(j.status.universe_version, 'U11-2026-09-26');
  assert.equal(j.status.dataset_sha256, record.dataset.content_sha256);
  assert.equal(j.status.p3_artifact, '1791369522-eecc');
  const h = await (await fetch(`${BASE}/api/health`, { headers: HEADERS })).json();
  assert.equal(h.recommendation.status, 'ready');
  assert.equal(h.recommendation.transport_commit, record.transport_commit);
  assert.equal(h.recommendation.integrity, true);
});

const ALL = { en: '', ar: '' }, RESULTS = {};
test('corpus x EN/AR: website result == P1 transport result (normalize then execute), unchanged', async () => {
  let n = 0;
  for (const c of corpus) for (const locale of ['en', 'ar']) {
    const j = await api({ op: 'execute', locale, brief: c.brief });
    ALL[locale] += JSON.stringify(j.result); RESULTS[`${c.id}/${locale}`] = j;
    const want = direct(c.brief, locale);
    assert.deepEqual(j.result, want, `${c.id}/${locale}: result differs from P1 transport`);
    assert.deepEqual(carIds(j.result), carIds(want), `${c.id}/${locale}: order`);
    requiredKeys(j.result, schema, `${c.id}/${locale}`);
    for (const car of [j.result.hero, ...j.result.alternatives].filter(Boolean)) requiredKeys(car, schema.$defs.car, `${c.id}/${locale}/${car.id}`);
    n++;
  }
  assert.equal(n, corpus.length * 2);
});

test('engine-owned copy is exact in EN and AR (incl. U+2019) and AR is RTL', async () => {
  const all = ALL;
  assert.ok(all.en.length && all.ar.length, 'corpus test ran first');
  assert.ok(all.en.includes('’'), 'EN results carry U+2019');
  assert.ok(!/don't|we're|it's/.test(all.en.replace(/&#39;/g, '')), 'no straight-apostrophe substitutes for engine copy');
  const ar = await api({ op: 'execute', locale: 'ar', brief: corpus[0].brief });
  assert.equal(ar.result.dir, 'rtl'); assert.equal(ar.result.locale, 'ar');
  const copy = (await api({ op: 'status', locale: 'en' })).copy;
  const S = T._internals.I.S;
  assert.equal(copy.s_h, S.en.s_h); assert.equal(copy.s_h, 'Here’s what we understood');
  assert.equal((await api({ op: 'status', locale: 'ar' })).copy.s_h, S.ar.s_h);
});

test('consultation: text and guided paths follow the released question order to summary, then execute', async () => {
  for (const [locale, text] of [['en', 'Family SUV around EGP 2 million, hybrid preferred'], ['ar', 'عايز عربية عالية في حدود 2.2 مليون.']]) {
    let v = await api({ op: 'start', locale, path: 'text', text });
    let brief = T.understand(text, ds, { locale }), asked = [];
    for (let i = 0; v.view === 'q' && i < 12; i++) {
      assert.equal(v.q.id, T.nextQuestion(brief, asked, ds, { path: 'text' }), `${locale}: question ${i}`);
      const q = v.q, value = q.kind === 'budget' ? { budget: q.budget.value, mode: q.budget.mode, stretch: false } : q.kind === 'text' ? '' : q.kind === 'multi' ? [] : q.options[0].v;
      const next = await api({ op: 'answer', locale, brief: v.brief, asked: v.asked, path: v.path, q: q.id, value });
      brief = next.brief; asked = next.asked ?? asked; v = next;
    }
    assert.equal(v.view, 'summary');
    assert.deepEqual(v.rows, T.summary(v.brief, ds, { locale }));
    const r = await api({ op: 'execute', locale, brief: v.brief });
    assert.deepEqual(r.result, direct(v.brief, locale));
  }
  const g = await api({ op: 'start', locale: 'en', path: 'guided' });
  assert.equal(g.view, 'q'); assert.equal(g.q.id, T.nextQuestion({}, [], ds, { path: 'guided' }));
});

test('outside the 24-model browse projection: P1 recommendations are kept, in order; only site links are withheld', async () => {
  let outside = 0, inside = 0;
  for (const c of corpus) {
    const j = RESULTS[`${c.id}/en`];
    for (const id of carIds(j.result)) {
      const slug = id.replace('/', '-');
      if (SITE.has(slug)) { assert.equal(j.website[id], slug); inside++; } else { assert.equal(j.website[id], null); outside++; }
    }
  }
  assert.ok(outside > 0, 'corpus exercises cars outside the website projection');
  assert.ok(inside > 0, 'corpus exercises cars inside the website projection');
  console.log(`outside-24 cars rendered from ci.reco.v1 only: ${outside}; with site page link: ${inside}`);
});

test('tie: equal set has no eyebrow (no lead card) and keeps P1 price order', async () => {
  const c = corpus.map(x => ({ x, r: direct(x.brief, 'en') })).find(({ r }) => r.mode === 'equal');
  assert.ok(c, 'corpus has a tie case');
  const j = await api({ op: 'execute', locale: 'en', brief: c.x.brief });
  assert.equal(j.result.mode, 'equal'); assert.equal(j.result.eyebrow, null); assert.ok(j.result.equal);
  assert.deepEqual(carIds(j.result), carIds(c.r));
});

test('privacy: buyer text never in result, share token or server log', async () => {
  const secret = 'Contact me on ahmed.secret@example.com or 01012345678 — budget 2 million, my wife hates small cars';
  const v = await api({ op: 'start', locale: 'en', path: 'text', text: secret });
  const brief = v.brief; brief.notes = 'private note about my neighbour Mona';
  const j = await api({ op: 'execute', locale: 'en', brief });
  const blob = JSON.stringify(j.result);
  for (const s of ['ahmed.secret', '01012345678', 'hates small', 'neighbour Mona']) assert.ok(!blob.includes(s), `result leaks ${s}`);
  assert.ok(!('text' in j.result.share.brief) && !('notes' in j.result.share.brief) && !('unresolved' in j.result.share.brief));
  assert.ok(!Buffer.from(j.result.share.r.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1').includes('secret'));
  if (process.env.FMC_SERVER_LOG) {
    const log = fs.readFileSync(process.env.FMC_SERVER_LOG, 'utf8');
    for (const s of ['ahmed.secret', '01012345678', 'hates small', 'neighbour Mona']) assert.ok(!log.includes(s), `server log leaks ${s}`);
    assert.ok(log.includes('"event":"reco_result"') && log.includes(j.result.result_id), 'audit line persisted');
  }
});

test('share token round trip reproduces the same result; invalid input is refused', async () => {
  const j = await api({ op: 'execute', locale: 'ar', brief: corpus[2].brief });
  const s = await api({ op: 'shared', locale: 'ar', r: j.result.share.r });
  assert.equal(s.result.result_id, j.result.result_id);
  assert.deepEqual(carIds(s.result), carIds(j.result));
  await api({ op: 'shared', locale: 'en', r: 'not-a-token' }, 400);
  await api({ op: 'shared', locale: 'en', r: Buffer.from(JSON.stringify({ text: 'x', budget: 2e6 })).toString('base64url') }, 400);
  await api({ op: 'nope', locale: 'en' }, 400);
  await api({ op: 'execute', locale: 'en', brief: { pad: 'x'.repeat(13000) } }, 400);
  await api({ op: 'answer', locale: 'en', brief: {}, asked: [], path: 'guided', q: 'body', value: 'spaceship' }, 400);
});

test('result actions: budget +/- and no-match fix run through renorm/normalize + execute', async () => {
  const b = corpus[2].brief;
  const base = await api({ op: 'execute', locale: 'en', brief: b });
  const up = await api({ op: 'adjust', locale: 'en', brief: base.brief, action: { kind: 'budget', dir: 1 } });
  assert.equal(up.result.budget.amount, base.result.budget.amount + T._internals.E.STEP);
  const nm = corpus.map(x => ({ x, r: direct(x.brief, 'en') })).find(({ r }) => r.mode === 'no_match' && r.no_match.fixes.length);
  if (nm) {
    const f = nm.r.no_match.fixes[0];
    const fixed = await api({ op: 'adjust', locale: 'en', brief: T.normalize(nm.x.brief, ds), action: { kind: 'fix', key: f.key, ...(f.to ? { to: f.to } : {}) } });
    assert.equal(fixed.view, 'result');
  }
});

test('FMC page renders the bound tool (no 503 gate) in EN and AR', async () => {
  for (const l of ['en', 'ar']) {
    const html = await (await fetch(`${BASE}/${l}/find-my-car`, { headers: HEADERS })).text();
    assert.ok(html.includes('data-fmc-status="ready"'), `${l}: ready`);
    assert.ok(html.includes('data-release="P1-RELEASE-T1"') && html.includes('data-transport-version="T1-2026-10-07"'));
  }
});

/* Named recommendation scenarios (AT-43 recovery 2026-10-08). Each case is a P1 regression-corpus brief; the API result
   must equal the P1 transport and show the expected P1 behaviour. P5 asserts presence/shape only, never recomputes. */
const byId = Object.fromEntries(corpus.map(c => [c.id, c]));
const exec = async (id, locale = 'en') => (await api({ op: 'execute', locale, brief: byId[id].brief })).result;
const cars = r => [r.hero, ...r.alternatives].filter(Boolean);
const U = Object.fromEntries(ds.U.models.map(m => [m.id, m]));

test('scenario: lean outcome names what the pick depends on; unknown critical data wording exact (U+2019)', async () => {
  const r = await exec('H1');
  assert.equal(r.confidence.level, 'lean');
  assert.ok(r.confidence.depends.includes('unknown_data'));
  assert.ok(r.hero.what_could_change.some(x => x.text === 'Details we don’t have yet for some of these cars'));
  assert.equal(r.hero.why_heading, T._internals.I.S.en.why_h_lean);
});
test('scenario: tie outcome has no single winner', async () => {
  const r = await exec('L1');
  assert.equal(r.confidence.level, 'tie'); assert.equal(r.eyebrow, null); assert.ok(r.equal);
});
test('scenario: budget ceiling and earned stretch', async () => {
  const r = await exec('T6');
  const s = cars(r).filter(c => c.stretch);
  assert.ok(s.length > 0, 'stretch car present');
  for (const c of s) { assert.ok(c.stretch.over > 0); assert.ok(c.stretch.buys.length > 0); }
  for (const c of cars(await exec('L1'))) for (const v of c.versions) assert.ok(v.min <= (await exec('L1')).budget.ceiling);
});
test('scenario: explicit exclusions and negation are honoured', async () => {
  for (const c of cars(await exec('T1'))) assert.ok(c.versions.every(v => v.powertrain !== 'ev'), `T1: ${c.id} offers EV`); // "no EV"
  for (const id of ['C3', 'P5']) for (const c of cars(await exec(id))) assert.notEqual(U[c.id].origin, 'China', `${id}: Chinese brand ${c.id}`);
  for (const c of cars(await exec('B5'))) assert.notEqual(U[c.id].brand_id, 'kia', 'B5: excluded brand');
  const nm = await exec('X1'); assert.equal(nm.mode, 'no_match'); assert.equal(nm.hero, null); assert.ok(nm.no_match);
});
test('scenario: source freshness and official-price provenance on every version', async () => {
  const r = await exec('L1');
  for (const c of cars(r)) for (const v of c.versions) {
    assert.equal(typeof v.official, 'boolean');
    if (v.date) assert.equal(v.stale, (Date.parse(r.price_as_of) - Date.parse(v.date)) > 14 * 864e5);
  }
  assert.equal(r.stale_after_days, 14);
  assert.match(r.price_as_of, /^\d{4}-\d{2}-\d{2}$/);
});
