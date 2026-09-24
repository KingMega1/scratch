// Local end-to-end run of the CarIndex golden path, using the same src/*.js the n8n Code
// nodes use. Renders with Chromium (same engine as the Gotenberg/Chromium render service).
// Telegram is simulated: the exact message text is written to disk, the reply comes from
// the fixture's "telegram_reply". Nothing is sent or published.
//
// Usage: node run_golden_path.js [fixtures/stories/01_*.json ...]   (default: all stories)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { buildBuyerCheckSlides } = require('./src/buyer_check_render');
const { runQaGate } = require('./src/qa_gate');
const { tgApprovalText, tgParseReply } = require('./src/telegram_approval');
const { irResolve, irToImageRecord } = require('./src/image_registry');

const ROOT = __dirname;
const TODAY = '2026-09-24';
const OUT = path.join(ROOT, 'out');
const SHEET = path.join(OUT, 'sheet.json');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'image_registry.json'), 'utf8')).rows;
const fileUrl = p => 'file://' + path.resolve(p);

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

function loadSheet() { return fs.existsSync(SHEET) ? JSON.parse(fs.readFileSync(SHEET, 'utf8')) : []; }
function saveSheet(rows) { fs.writeFileSync(SHEET, JSON.stringify(rows, null, 2)); }
function upsert(rows, row) {
  const i = rows.findIndex(r => r.PostId === row.PostId);
  if (i === -1) rows.push(row); else rows[i] = { ...rows[i], ...row };
}

