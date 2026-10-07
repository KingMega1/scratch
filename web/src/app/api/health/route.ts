import { json } from '@/server/http/guard';
import { vehicles } from '@/server/vehicles/read-model';
import { p1EngineInfo, verifyP1Vendor } from '@/server/p1/loader';
import { recommendationProvider } from '@/server/recommendation/provider';
import { serverEnv } from '@/server/env';
import manifest from '@data/registry/sync-manifest.json';

export const dynamic = 'force-dynamic';

/* Public health/version probe. Versions and integrity only — no secrets, no internal data. */
export function GET() {
  const m = vehicles().meta();
  const p1 = p1EngineInfo();
  return json({
    ok: true,
    env: serverEnv().CI_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
    registry: { schema: m.schema, registry_version: m.registry_version, snapshot_id: m.snapshot_id, generated_as_of: m.generated_as_of, source: { repo: m.source.repo, branch: m.source.branch, commit: m.source.commit, path: m.source.path, sha256: m.source.sha256 }, synced_at: manifest.synced_at, models: m.models_total, in_slice: m.models_in_slice },
    recommendation: { status: recommendationProvider().status().status, gate: 'P1 R3 RELEASE', engine_version: p1.engine_version, engine_universe_built_for: p1.engine_universe_built_for, p1_source_commit: p1.source_commit, vendor_integrity: verifyP1Vendor().ok },
    features: { customer_pii: serverEnv().FEATURE_CUSTOMER_PII === 'true', fmc_semantic: serverEnv().FEATURE_FMC_SEMANTIC === 'true' },
  });
}
