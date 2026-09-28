// Runs the exact sync_core.js deployed in n8n against a mocked GitHub serving the synthetic canary files.
import fs from 'fs'; import crypto from 'crypto';
const src = fs.readFileSync(new URL('./sync_core.js', import.meta.url), 'utf8').split('// ---- n8n entry point')[0];
const run = new Function(src + '; return run;')();
const HEAD = 'c'.repeat(40), COMMITS = { A: 'a'.repeat(40), B: 'b'.repeat(40), M: 'd'.repeat(40), K: 'e'.repeat(40) };
const FILES = { A: 'p2_sync_canary.v1.json', B: 'p2_sync_canary.v2.json', M: 'p2_sync_canary.malformed.json', K: 'p2_sync_canary.missing_keys.json' };
const order = ['A', 'B', 'M', 'K'];
const byte = (k) => fs.readFileSync(new URL('./synthetic_canary/' + FILES[k], import.meta.url));
const blob = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const keyOf = (sha) => Object.keys(COMMITS).find(k => COMMITS[k] === sha || COMMITS[k].startsWith(sha));
const ctx = { helpers: { httpRequest: async ({ url }) => {
  let m;
  if ((m = url.match(/compare\/([^.]+)\.\.\.([0-9a-f]+)$/))) {
    const a = decodeURIComponent(m[1]), b = m[2];
    if (a.includes('claude%2F') || a.startsWith('claude/')) { const k = keyOf(b); return { statusCode: 200, body: { status: 'behind', merge_base_commit: { sha: COMMITS[k], commit: { committer: { date: '2026-09-28T00:00:00Z' } } } } }; }
    const ia = order.indexOf(keyOf(a)), ib = order.indexOf(keyOf(b));
    return { statusCode: 200, body: { status: ib > ia ? 'ahead' : ib < ia ? 'behind' : 'identical' } };
  }
  if ((m = url.match(/contents\/.*\?ref=([0-9a-f]+)/))) return { statusCode: 200, body: { sha: blob(byte(keyOf(m[1]))) } };
  if ((m = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([0-9a-f]+)\//))) return { statusCode: 200, body: byte(keyOf(m[1])) };
  return { statusCode: 404, body: null };
} } };
const P = 'vehicle-data/sync_canary/p2_sync_canary.json';
const ledger = { artifacts: {}, events: [] };
const cases = [['new', 'A', 'ACCEPTED_NEW'], ['rerun', 'A', 'DUPLICATE_NO_CHANGE'], ['update', 'B', 'UPDATED'], ['stale', 'A', 'REJECTED_STALE'],
               ['malformed', 'M', 'REJECTED_MALFORMED'], ['missing_keys', 'K', 'REJECTED_MALFORMED']];
let pass = true;
for (const [name, k, want] of cases) {
  const r = await run(ctx, { ref: COMMITS[k], path: P, request_id: name }, ledger, '2026-09-28T00:00:00Z');
  const ok = r.decision === want; pass &&= ok;
  console.log(name.padEnd(13), want.padEnd(22), r.decision.padEnd(22), (r.reason || '').slice(0, 60), ok ? 'PASS' : 'FAIL');
}
const cur = ledger.artifacts['github:KingMega1/scratch:' + P];
const v2sha = crypto.createHash('sha256').update(byte('B')).digest('hex');
const ok = cur.version === 2 && cur.sha256 === v2sha && Object.keys(ledger.artifacts).length === 1; pass &&= ok;
console.log('final ledger: version', cur.version, 'sha256', cur.sha256.slice(0, 16), 'consumed', JSON.stringify(cur.consumed), ok ? 'PASS' : 'FAIL');
console.log(pass ? 'ALL PASS' : 'FAILURES'); process.exit(pass ? 0 : 1);
