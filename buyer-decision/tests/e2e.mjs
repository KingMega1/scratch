// End-to-end P1.1: real collector, EN + AR, desktop + 390px. Run from buyer-decision/: node tests/e2e.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = 8799, out = path.join(root, 'tests/.e2e-events.ndjson');
fs.rmSync(out, { force: true });
const col = spawn('node', [path.join(root, 'tools/collector.mjs'), String(port), out], { stdio: 'ignore', env: { ...process.env, CI_QUIET: '1' } });
await new Promise(r => setTimeout(r, 400));
const base = process.env.BASE || `http://127.0.0.1:${port}/app/index.html`;
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

async function answerAll(page, picks = {}) {
  const asked = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector('#h-q, #confirm');
    if (await page.$('#confirm')) break;
    const qt = (await page.textContent('#h-q')).trim(); asked.push(qt);
    if (await page.$('.budget-card')) { await page.click('#done'); continue; }
    if (await page.$('#more')) { if (picks.more) { await page.fill('#more', picks.more); await page.click('#done'); } else await page.click('#skip'); continue; }
    if (await page.$('[role=checkbox]')) { for (const v of picks.prio || []) await page.click(`.opt[data-v="${v}"]`); await page.click(picks.prio ? '#done' : '#skip'); continue; }
    const vals = await page.$$eval('.opt', os => os.map(o => o.dataset.v));
    const v = vals.find(x => (picks.opts || []).includes(x)) || vals[0];
    await page.click(`.opt[data-v="${v}"]`);
    await page.waitForFunction(t => !document.querySelector('#h-q') || document.querySelector('#h-q').textContent.trim() !== t, qt);
  }
  return asked;
}

