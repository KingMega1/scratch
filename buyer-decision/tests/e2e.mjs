// End-to-end funnel check. Run from buyer-decision/: node tests/e2e.mjs
// Serves the folder, walks the flow at desktop and 390px, asserts events + layout, writes shots/.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/app/index.html`;
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

async function run(label, viewport, answers) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // font requests are aborted on purpose (offline-stable run); ignore only those load failures
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', q => { if (!q.url().startsWith('https://fonts.')) errors.push('request failed ' + q.url()); });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.goto(base);
  await page.screenshot({ path: path.join(root, `shots/${label}-1-entry.png`), fullPage: true });
  await page.click('#start');
  for (const v of answers) {
    const sel = `.opt[data-v="${v}"]`;
    if (await page.$(sel)) { await page.click(sel); await page.waitForTimeout(260); }
  }
  if (await page.$('#done')) {
    await page.screenshot({ path: path.join(root, `shots/${label}-2-question.png`), fullPage: true });
    await page.click('.opt[data-v="proof"]'); await page.click('#done');
  }
  await page.waitForSelector('.hero');
  await page.screenshot({ path: path.join(root, `shots/${label}-3-result.png`), fullPage: true });
  await page.click('[data-cta="evidence"]');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.screenshot({ path: path.join(root, `shots/${label}-4-evidence.png`) });
  await page.keyboard.press('Escape');
  const promote = await page.$('[data-promote]');
  if (promote) { await promote.click(); await page.waitForSelector('.hero'); }
  await page.locator('#compare').scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
  await page.locator('#fb').scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
  await page.click('[data-h="somewhat"]');
  await page.fill('#fb-text', 'Show running costs.');
  await page.click('#fb-send');
  const ev = await page.evaluate(() => window.dataLayer.map(e => e.event));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const hero = await page.textContent('#h-hero');
  const nAlts = await page.$$eval('.alt', a => a.length);
  const first = await page.evaluate(() => window.dataLayer.find(e => e.event === 'result_view').props);
  console.log(`\n[${label}] first hero=${first.hero_id} alts=${first.alt_ids.join(',')} | after promote hero=${hero.trim()}\n  answers=${JSON.stringify(first.answers)}\n  events: ${ev.join(' > ')}`);
  for (const need of ['fmc_view', 'fmc_start', 'q_view', 'q_answer', 'result_view', 'cta_click', 'evidence_open', 'compare_view', 'feedback_view', 'feedback_answer', 'feedback_text'])
    check(ev.includes(need), `${label}: event ${need}`);
  check(nAlts >= 2 && nAlts <= 3, `${label}: 2–3 alternatives (${nAlts})`);
  check(overflow <= 0, `${label}: no horizontal page scroll (${overflow}px)`);
  check(errors.length === 0, `${label}: no console errors/warnings ${errors.join(' | ')}`);
  // shared link restores the same shortlist
  const url = page.url();
  const p2 = await browser.newPage({ viewport });
  await p2.route('https://fonts.googleapis.com/**', r => r.abort());
  await p2.goto(url); await p2.waitForSelector('.hero');
  check((await p2.textContent('#h-hero')) === hero, `${label}: shared link reproduces hero`);
  await p2.close(); await page.close();
}

await run('desktop-family', { width: 1440, height: 900 }, ['family', 'mixed', 'no', 'any', 'any']);
await run('mobile-city', { width: 390, height: 844 }, ['solo', 'city', 'yes', 'any', 'any']);
await run('mobile-seven', { width: 390, height: 844 }, ['seven', 'long', 'no', 'any']);
await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
