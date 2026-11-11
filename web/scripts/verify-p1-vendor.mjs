#!/usr/bin/env node
/* Verifies web/p1-release/ is byte-identical to the P1 release record P1-RELEASE-T1 (sha256 + bytes), that the
   record itself is the one P5 bound (src/server/p1/release.ts BOUND.record_sha256), and that the transport loads
   with the bound engine/transport/dataset versions. Exit 1 on any drift. P5 never edits P1 code. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = new URL('../p1-release/', import.meta.url).pathname;
const sha = b => createHash('sha256').update(b).digest('hex');
const src = readFileSync(new URL('../src/server/p1/release.ts', import.meta.url), 'utf8');
const want = k => (new RegExp(`${k}: '([^']+)'`).exec(src) || [])[1];
const errors = [];
const recBytes = readFileSync(join(root, 'buyer-decision/release/P1-RELEASE-T1.json'));
if (sha(recBytes) !== want('record_sha256')) errors.push('release record sha256 != BOUND.record_sha256');
const rec = JSON.parse(recBytes);
const vendored = JSON.parse(readFileSync(join(root, 'VENDORED.json'), 'utf8'));
for (const p of vendored.files) {
  const f = Object.values(rec.files).find(x => x.path === p);
  if (!f) { errors.push(`${p}: not in release record`); continue; }
  const b = readFileSync(join(root, p));
  if (sha(b) !== f.sha256 || b.length !== f.bytes) errors.push(`${p}: ${sha(b).slice(0, 12)} != record ${f.sha256.slice(0, 12)}`);
}
const T = createRequire(import.meta.url)(join(root, 'buyer-decision/transport/reco.js'));
const ds = T.loadAcceptedDataset(join(root, rec.dataset.path));
if (T.ENGINE_VERSION !== want('engine_version')) errors.push(`engine ${T.ENGINE_VERSION}`);
if (T.TRANSPORT_VERSION !== want('transport_version')) errors.push(`transport ${T.TRANSPORT_VERSION}`);
if (ds.universe_version !== want('universe_version') || ds.sha256 !== want('dataset_content_sha256')) errors.push(`dataset ${ds.universe_version} ${ds.sha256.slice(0, 12)}`);
if (errors.length) { console.error('P1 release integrity FAILED\n' + errors.join('\n')); process.exit(1); }
console.log(`P1 release OK: ${rec.record} @ ${vendored.record_commit.slice(0, 12)} · ${vendored.files.length} files · ${T.ENGINE_VERSION} · ${T.TRANSPORT_VERSION} · ${ds.universe_version} ${ds.sha256.slice(0, 12)}`);
