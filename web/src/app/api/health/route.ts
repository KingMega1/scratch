import { json } from '@/server/http/guard';
import { vehicles } from '@/server/vehicles/read-model';
import { p1EngineInfo, verifyP1Vendor } from '@/server/p1/loader';
import { recommendationProvider } from '@/server/recommendation/provider';
import { serverEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

/* Public health/version probe. Versions and integrity only — no secrets, no internal data. */
export function GET() {
  const m = vehicles().meta();
  const p1 = p1EngineInfo();
  return json({
    ok: true,
    env: serverEnv().CI_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
    registry: { registry_version: m.registry_version, snapshot_id: m.snapshot_id, source_commit: m.source.commit, source_sha256: m.source.sha256, models: m.models_in_universe },
    recommendation: { status: recommendationProvider().status().status, engine_version: p1.engine_version, p1_source_commit: p1.source_commit, vendor_integrity: verifyP1Vendor().ok },
    features: { customer_pii: serverEnv().FEATURE_CUSTOMER_PII === 'true', fmc_semantic: serverEnv().FEATURE_FMC_SEMANTIC === 'true' },
  });
}
