import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const snap = JSON.parse(readFileSync('data/registry/universe.snapshot.json', 'utf8'));
const manifest = JSON.parse(readFileSync('data/registry/sync-manifest.json', 'utf8'));

test('snapshot carries canonical source repo/branch/path, commit, sha256, registry_version, snapshot_id; manifest has synced_at', () => {
  const src = snap.meta.source;
  assert.equal(src.repo, 'KingMega1/scratch');
  assert.equal(src.branch, 'claude/carindex-buyer-vehicle-data-97yinp');
  assert.equal(src.path, 'vehicle-data/views/p1_suv_2m.json');
  assert.match(src.commit, /^[0-9a-f]{40}$/);
  assert.match(src.sha256, /^[0-9a-f]{64}$/);
  assert.match(snap.meta.schema, /^carindex\.p1\.buyer_view\/v\d+$/);
  assert.equal(snap.meta.snapshot_id, `${snap.meta.registry_version}@${src.commit.slice(0, 12)}`);
  assert.equal(manifest.snapshot_id, snap.meta.snapshot_id);
  assert.equal(manifest.source.sha256, src.sha256);
  assert.ok(manifest.synced_at);
});
test('embedded view hashes to the recorded sha256 is not required (re-serialised), but model count matches', () => {
  assert.equal(snap.view.models.length, snap.meta.models_total);
  assert.equal(snap.view.models.filter(m => m.in_slice).length, snap.meta.models_in_slice);
});
test('stable unique slugs; no averaged prices (CONFLICT has null value)', () => {
  const slugs = snap.view.models.map(m => m.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const m of snap.view.models) if (m.price?.price_from?.status === 'CONFLICT') assert.equal(m.price.price_from.value, null);
});
test('temporary display crosswalk is labelled non-canonical and covers only known slugs', () => {
  const cw = JSON.parse(readFileSync('data/registry/display-crosswalk.TEMP.json', 'utf8'));
  assert.match(cw._notice, /TEMPORARY/);
  const slugs = new Set(snap.view.models.map(m => m.slug));
  for (const k of Object.keys(cw.map)) assert.ok(slugs.has(k), k);
});
test('P1 release files match the release record P1-RELEASE-T1 (sha256 + bytes)', () => {
  const rec = JSON.parse(readFileSync('p1-release/buyer-decision/release/P1-RELEASE-T1.json', 'utf8'));
  const vendored = JSON.parse(readFileSync('p1-release/VENDORED.json', 'utf8'));
  for (const p of vendored.files) {
    const f = Object.values(rec.files).find(x => x.path === p), b = readFileSync('p1-release/' + p);
    assert.equal(createHash('sha256').update(b).digest('hex'), f.sha256, p); assert.equal(b.length, f.bytes, p);
  }
});
