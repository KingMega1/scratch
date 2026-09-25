// Funnel KPI report from collected events.
//   node tools/kpi_report.mjs events.ndjson        (collector output)
//   node tools/kpi_report.mjs export.json          (browser QA export: JSON array)
import fs from 'node:fs';

const raw = fs.readFileSync(process.argv[2] || 'events.ndjson', 'utf8').trim();
const ev = raw.startsWith('[') ? JSON.parse(raw) : raw.split('\n').filter(Boolean).map(l => JSON.parse(l));
const by = {};
for (const e of ev) (by[e.session_id] ||= []).push(e);
const S = Object.values(by);
const has = (s, name, f = () => true) => s.some(e => e.event === name && f(e.props || {}));
const n = f => S.filter(f).length;
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const med = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

const views = n(s => has(s, 'fmc_view', p => p.entry !== 'shared_link')), starts = n(s => has(s, 'fmc_start'));
// flow sessions = started the questions; shared-link opens are reported separately
const results = n(s => has(s, 'fmc_start') && has(s, 'result_view')), noMatch = n(s => has(s, 'fmc_start') && has(s, 'no_match_view') && !has(s, 'result_view'));
const sharedOpens = n(s => has(s, 'fmc_view', p => p.entry === 'shared_link'));
const flow = S.filter(s => has(s, 'fmc_start'));
const fbAns = flow.flatMap(s => s.filter(e => e.event === 'feedback_answer').slice(-1));
const helped = fbAns.filter(e => e.props.helped === 'yes').length, some = fbAns.filter(e => e.props.helped === 'somewhat').length;
const nextStep = n(s => has(s, 'fmc_start') && has(s, 'result_view') && (has(s, 'evidence_open') || has(s, 'cta_click')));
const promote = n(s => has(s, 'fmc_start') && has(s, 'alt_promote'));
const firstResult = flow.map(s => s.find(e => e.event === 'result_view')).filter(Boolean);
const modes = {}, conf = {}, langs = {};
firstResult.forEach(e => { modes[e.props.mode] = (modes[e.props.mode] || 0) + 1; conf[e.props.confidence] = (conf[e.props.confidence] || 0) + 1; langs[e.lang] = (langs[e.lang] || 0) + 1; });

console.log(`Sessions ${S.length} · events ${ev.length}\n`);
console.log('FUNNEL');
console.log(`  Entry → start           ${pct(starts, views)}  (${starts}/${views})`);
console.log(`  Start → result          ${pct(results, starts)}  (${results}/${starts})`);
console.log(`  No-match only           ${pct(noMatch, starts)}`);
console.log(`  Median time to result   ${med(firstResult.map(e => e.props.ms_to_result)) ?? '—'} ms`);
console.log(`  Next step (evidence/CTA) ${pct(nextStep, results)}`);
console.log(`  Swapped hero for an alt ${pct(promote, results)}`);
console.log(`  Compare opened          ${pct(n(s => has(s, 'fmc_start') && has(s, 'compare_view')), results)}`);
console.log(`  Shared-link opens       ${sharedOpens}`);
console.log('\nDECISION PROGRESS (north star)');
console.log(`  Feedback response       ${pct(fbAns.length, results)}  (${fbAns.length}/${results})`);
console.log(`  Helped = yes            ${pct(helped, fbAns.length)}   somewhat ${pct(some, fbAns.length)}`);
console.log(`  Wrote a note            ${pct(n(s => has(s, 'fmc_start') && has(s, 'feedback_text')), fbAns.length)}`);
console.log('\nSTEP DROP-OFF (viewed → answered)');
const qs = [...new Set(ev.filter(e => e.event === 'q_view').map(e => e.props.q_id))];
for (const q of qs) {
  const v = n(s => has(s, 'q_view', p => p.q_id === q)), a = n(s => has(s, 'q_answer', p => p.q_id === q));
  console.log(`  ${q.padEnd(12)} ${pct(a, v)}  (${a}/${v})  median ${med(ev.filter(e => e.event === 'q_answer' && e.props.q_id === q).map(e => e.props.ms_on_step)) ?? '—'} ms`);
}
console.log('\nRESULT MIX');
console.log('  mode', modes, '\n  confidence', conf, '\n  lang', langs);
const helpedBy = k => { const o = {}; flow.forEach(s => { const r = s.find(e => e.event === 'result_view'); const f = s.filter(e => e.event === 'feedback_answer').slice(-1)[0]; if (r && f) { const key = r.props[k]; (o[key] ||= { yes: 0, n: 0 }); o[key].n++; if (f.props.helped === 'yes') o[key].yes++; } }); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v.yes}/${v.n}`])); };
console.log('  helped=yes by mode', helpedBy('mode'), '\n  helped=yes by confidence', helpedBy('confidence'));
const notes = ev.filter(e => e.event === 'feedback_text');
if (notes.length) { console.log('\nNOTES'); notes.forEach(e => console.log(`  [${e.props.helped}/${e.lang}] ${e.props.text}`)); }
