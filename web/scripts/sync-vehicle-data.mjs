#!/usr/bin/env node
/* Deterministic vehicle-data sync: accepted GitHub view -> serving read model (JSON projection).
   GitHub accepted vehicle truth is canonical. This projection never writes back upstream.
   Same source commit => byte-identical data/registry/universe.snapshot.json.
   Run-specific facts (synced_at) live only in data/registry/sync-manifest.json. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = {
  repo: process.env.CI_VEHICLE_SOURCE_REPO || 'KingMega1/carindex-buyer-test',
  commit: process.env.CI_VEHICLE_SOURCE_COMMIT || 'f994e7f2441194f149ce0e9988abe41ef10e2e11',
  path: process.env.CI_VEHICLE_SOURCE_PATH || 'data/view.js',
};
const OUT = resolve(process.cwd(), 'data/registry');
const localFile = process.argv.find(a => a.startsWith('--file='))?.slice(7);

if (!/^[0-9a-f]{40}$/.test(SOURCE.commit)) throw new Error('CI_VEHICLE_SOURCE_COMMIT must be a full 40-char commit SHA (branches are not deterministic)');

async function fetchSource() {
  if (localFile) return readFileSync(localFile, 'utf8');
  const url = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/${SOURCE.path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

function parseView(text) {
  // The accepted view is a JS assignment of a JSON literal. Parse as data; never execute it.
  const m = /^\s*window\.CI_UNIVERSE\s*=\s*([\s\S]*?);?\s*$/.exec(text);
  if (!m) throw new Error('unexpected view format: expected window.CI_UNIVERSE = {...};');
  return JSON.parse(m[1]);
}

function validate(U) {
  const errors = [];
  if (!U.meta?.version) errors.push('meta.version missing');
  if (!Array.isArray(U.models) || !U.models.length) errors.push('models missing');
  const ids = new Set();
  for (const m of U.models || []) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(m.id || '')) errors.push(`bad id ${m.id}`);
    if (ids.has(m.id)) errors.push(`duplicate id ${m.id}`);
    ids.add(m.id);
    if (!m.brand || !m.model) errors.push(`${m.id}: brand/model missing`);
    if (!Array.isArray(m.trims)) errors.push(`${m.id}: trims missing`);
    for (const t of m.trims || []) if (typeof t.min !== 'number' || t.min < 0) errors.push(`${m.id}: bad trim price`);
  }
  const inUniverse = (U.models || []).filter(m => m.u).length;
  if (U.meta?.models_in_universe != null && U.meta.models_in_universe !== inUniverse)
    errors.push(`meta.models_in_universe=${U.meta.models_in_universe} but ${inUniverse} models have u=true`);
  if (errors.length) throw new Error('validation failed:\n' + errors.slice(0, 20).join('\n'));
  return { total: U.models.length, inUniverse };
}

const text = await fetchSource();
const sha256 = createHash('sha256').update(text).digest('hex');
const U = parseView(text);
const counts = validate(U);
const snapshot = {
  meta: {
    registry_version: U.meta.version,
    snapshot_id: `${U.meta.version}@${SOURCE.commit.slice(0, 12)}`,
    built: U.meta.built,
    registration_months: U.meta.registration_months,
    last12_window: U.meta.last12_window,
    models_in_universe: counts.inUniverse,
    models_total: counts.total,
    source: { ...SOURCE, sha256 },
  },
  models: [...U.models].sort((a, b) => a.id.localeCompare(b.id)),
};
writeFileSync(resolve(OUT, 'universe.snapshot.json'), JSON.stringify(snapshot) + '\n');
writeFileSync(resolve(OUT, 'sync-manifest.json'), JSON.stringify({
  snapshot_id: snapshot.meta.snapshot_id, registry_version: snapshot.meta.registry_version,
  source: snapshot.meta.source, synced_at: new Date().toISOString(), counts,
}, null, 2) + '\n');
console.log(`synced ${snapshot.meta.snapshot_id}: ${counts.inUniverse}/${counts.total} models, sha256 ${sha256.slice(0, 16)}…`);
