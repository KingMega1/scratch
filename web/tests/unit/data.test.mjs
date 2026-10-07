import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const snap = JSON.parse(readFileSync('data/registry/universe.snapshot.json', 'utf8'));
const manifest = JSON.parse(readFileSync('data/registry/sync-manifest.json', 'utf8'));

test('snapshot carries source commit, sha256, registry_version, snapshot_id', () => {
  assert.match(snap.meta.source.commit, /^[0-9a-f]{40}$/);
  assert.match(snap.meta.source.sha256, /^[0-9a-f]{64}$/);
  assert.ok(snap.meta.registry_version);
  assert.equal(snap.meta.snapshot_id, `${snap.meta.registry_version}@${snap.meta.source.commit.slice(0, 12)}`);
  assert.equal(manifest.snapshot_id, snap.meta.snapshot_id);
  assert.ok(manifest.synced_at);
});
test('public universe count matches meta', () => assert.equal(snap.models.filter(m => m.u).length, snap.meta.models_in_universe));
test('stable unique model ids', () => {
  const ids = snap.models.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+\/[a-z0-9-]+$/);
});
test('P1 vendored sources match manifest hashes', () => {
  const m = JSON.parse(readFileSync('src/server/p1/vendor/manifest.json', 'utf8'));
  const src = readFileSync('src/server/p1/vendor/sources.generated.ts', 'utf8');
  const obj = JSON.parse(src.slice(src.indexOf('= ') + 2, src.lastIndexOf(';')));
  for (const [name, meta] of Object.entries(m.files)) assert.equal(createHash('sha256').update(obj[name]).digest('hex'), meta.sha256, name);
});
test('non-production fixture is labelled and has no fit tiers / no single winner', () => {
  const f = readFileSync('tests/fixtures/reco.tie.NONPRODUCTION.json', 'utf8');
  assert.match(f, /NON-PRODUCTION/);
  assert.doesNotMatch(f, /very good fit|good fit/i);
  assert.equal(JSON.parse(f).state.kind, 'tie');
});