async function runStory(browser, storyFile, idx) {
  const story = JSON.parse(fs.readFileSync(storyFile, 'utf8'));
  const postId = `CI-${TODAY.replace(/-/g, '')}-${String(idx + 1).padStart(2, '0')}`;
  const dir = path.join(OUT, postId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'html'), { recursive: true });
  const log = [];
  const step = (name, detail) => { log.push({ step: name, detail }); };

  step('SOURCE', `${story.source_article.outlet} ${story.source_article.published} ${story.source_article.url}`);
  step('CURATE', story.curation);
  step('FACT CHECK', story.fact_check);
  step('EDITORIAL ANGLE', story.content.hook);
  step('CONTENT', 'structured Buyer Check JSON (see content.json)');
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(story.content, null, 2));

  // REAL IMAGE
  // resolved by vehicle (brand/model/variant), not by file name
  const res = irResolve(registry, story.content.car, TODAY);
  const image = irToImageRecord(res, loc => {
    const p = path.join(ROOT, loc);
    return fs.existsSync(p) ? fileUrl(p) : '';
  });
  image.path = image.url ? image.url.replace('file://', '') : null;
  step('REAL IMAGE', { vehicle_id: res.entry ? res.entry.vehicle_id : null, status: image.registry_status, reasons: image.registry_reasons || [], vehicle: image.vehicle, credit: image.credit });

  // TEMPLATE
  const slides = buildBuyerCheckSlides(story.content, {
    postId,
    imageUrl: image.url || '',
    imageCredit: image.credit,
    logoUrl: fileUrl(path.join(ROOT, 'assets', 'carindex-logo.png')),
    logoWhiteUrl: fileUrl(path.join(ROOT, 'assets', 'carindex-logo-white.png')),
  });
  step('TEMPLATE', slides.map(s => s.filename));

  // RENDER
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const rendered = [];
  for (const s of slides) {
    const htmlFile = path.join(dir, 'html', s.filename.replace(/\.png$/, '.html'));
    fs.writeFileSync(htmlFile, s.html);
    await page.goto(fileUrl(htmlFile), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.clip')]
      .filter(e => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)
      .map(e => (e.textContent || '').trim().slice(0, 40)));
    const pngFile = path.join(dir, s.filename);
    await page.screenshot({ path: pngFile, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    const sz = pngSize(pngFile);
    rendered.push({ filename: s.filename, path: pngFile, exists: true, ...sz, overflow });
  }
  await page.close();
  step('RENDER', rendered.map(r => `${r.filename} ${r.width}x${r.height} ${r.bytes}B${r.overflow.length ? ' OVERFLOW' : ''}`));

  // QA
  const qa = runQaGate(story.content, image, rendered, { postId, today: TODAY });
  fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify(qa, null, 2));
  step('QA', qa.passed ? `PASSED, ${qa.warnings.length} warnings` : `FAILED: ${qa.failures.length} failures`);

  const rows = loadSheet();
  const base = {
    PostId: postId, Date: TODAY, Title: story.storyTitle, URL: story.source_article.url,
    Source: story.source_article.outlet, Format: 'Buyer Check', StoryType: story.content.story_type,
    SlideFiles: rendered.map(r => r.filename), Image: res.entry ? res.entry.image_location : '',
  };

  if (!qa.passed) {
    const alert = `CarIndex: QA FAILED - blocked, not sent for approval\n\nStory: ${story.storyTitle}\nPostId: ${postId}\n\n${qa.failures.map(f => '• ' + f).join('\n')}`;
    fs.writeFileSync(path.join(dir, 'telegram_qa_fail_alert.txt'), alert);
    upsert(rows, { ...base, Status: 'QA-Failed', QAFailures: qa.failures, QAWarnings: qa.warnings });
    saveSheet(rows);
    step('TELEGRAM', 'not sent for approval (QA failed); QA-fail alert written');
    return { postId, story: story.storyTitle, type: story.test_type, qa, status: 'QA-Failed', log };
  }

  // TELEGRAM APPROVAL (simulated send)
  const post = { postId, storyTitle: story.storyTitle, content: story.content, files: rendered, image };
  const text = tgApprovalText(post, qa);
  const fakeMessageId = 900000 + idx;
  fs.writeFileSync(path.join(dir, 'telegram_approval_message.txt'), text);
  fs.writeFileSync(path.join(dir, 'telegram_payload.json'), JSON.stringify({
    previews: rendered.map((r, i) => ({ method: 'sendPhoto', caption: `${i + 1}/6 ${r.filename}`, file: r.filename })),
    approval: { method: 'sendMessage', text, stored_message_id: fakeMessageId },
  }, null, 2));
  upsert(rows, { ...base, Status: 'Pending', TelegramMessageId: fakeMessageId, QAWarnings: qa.warnings });
  saveSheet(rows);
  step('TELEGRAM', `approval message built (${text.length} chars), 6 previews, message id ${fakeMessageId}`);

  // Reply handling (same parser the n8n "Extract Reply" node uses)
  const reply = tgParseReply(story.telegram_reply);
  let status = 'Pending';
  if (reply.decision === 'APPROVED') status = 'Approved';
  if (reply.decision === 'REJECTED') status = 'Rejected';
  upsert(rows, { PostId: postId, Status: status, RejectReason: reply.reason || '', ReplyText: story.telegram_reply });
  saveSheet(rows);
  step('APPROVAL', `reply "${story.telegram_reply}" -> ${status}${reply.reason ? ' (' + reply.reason + ')' : ''}`);

  if (status === 'Approved') {
    const fin = path.join(dir, 'FINAL');
    fs.mkdirSync(fin, { recursive: true });
    for (const r of rendered) fs.copyFileSync(r.path, path.join(fin, r.filename));
    fs.writeFileSync(path.join(fin, 'manifest.json'), JSON.stringify({
      postId, status: 'APPROVED', approvedAt: TODAY, story: story.storyTitle,
      files: rendered.map(r => r.filename), sources: story.content.sources, image: { vehicle_id: res.entry.vehicle_id, location: res.entry.image_location, credit: image.credit, source_url: image.source_url, rights_status: res.entry.rights_status },
      published: false,
    }, null, 2));
    step('FINAL APPROVED ASSET', path.relative(ROOT, fin));
  }
  return { postId, story: story.storyTitle, type: story.test_type, qa, status, log };
}

(async () => {
  const args = process.argv.slice(2);
  const files = args.length ? args : fs.readdirSync(path.join(ROOT, 'fixtures', 'stories')).sort().map(f => path.join(ROOT, 'fixtures', 'stories', f));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const results = [];
  for (const f of files) {
    const idx = parseInt(path.basename(f), 10) - 1;
    results.push(await runStory(browser, f, idx));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  for (const r of results) {
    console.log(`\n=== ${r.postId} [${r.type}] ${r.story}\n    status: ${r.status}`);
    for (const x of r.qa.failures) console.log('    FAIL ' + x);
    for (const x of r.qa.warnings) console.log('    warn ' + x);
  }
})();
