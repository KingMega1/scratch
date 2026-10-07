#!/usr/bin/env node
/* Verifies the vendored P1 sources are byte-identical to manifest.json (sha256 + bytes). Exit 1 on any drift.
   P5 never edits P1 code; this makes an accidental edit fail CI instead of failing at runtime. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const dir = new URL('../src/server/p1/vendor/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
const gen = readFileSync(new URL('sources.generated.ts', dir), 'utf8');
const m = /export const P1_SOURCES: Record<string, string> = (\{[\s\S]*\});\s*$/.exec(gen);
if (!m) { console.error('sources.generated.ts: unexpected format'); process.exit(1); }
const sources = JSON.parse(m[1]);
const errors = [];
for (const [name, meta] of Object.entries(manifest.files)) {
  const code = sources[name];
  if (code == null) { errors.push(`${name}: missing`); continue; }
  const sha = createHash('sha256').update(code).digest('hex');
  if (sha !== meta.sha256) errors.push(`${name}: sha256 ${sha.slice(0, 12)} != manifest ${meta.sha256.slice(0, 12)}`);
  if (Buffer.byteLength(code) !== meta.bytes) errors.push(`${name}: bytes ${Buffer.byteLength(code)} != manifest ${meta.bytes}`);
}
for (const name of Object.keys(sources)) if (!manifest.files[name]) errors.push(`${name}: not in manifest`);
if (errors.length) { console.error('P1 vendor integrity FAILED\n' + errors.join('\n')); process.exit(1); }
console.log(`P1 vendor OK @ ${manifest.source_commit.slice(0, 12)}: ${Object.keys(manifest.files).join(', ')}`);
