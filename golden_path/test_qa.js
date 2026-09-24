// Negative/positive tests for the QA gate and Telegram reply parser. Run: node test_qa.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runQaGate } = require('./src/qa_gate');
const { tgParseReply } = require('./src/telegram_approval');

const story = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/stories/01_buyer_check_tiggo7pro.json'), 'utf8'));
const postId = 'CI-TEST-01';
const roles = ['cover', 'key_fact', 'why_it_matters', 'strengths', 'caveat', 'cta_source'];
const goodFiles = () => roles.map((r, i) => ({ filename: `${postId}_0${i + 1}_${r}.png`, path: '/x', exists: true, width: 1080, height: 1350, bytes: 80000, overflow: [] }));
const goodImage = () => ({ path: '/img.webp', source_url: 'https://www.chery.my/x.webp', registry_status: 'approved', vehicle: 'Chery Tiggo 7 Pro', width: 1200, ai_generated: false });
const clone = o => JSON.parse(JSON.stringify(o));
const qa = (c, img, files) => runQaGate(c, img || goodImage(), files || goodFiles(), { postId, today: '2026-09-24' });
const failsWith = (res, tag) => res.failures.some(f => f.startsWith(`[${tag}]`));

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('golden story passes', () => assert.ok(qa(story.content).passed));
t('fabricated price in text fails', () => { const c = clone(story.content); c.slides[1].body_ar += ' والسعر القديم 999,000'; c.slides[1].body_en += ' Old price 999,000.'; assert.ok(failsWith(qa(c), 'claims')); });
t('verified fact without source fails', () => { const c = clone(story.content); c.key_data[0].source_id = null; assert.ok(failsWith(qa(c), 'facts')); });
t('missing fact carrying a value fails', () => { const c = clone(story.content); c.key_data[9].value = '1,000'; assert.ok(failsWith(qa(c), 'facts')); });
t('wrong derived arithmetic fails', () => { const c = clone(story.content); c.key_data[4].value = '55,000'; assert.ok(failsWith(qa(c), 'facts')); });
t('headline number not verified fails', () => { const c = clone(story.content); c.key_data[0].status = 'missing'; c.key_data[0].value = null; assert.ok(failsWith(qa(c), 'facts')); });
t('hype word fails', () => { const c = clone(story.content); c.hook.en = 'An amazing Tiggo 7 Pro deal'; assert.ok(failsWith(qa(c), 'hype')); });
t('unsourced superlative fails', () => { const c = clone(story.content); c.slides[2].title_ar = 'أرخص عربية في الفئة'; assert.ok(failsWith(qa(c), 'claims')); });
t('5 slides fails', () => { const c = clone(story.content); c.slides.pop(); assert.ok(failsWith(qa(c), 'slides')); });
t('no sources fails', () => { const c = clone(story.content); c.sources = []; assert.ok(failsWith(qa(c), 'source')); });
t('Arabic-Indic digits fail', () => { const c = clone(story.content); c.hook.ar = 'تيجو بقت بـ١,٠٨٠,٠٠٠ جنيه'; assert.ok(failsWith(qa(c), 'language')); });
t('AR/EN number mismatch fails', () => { const c = clone(story.content); c.slides[1].body_en = 'GB Auto added EGP 5,000 in September.'; assert.ok(failsWith(qa(c), 'language')); });
t('Arabic in English field fails', () => { const c = clone(story.content); c.hook.en = 'Tiggo 7 Pro بقت'; assert.ok(failsWith(qa(c), 'language')); });
t('AI-generated image fails', () => { const i = goodImage(); i.ai_generated = true; assert.ok(failsWith(qa(story.content, i), 'image')); });
t('no image fails', () => assert.ok(failsWith(qa(story.content, {}), 'image')));
t('image of another car fails', () => { const i = goodImage(); i.vehicle = 'Chery Tiggo 8 Pro'; assert.ok(failsWith(qa(story.content, i), 'image')); });
t('5 rendered files fails', () => { const f = goodFiles(); f.pop(); assert.ok(failsWith(qa(story.content, null, f), 'render')); });
t('wrong filename fails', () => { const f = goodFiles(); f[2].filename = 'uuid-1234.png'; assert.ok(failsWith(qa(story.content, null, f), 'filename')); });
t('blank render fails', () => { const f = goodFiles(); f[0].bytes = 3000; assert.ok(failsWith(qa(story.content, null, f), 'render')); });
t('text overflow fails', () => { const f = goodFiles(); f[1].overflow = ['long body']; assert.ok(failsWith(qa(story.content, null, f), 'render')); });
t('too-long hook fails', () => { const c = clone(story.content); c.hook.ar = 'تيجو '.repeat(20); assert.ok(failsWith(qa(c), 'length')); });

t('reply YES approves', () => assert.deepStrictEqual(tgParseReply(' yes '), { decision: 'APPROVED', reason: '' }));
t('reply نعم approves', () => assert.strictEqual(tgParseReply('نعم').decision, 'APPROVED'));
t('reply NO <reason> rejects with reason', () => assert.deepStrictEqual(tgParseReply('NO price is old'), { decision: 'REJECTED', reason: 'price is old' }));
t('reply لا <reason> rejects with reason', () => assert.deepStrictEqual(tgParseReply('لا الصورة غلط'), { decision: 'REJECTED', reason: 'الصورة غلط' }));
t('reply NO without reason still rejects', () => assert.strictEqual(tgParseReply('no').reason, '(no reason given)'));
t('ambiguous reply changes nothing', () => assert.strictEqual(tgParseReply('yes but fix slide 3').decision, null));
t('unrelated reply changes nothing', () => assert.strictEqual(tgParseReply('nice').decision, null));

console.log(`\n${n} tests passed`);
