// AT-26 Buyer Beta QA: journey, trust contract, accessibility (axe-core), RTL, keyboard, mobile/desktop.
// Usage (from buyer-decision/): node beta/qa.mjs <build dir, e.g. beta/original> <out dir>
// Serves the build locally (no Claude runtime: shared storage falls back to this browser, as in a plain host).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , buildDir = 'beta/original', outDir = 'beta/qa/original'] = process.argv;
const AXE = process.env.AXE || '/tmp/claude-0/-home-user-scratch/eb37cc7c-3b3c-5d17-a748-e8f4fb847f3f/scratchpad/axe/node_modules/axe-core/axe.min.js';
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const f = path.join(buildDir, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/index.html`;
const browser = await chromium.launch();
const report = { build: buildDir, runs: [], axe: {}, keyboard: {}, checks: [] };
const check = (id, ok, detail) => { report.checks.push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + detail : ''}`); };
const axeSrc = fs.readFileSync(AXE, 'utf8');
async function axe(page, label) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map(n => n.failureSummary.split('\n')[1] || '').join(' | ').slice(0, 220) })));
  report.axe[label] = r; return r;
}

async function journey(lang, vp, tag) {
  const ctx = await browser.newContext({ viewport: vp, locale: lang === 'ar' ? 'ar-EG' : 'en-GB' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(l => { try { localStorage.setItem('ci.lang', JSON.stringify(l)); } catch (e) {} }, lang);
  const run = { tag, lang, vp: `${vp.width}x${vp.height}` };
  await page.goto(base + '#home'); await page.waitForSelector('h1');
  run.dir = await page.evaluate(() => document.documentElement.dir);
  run.nav = await page.$$eval('nav a', a => a.map(x => x.getAttribute('href')));
  await page.screenshot({ path: `${outDir}/${tag}-1-home.png`, fullPage: true });
  if (tag === 'desktop-en') await axe(page, 'home');
  // gate
  await page.goto(base + '#find'); await page.waitForSelector('#gate');
  await page.fill('#code', 'WRONG'); await page.click('#gate button[type=submit]');
  run.gate_error_shown = await page.isVisible('#gateErr');
  await page.fill('#code', 'beta2026'); await page.click('#gate button[type=submit]');
  await page.waitForSelector('#nextBtn');
  // defaults: what is pre-answered before the buyer touches anything
  const pre = [], blocked = [];
  for (let s = 0; s < 6; s++) {
    await page.waitForSelector('#nextBtn');
    pre.push(await page.$$eval('.chip[aria-pressed="true"]', c => c.map(x => x.textContent.trim())));
    if (s === 1 && tag === 'desktop-en') { await axe(page, 'journey_step2'); }
    if (s === 0) await page.screenshot({ path: `${outDir}/${tag}-2-step1.png`, fullPage: true });
    // same realistic brief in both builds: max 2M, SUV, any powertrain, 3–5 riders, space + running cost, city
    blocked.push(await page.$eval('#nextBtn', b => b.disabled));
    const want = [['mode', 'max'], ['body', 'suv'], ['pt', 'open'], ['fam', '5'], ['pr', 'space', 'economy'], ['use', 'city']][s];
    for (const v of want.slice(1)) { const on = await page.$eval(`.chip[data-k="${want[0]}"][data-v="${v}"]`, c => c.getAttribute('aria-pressed') === 'true'); if (!on) await page.click(`.chip[data-k="${want[0]}"][data-v="${v}"]`); }
    await page.click('#nextBtn');
  }
  run.preselected_per_step = pre; run.next_disabled_before_answer = blocked;
  await page.waitForSelector('#restart'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${tag}-3-results.png`, fullPage: true });
  const body = await page.textContent('main');
  run.result = {
    heading: (await page.$eval('main h2', h => h.textContent.trim()).catch(() => null)),
    equal_set_layout: await page.$$eval('article.car', a => a.map(x => Math.round(x.getBoundingClientRect().width) + (x.classList.contains('hero-car') ? ':hero' : '') + (x.querySelector('details[open]') ? ':open' : ''))),
    hero_badge: await page.$eval('.hero-car .badge', b => b.textContent.trim()).catch(() => null),
    cars: await page.$$eval('article.car h3', a => a.map(x => x.textContent.trim())),
    why_cards: await page.$$eval('details[open] .why .w b', a => a.map(x => x.textContent.trim())),
    provenance_badges: await page.$$eval('.prov .badge', a => a.map(x => x.textContent.trim())),
    nobody_paid: /Nobody paid|محدش دفع/.test(body),
    shows_scores: /\b0\.\d{2,}\b|score:|weight/i.test(body.replace(/reasons, not scores|مش بنعرض أوزان أو درجات/g, '')),
  };
  if (tag === 'desktop-en') await axe(page, 'results');
  // feedback with a fake phone: is the comment stored as typed?
  await page.click('[data-fb="up"]'); await page.fill('#fbText', 'call me 01012345678 a@b.com'); await page.click('#fbSend');
  run.feedback_raw_in_storage = await page.evaluate(() => (localStorage.getItem('ci.events') || '').includes('01012345678'));
  // waitlist
  await page.goto(base + '#beta'); await page.waitForSelector('#wl');
  if (tag === 'desktop-en') await axe(page, 'beta');
  await page.fill('#wEmail', 'not-an-email'); await page.click('#wl button[type=submit]');
  run.waitlist_validation = await page.isVisible('#wErr');
  await page.fill('#wEmail', 'qa.tester@example.org'); await page.click('#wl button[type=submit]');
  run.waitlist_done = await page.textContent('#wl');
  // explorer
  await page.goto(base + '#explore'); await page.waitForSelector('#xbody tr');
  run.explore_rows = await page.$$eval('#xbody tr.model-row', r => r.length);
  if (tag === 'desktop-en') await axe(page, 'explore');
  // admin reachable by a buyer?
  await page.goto(base + '#admin'); await page.waitForTimeout(400);
  run.admin_reachable = /Internal|لوحة المتابعة/.test(await page.textContent('main'));
  run.overflow_px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  run.errors = errors;
  report.runs.push(run); await ctx.close();
}
for (const [lang, vp, tag] of [['en', { width: 1280, height: 900 }, 'desktop-en'], ['ar', { width: 1280, height: 900 }, 'desktop-ar'], ['en', { width: 390, height: 844 }, 'mobile-en'], ['ar', { width: 390, height: 844 }, 'mobile-ar'], ['ar', { width: 320, height: 700 }, 'narrow-ar']]) await journey(lang, vp, tag);

// keyboard-only: gate → first answer → next, without the mouse
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => { localStorage.setItem('ci.lang', '"en"'); });
  await page.goto(base + '#find'); await page.waitForSelector('#code');
  const seen = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName + (a.getAttribute('href') || '')) : null; })); }
  report.keyboard.tab_order_gate = seen;
  await page.focus('#code'); await page.keyboard.type('CARINDEX'); await page.keyboard.press('Enter');
  await page.waitForSelector('#nextBtn');
  const focusVisible = await page.evaluate(() => { const b = document.querySelector('.chip'); b.focus(); return getComputedStyle(b).outlineStyle; });
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  report.keyboard.chip_space_toggles = await page.$$eval('.chip[aria-pressed="true"]', c => c.length);
  report.keyboard.focus_after_rerender = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  report.keyboard.focus_outline_style = focusVisible;
  await ctx.close();
}
// text scaling: 200% root font size at 390px
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(base + '#home'); await page.addStyleTag({ content: 'html{font-size:200%!important} body{font-size:30px!important}' }); await page.waitForTimeout(200);
  report.text_scale_overflow_px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.screenshot({ path: `${outDir}/scale-200.png`, fullPage: true });
  await ctx.close();
}
await browser.close(); srv.close();
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 12000));
