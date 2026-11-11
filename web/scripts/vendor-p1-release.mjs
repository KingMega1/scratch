#!/usr/bin/env node
/* Vendors the P1 release (record P1-RELEASE-T1) VERBATIM from git, keeping P1's directory layout
   (transport/ resolves ../app/). P5 never edits these files. Every file is checked against the release record.
   Usage (from web/): node scripts/vendor-p1-release.mjs <release-record-commit>   e.g. 090edb4 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const commit = process.argv[2];
if (!/^[0-9a-f]{7,40}$/.test(commit || '')) { console.error('usage: vendor-p1-release.mjs <commit>'); process.exit(1); }
const show = p => execFileSync('git', ['show', `${commit}:${p}`], { maxBuffer: 64 << 20 });
const RECORD = 'buyer-decision/release/P1-RELEASE-T1.json';
const recordBytes = show(RECORD);
const record = JSON.parse(recordBytes);
// The files the transport needs at runtime, plus the contract documents (P5-INTEGRATION.md §1).
const NEED = ['engine', 'parser', 'copy_i18n', 'presentation_extracted', 'redaction', 'transport', 'schema', 'p5_contract', 'dataset_manifest', 'dataset_view'];
const OUT = 'p1-release';
const errors = [];
for (const k of NEED) {
  const f = record.files[k];
  const bytes = show(f.path);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== f.sha256 || bytes.length !== f.bytes) errors.push(`${f.path}: ${sha.slice(0, 12)}/${bytes.length} != record ${f.sha256.slice(0, 12)}/${f.bytes}`);
  mkdirSync(join(OUT, dirname(f.path)), { recursive: true });
  writeFileSync(join(OUT, f.path), bytes);
}
mkdirSync(join(OUT, dirname(RECORD)), { recursive: true });
writeFileSync(join(OUT, RECORD), recordBytes);
if (errors.length) { console.error('P1 release vendor FAILED\n' + errors.join('\n')); process.exit(1); }
const commitFull = execFileSync('git', ['rev-parse', commit]).toString().trim();
writeFileSync(join(OUT, 'VENDORED.json'), JSON.stringify({ record: record.record, record_commit: commitFull, record_sha256: createHash('sha256').update(recordBytes).digest('hex'), files: NEED.map(k => record.files[k].path) }, null, 1) + '\n');
console.log(`vendored ${record.record} @ ${commitFull.slice(0, 12)}: ${NEED.length} files verified`);
