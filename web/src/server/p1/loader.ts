import 'server-only';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import manifest from './vendor/manifest.json';
import { P1_SOURCES } from './vendor/sources.generated';
import { rawUniverseForEngine } from '../vehicles/read-model';

/* Loads the vendored P1 engine verbatim (hash-verified) in an isolated VM context, server-side only.
   S1 uses it for version reporting and integrity proof; no results are mapped while semantics are blocked. */

type EngineApi = { ENGINE_VERSION: string };
let cached: { engine: EngineApi | null; error: string | null } | null = null;

export function verifyP1Vendor(): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const [name, meta] of Object.entries(manifest.files as Record<string, { sha256: string }>)) {
    const code = P1_SOURCES[name];
    if (!code || createHash('sha256').update(code).digest('hex') !== meta.sha256) mismatches.push(name);
  }
  return { ok: mismatches.length === 0, mismatches };
}

function load() {
  if (cached) return cached;
  const v = verifyP1Vendor();
  if (!v.ok) return (cached = { engine: null, error: `P1 vendor hash mismatch: ${v.mismatches.join(',')}` });
  try {
    const sandbox: { module: { exports: unknown }; console: Console } = { module: { exports: {} }, console };
    vm.runInNewContext(P1_SOURCES['engine.js'], sandbox, { filename: 'p1/engine.js', timeout: 1000 });
    return (cached = { engine: sandbox.module.exports as EngineApi, error: null });
  } catch (e) {
    return (cached = { engine: null, error: String(e) });
  }
}

export function p1EngineInfo() {
  const l = load();
  return {
    engine_version: l.engine?.ENGINE_VERSION ?? null,
    universe_version: rawUniverseForEngine().meta.version,
    source_commit: manifest.source_commit,
    error: l.error,
  };
}
