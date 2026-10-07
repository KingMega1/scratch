// Browser-vs-transport equivalence: the released browser app and the server transport must say exactly the same thing.
// For every brief the regression corpus judges (tests/regression/corpus.json), in EN and AR:
//   1. open the RELEASED public build (default: built from app/ with tools/build_public.py; or pass a build dir,
//      e.g. a checkout of the published site at 1a139e5) on its share link ?r=<token>, as a buyer would;
//   2. run transport.execute() on the same brief;
//   3. compare the rendered DOM with the transport's fragments: mode, eyebrow, hero name, hero detail (WHY, trade-offs,
//      what could change, versions, specs, market, next steps), each alternative card, the compare table, notices,
//      the spend-less card, checks, no-match block, the brief bar, and the detail sheet of an alternative and of the
//      spend-less car. HTML is compared after the browser's own parse/serialise of both sides (byte-exact otherwise).
// Usage (from buyer-decision/): node tests/transport/browser_equivalence.mjs [releasedBuildDir]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = require(path.join(ROOT, 'transport/reco.js'));
let build = process.argv[2];
if (!build) {
  build = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-released-'));
  fs.rmSync(build, { recursive: true });
  execFileSync('python3', [path.join(ROOT, 'tools/build_public.py'), build], { stdio: 'ignore' });
}
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/regression/corpus.json'), 'utf8'));
const ds = T.loadLaunchSnapshot();
const AS_OF = '2026-10-07';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const f = path.join(build, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/app/index.html`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/script\.google|fonts\.(googleapis|gstatic)/, r => r.abort());
// car photos load from Wikimedia; offline here, so serve a 1x1 PNG (a failed image makes the app remove its figure)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
await ctx.route(/upload\.wikimedia\.org/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const canon = html => page.evaluate(h => { const t = document.createElement('template'); t.innerHTML = h == null ? '' : h; return t.innerHTML; }, html);

let checks = 0, fails = 0; const failures = [];
const eq = async (a, bHtml, msg) => { checks++; const x = await canon(bHtml); if (a !== x) { fails++; failures.push(`${msg}\n    browser:   ${String(a).slice(0, 300)}\n    transport: ${String(x).slice(0, 300)}`); } };
const ok = (c, msg) => { checks++; if (!c) { fails++; failures.push(msg); } };

for (const c of corpus) for (const lang of ['en', 'ar']) {
  // the brief the released app holds at the result: normalised at "Here's what we understood" (app.js advance -> norm)
  const o = T.execute(T.normalize(c.brief, ds), ds, { locale: lang, asOf: AS_OF });
  const id = `${c.id}/${lang}`;
  await page.goto(`${base}?lang=${lang}&r=${o.share.r}`);
  try { await page.waitForSelector('.hero, .equal-set, .nomatch', { state: 'attached', timeout: 10000 }); }
  catch (e) { ok(false, `${id}: browser rendered no result (${(await page.$eval('#screen', el => el.textContent)).slice(0, 160)})`); continue; }
  const dom = await page.evaluate(() => {
    const q = s => document.querySelector(s), html = s => (q(s) ? q(s).innerHTML : null);
    return {
      mode: q('.equal-set') ? 'equal' : q('.hero') ? 'hero' : 'no_match',
      eyebrow: html('.hero .eyebrow'), name: html('#h-hero'), size: html('.hero .hero-trim'), range: html('.hero .price-big'), sub: html('.hero .muted-dark'),
      detail: html('.hero-detail'), cards: [...document.querySelectorAll('article.alt')].map(a => a.outerHTML),
      compare: html('#compare'), checks: html('.checks'), answers: html('.answers'), bud: html('#bud'),
      screen: q('#screen').innerHTML,
    };
  });
  ok(dom.mode === (o.mode === 'no_match' ? 'no_match' : o.equal ? 'equal' : 'hero'), `${id}: mode browser=${dom.mode} transport=${o.mode}`);
  await eq(dom.bud, o.budget.html, `${id}: budget`);
  await eq(dom.answers, o.brief_bar.map(x => `<span class="chip"><span class="muted">${x.label}:</span> ${x.value.html}</span>`).join(''), `${id}: brief bar`);
  for (const n of o.notices) { checks++; if (!dom.screen.includes(await canon(n.html))) { fails++; failures.push(`${id}: notice missing in browser: ${n.text.slice(0, 120)}`); } }
  if (o.mode === 'no_match') {
    for (const [k, h] of [['nearest', o.no_match.nearest_html], ['head', o.no_match.head_html], ['fixes', o.no_match.fixes_html]]) {
      checks++; if (!dom.screen.includes(await canon(h))) { fails++; failures.push(`${id}: no-match ${k} differs`); }
    }
    continue;
  }
  const cards = o.equal ? [o.hero, ...o.alternatives] : o.alternatives;
  ok(dom.cards.length === cards.length, `${id}: card count browser=${dom.cards.length} transport=${cards.length}`);
  for (let i = 0; i < Math.min(dom.cards.length, cards.length); i++) await eq(dom.cards[i], cards[i].card.html, `${id}: card ${i} (${cards[i].id})`);
  await eq(dom.compare, o.compare_html, `${id}: compare table`);
  await eq(dom.checks, o.checks.map(x => `<li>${x.html}</li>`).join(''), `${id}: checks`);
  if (!o.equal) {
    await eq(dom.eyebrow, o.eyebrow.html, `${id}: eyebrow`);
    await eq(dom.name, o.hero.name.html, `${id}: hero name`);
    await eq(dom.size, o.hero.size ? o.hero.size.html : '', `${id}: hero size`);
    await eq(dom.range, o.hero.price_range.html, `${id}: hero range`);
    await eq(dom.sub, o.hero.price_note.html, `${id}: hero price note`);
    await eq(dom.detail, o.hero.html.detail, `${id}: hero detail (WHY / trade-offs / what could change / versions / specs / market / next)`);
  }
  if (o.less) { checks++; if (!dom.screen.includes(await canon(o.less.html))) { fails++; failures.push(`${id}: spend-less line differs`); } }
  // detail sheets: an alternative, and the spend-less car (ranked alone: packFor)
  for (const [pid, want] of [[o.alternatives[0] && o.alternatives[0].id, o.alternatives[0] && o.alternatives[0].html.detail], [o.less && o.less.id, o.less && o.less.detail_html]]) {
    if (!pid) continue;
    const btn = page.locator(`[data-detail="${pid}"]`).first();
    if (!(await btn.count())) { ok(false, `${id}: no detail button for ${pid} in browser (mode ${o.mode}; cards ${dom.cards.length})`); continue; }
    await btn.click();
    await page.waitForSelector('#sheet:not([hidden])');
    const body = await page.$eval('#sheet-body', el => el.innerHTML);
    checks++; if (!body.includes(await canon(want))) { fails++; failures.push(`${id}: detail sheet ${pid} differs`); }
    await page.goBack(); await page.waitForFunction(() => document.querySelector('#sheet').hidden);
  }
}
ok(errors.length === 0, `page errors: ${errors.join(' | ')}`);
await browser.close(); srv.close();
console.log(`browser-vs-transport: ${corpus.length} briefs x EN/AR · ${checks - fails}/${checks} checks pass`);
failures.slice(0, 20).forEach(f => console.log('FAIL ' + f));
process.exit(fails ? 1 : 0);
