// End-to-end: real collector, EN + AR, desktop + 390px. Run from buyer-decision/: node tests/e2e.mjs
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = 8799, out = path.join(root, 'tests/.e2e-events.ndjson');
fs.rmSync(out, { force: true });
// test copy of the page with the collector endpoint set (the shipped page keeps it empty)
const page0 = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8').replace('name="ci-track-endpoint" content=""', `name="ci-track-endpoint" content="http://127.0.0.1:${port}/e"`);
fs.writeFileSync(path.join(root, 'app/.e2e.html'), page0);
const col = spawn('node', [path.join(root, 'tools/collector.mjs'), String(port), out], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 400));
const base = `http://127.0.0.1:${port}/app/.e2e.html`;
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

async function run(label, viewport, lang, answers, prios = ['popular'], expectAlts = [1, 3]) {
  const page = await browser.newPage({ viewport, locale: lang === 'ar' ? 'ar-EG' : 'en-GB' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.goto(`${base}?lang=${lang}`);
  await page.screenshot({ path: path.join(root, `shots/${label}-1-entry.png`), fullPage: true });
  await page.click('#start');
  for (const v of answers) { const sel = `.opt[data-v="${v}"]:not([aria-disabled="true"])`; if (await page.$(sel)) { await page.click(sel); await page.waitForTimeout(250); } }
  if (await page.$('#done')) {
    for (const p of prios) await page.click(`.opt[data-v="${p}"]`);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, `shots/${label}-2-question.png`), fullPage: true });
    await page.click('#done');
  }
  await page.waitForSelector('.hero, .nomatch'); await page.waitForTimeout(400);
  const noMatch = !!(await page.$('.nomatch'));
  await page.screenshot({ path: path.join(root, `shots/${label}-3-result.png`), fullPage: true });
  const dir = await page.evaluate(() => document.documentElement.dir);
  check(dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${label}: dir=${dir}`);
  if (noMatch) { await page.close(); return { label, noMatch }; }
  const hero = (await page.textContent('#h-hero')).trim();
  const mode = await page.textContent('.hero .eyebrow');
  const nAlts = await page.$$eval('.alt', a => a.length);
  await page.click('.hero [data-cta="evidence"]');
  await page.waitForSelector('#sheet:not([hidden])'); await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(root, `shots/${label}-4-evidence.png`) });
  await page.keyboard.press('Escape');
  if (await page.$('#cmp-btn')) { await page.click('#cmp-btn'); await page.waitForTimeout(100); await page.screenshot({ path: path.join(root, `shots/${label}-5-compare.png`), fullPage: true }); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (lang === 'ar') {
    const arabic = await page.evaluate(() => /[؀-ۿ]/.test(document.querySelector('.hero').innerText));
    const arabicDigits = await page.evaluate(() => /[٠-٩]/.test(document.body.innerText));
    check(arabic, `${label}: hero copy is Arabic`);
    check(!arabicDigits, `${label}: Latin digits only`);
  }
  await page.locator('#fb').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  await page.click('[data-h="somewhat"]');
  await page.fill('#fb-text', lang === 'ar' ? 'عايز أعرف تكلفة الصيانة' : 'Show running costs.');
  await page.click('#fb-send');
  const url = page.url();
  // language switch keeps the result
  await page.click('#lang-btn'); await page.waitForSelector('.hero');
  const heroAfterSwitch = (await page.textContent('#h-hero')).trim();
  check(heroAfterSwitch === hero, `${label}: language switch keeps the pick`);
  const ev = await page.evaluate(() => window.dataLayer.map(e => e.event));
  for (const need of ['fmc_view', 'fmc_start', 'q_view', 'q_answer', 'result_view', 'cta_click', 'evidence_open', ...(nAlts ? ['compare_view'] : []), 'feedback_view', 'feedback_answer', 'feedback_text', 'lang_switch'])
    check(ev.includes(need), `${label}: event ${need}`);
  check(nAlts >= expectAlts[0] && nAlts <= expectAlts[1], `${label}: ${expectAlts.join('–')} alternatives (${nAlts})`);
  check(overflow <= 0, `${label}: no horizontal page scroll (${overflow}px)`);
  check(errors.length === 0, `${label}: no console errors ${errors.join(' | ')}`);
  const p2 = await browser.newPage({ viewport });
  await p2.route('https://fonts.googleapis.com/**', r => r.abort());
  await p2.goto(url); await p2.waitForSelector('.hero');
  check((await p2.textContent('#h-hero')).trim() === hero, `${label}: shared link reproduces the pick`);
  await p2.close(); await page.close();
  console.log(`  [${label}] ${mode.trim()} → ${hero} · alts ${nAlts}`);
  return { label, hero };
}

await run('en-desktop-family-mixed', { width: 1440, height: 900 }, 'en', ['five', 'mixed', 'no', 'any']);
await run('ar-mobile-city-ev', { width: 390, height: 844 }, 'ar', ['five', 'city', 'yes', 'any'], ['pocket']);
// only one SUV in the slice has 7 seats confirmed by sources: no alternatives is the honest result
await run('ar-mobile-seven-long', { width: 390, height: 844 }, 'ar', ['seven', 'long', 'no', 'any'], [], [0, 0]);
await run('en-mobile-hybrid-warranty', { width: 390, height: 844 }, 'en', ['five', 'city', 'no', 'hybrid'], ['warranty']);
await browser.close();
await new Promise(r => setTimeout(r, 300));
col.kill(); fs.rmSync(path.join(root, 'app/.e2e.html'), { force: true });

const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').length : 0;
check(lines > 40, `collector received ${lines} events`);
console.log('\n' + execFileSync('node', [path.join(root, 'tools/kpi_report.mjs'), out], { encoding: 'utf8' }));
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
