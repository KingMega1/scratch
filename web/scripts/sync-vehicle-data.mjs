#!/usr/bin/env node
/* Deterministic vehicle-data sync: canonical GitHub accepted view -> serving read model (JSON projection).
   Canonical: KingMega1/scratch @ <pinned commit> : vehicle-data/views/p1_suv_2m.json (carindex.p1.buyer_view/*).
   GitHub accepted vehicle truth wins over any projection. This sync never writes upstream.
   Same source commit => byte-identical data/registry/universe.snapshot.json.
   Run-specific facts (synced_at) live only in data/registry/sync-manifest.json. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = {
  repo: process.env.CI_VEHICLE_SOURCE_REPO || 'KingMega1/scratch',
  branch: process.env.CI_VEHICLE_SOURCE_BRANCH || 'claude/carindex-buyer-vehicle-data-97yinp',
  commit: process.env.CI_VEHICLE_SOURCE_COMMIT || '6f3df7dc12bd389d924ad9a74cad1c0533913cf7',
  root: 'vehicle-data/',
  path: process.env.CI_VEHICLE_SOURCE_PATH || 'vehicle-data/views/p1_suv_2m.json',
};
const OUT = resolve(process.cwd(), 'data/registry');
const localFile = process.argv.find(a => a.startsWith('--file='))?.slice(7);
if (!/^[0-9a-f]{40}$/.test(SOURCE.commit)) throw new Error('CI_VEHICLE_SOURCE_COMMIT must be a full 40-char SHA (branch heads are not deterministic)');

async function fetchSource() {
  if (localFile) return readFileSync(localFile, 'utf8');
  const url = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/${SOURCE.path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

function validate(v) {
  const e = [];
  if (!/^carindex\.p1\.buyer_view\/v\d+$/.test(v.schema || '')) e.push(`unexpected schema ${v.schema}`);
  if (!v.slice) e.push('slice missing');
  if (!v.generated_as_of) e.push('generated_as_of missing');
  if (!v.price_history?.latest) e.push('price_history.latest missing');
  if (!Array.isArray(v.models) || !v.models.length) e.push('models missing');
  const ids = new Set(), slugs = new Set();
  for (const m of v.models || []) {
    if (!m.model_id || ids.has(m.model_id)) e.push(`bad/duplicate model_id ${m.model_id}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug || '') || slugs.has(m.slug)) e.push(`bad/duplicate slug ${m.slug}`);
    ids.add(m.model_id); slugs.add(m.slug);
    if (!m.brand || !m.model || !m.price || !Array.isArray(m.gaps) || !Array.isArray(m.conflicts)) e.push(`${m.model_id}: required blocks missing`);
  }
  if (e.length) throw new Error('validation failed:\n' + e.slice(0, 20).join('\n'));
}

const text = await fetchSource();
const sha256 = createHash('sha256').update(text).digest('hex');
const view = JSON.parse(text);
validate(view);
const registry_version = `${view.slice}/${view.price_history.latest}`;
const snapshot = {
  meta: {
    schema: view.schema,
    registry_version,
    snapshot_id: `${registry_version}@${SOURCE.commit.slice(0, 12)}`,
    generated_as_of: view.generated_as_of,
    models_total: view.models.length,
    models_in_slice: view.models.filter(m => m.in_slice).length,
    source: { ...SOURCE, sha256 },
  },
  view,
};
writeFileSync(resolve(OUT, 'universe.snapshot.json'), JSON.stringify(snapshot) + '\n');
writeFileSync(resolve(OUT, 'sync-manifest.json'), JSON.stringify({
  snapshot_id: snapshot.meta.snapshot_id, registry_version, schema: view.schema, source: snapshot.meta.source,
  synced_at: new Date().toISOString(), counts: { total: snapshot.meta.models_total, in_slice: snapshot.meta.models_in_slice },
}, null, 2) + '\n');
console.log(`synced ${snapshot.meta.snapshot_id}: ${snapshot.meta.models_in_slice}/${snapshot.meta.models_total} in slice, sha256 ${sha256.slice(0, 16)}…`);