async function run(label, viewport, lang, text, picks = {}, expect = {}) {
  const page = await browser.newPage({ viewport, locale: lang === 'ar' ? 'ar-EG' : 'en-GB' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.goto(`${base}?lang=${lang}`);
  await page.screenshot({ path: path.join(root, `shots/${label}-1-welcome.png`), fullPage: true });
  if (text) { await page.fill('#brief', text); await page.click('#go'); } else await page.click('#guided');
  const asked = await answerAll(page, picks);
  await page.screenshot({ path: path.join(root, `shots/${label}-2-summary.png`), fullPage: true });
  const summary = (await page.textContent('.understood')).replace(/\s+/g, ' ');
  for (const s of expect.summary || []) check(summary.includes(s), `${label}: summary has "${s}"`);
  if (expect.edit) {
    await page.click('#edit'); await page.waitForSelector('#save');
    await page.click('[data-group="chinese"] .pick[data-v="exclude"]');
    await page.click('#save'); await page.waitForSelector('#confirm');
    check((await page.textContent('.understood')).includes(lang === 'ar' ? 'استبعدها' : 'Leave out'), `${label}: edit updates the summary`);
  }
  await page.click('#confirm');
  await page.waitForSelector('.hero, .nomatch', { timeout: 8000 }); await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(root, `shots/${label}-3-result.png`), fullPage: true });
  const dir = await page.evaluate(() => document.documentElement.dir);
  check(dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${label}: dir=${dir}`);
  const hero = (await page.textContent('#h-hero')).trim();
  const nAlts = await page.$$eval('.alt', a => a.length);
  const body = await page.textContent('main');
  for (const s of expect.result || []) check(body.includes(s), `${label}: result has "${s}"`);
  for (const sel of expect.selectors || []) check(!!(await page.$(sel)), `${label}: shows ${sel}`);
  check(!/How sure|Only one source|sources don.t|What most expats/i.test(body), `${label}: no internal-uncertainty copy`);
  if (lang === 'ar') {
    check(/[؀-ۿ]/.test(await page.textContent('.hero')), `${label}: hero copy is Arabic`);
    check(!/[٠-٩]/.test(body), `${label}: Latin digits only`);
  }
  if (nAlts) {
    await page.click('.alt [data-detail]'); await page.waitForSelector('#sheet:not([hidden])'); await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(root, `shots/${label}-4-detail.png`) });
    await page.goBack(); await page.waitForTimeout(200);
    check(await page.$eval('#sheet', el => el.hidden) && !!(await page.$('.hero')), `${label}: back closes the detail sheet, stays on result`);
    await page.click('#cmp-btn'); await page.waitForTimeout(100);
  }
  await page.locator('#fb').scrollIntoViewIfNeeded();
  await page.click('[data-h="somewhat"]'); await page.fill('#fb-text', lang === 'ar' ? 'عايز أعرف تكلفة الصيانة' : 'Show running costs.'); await page.click('#fb-send');
  const url = page.url();
  // budget up/down re-ranks in place
  await page.click('[data-adj="1"]'); await page.waitForSelector('.hero');
  check(page.url() !== url, `${label}: budget +100k updates the result link`);
  await page.click('[data-adj="-1"]'); await page.waitForSelector('.hero');
  check((await page.textContent('#h-hero')).trim() === hero, `${label}: budget back to original restores the pick`);
  // back: result -> summary
  await page.goBack(); await page.waitForSelector('#confirm');
  check(true, `${label}: back from result returns to the summary`);
  await page.goForward(); await page.waitForSelector('.hero');
  await page.click('#lang-btn'); await page.waitForSelector('.hero');
  check((await page.textContent('#h-hero')).trim() === hero, `${label}: language switch keeps the pick`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, `${label}: no horizontal page scroll (${overflow}px)`);
  const ev = await page.evaluate(() => window.dataLayer.map(e => e.event));
  for (const need of ['fmc_view', 'fmc_start', 'summary_view', 'summary_confirm', 'result_view', 'feedback_answer', 'feedback_text', 'budget_adjust', 'lang_switch', ...(nAlts ? ['evidence_open', 'compare_view'] : [])])
    check(ev.includes(need), `${label}: event ${need}`);
  check(errors.length === 0, `${label}: no console errors ${errors.join(' | ')}`);
  const p2 = await browser.newPage({ viewport });
  await p2.route('https://fonts.googleapis.com/**', r => r.abort());
  await p2.goto(url); await p2.waitForSelector('.hero');
  check((await p2.textContent('#h-hero')).trim() === hero, `${label}: shared link reproduces the pick`);
  await p2.close(); await page.close();
  console.log(`  [${label}] asked: ${asked.length} (${asked.map(a => a.slice(0, 28)).join(' | ')}) → ${hero} · alts ${nAlts}`);
}

await run('en-desktop-seven', { width: 1440, height: 900 }, 'en', 'I need a reliable 7-seater for my wife and children.', { opts: ['open'] },
  { summary: ['7 seats', 'Reliability'], result: ['7 seats', 'Reliability:'] });
await run('ar-mobile-suv-2.2', { width: 390, height: 844 }, 'ar', 'عايز عربية عالية في حدود 2.2 مليون.', { opts: ['open'] },
  { summary: ['في حدود', 'عربية عالية'], edit: true });
await run('en-mobile-shortlist', { width: 390, height: 844 }, 'en', "I'm considering Tucson and Sportage.", {},
  { summary: ['Hyundai Tucson', 'Kia Sportage'], selectors: ['.verdict-card'], result: ['The cars you named', 'Hyundai Tucson'] });
await run('en-mobile-aspiration', { width: 390, height: 844 }, 'en', 'I love the GLC or GLE, budget 1.5M', { opts: ['size'] },
  { summary: ['Mercedes-Benz GLC'], result: ['About the', 'no version is within reach'] });
await run('en-desktop-qashqai', { width: 1280, height: 900 }, 'en', "I want something around the Qashqai's size and price for my wife.", {},
  { summary: ['Nissan Qashqai'], result: ['Nissan Qashqai'] });
await run('ar-mobile-guided', { width: 390, height: 844 }, 'ar', null, { opts: ['suv', 'five', 'no_ev', 'open', 'city'], prio: ['warranty', 'reliability'], more: 'مش عايز كيا' },
  { summary: ['ضمان طويل', 'الاعتمادية'] });
await browser.close();
await new Promise(r => setTimeout(r, 300));
const kpi = await (await fetch(`http://127.0.0.1:${port}/kpi`)).text();
check(kpi.length > 0, 'live /kpi page renders');
col.kill();
const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').length : 0;
check(lines > 60, `collector received ${lines} events`);
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
