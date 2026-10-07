import { json } from '@/server/http/guard';
import { vehicles } from '@/server/vehicles/read-model';
import { recommendationStatus } from '@/server/recommendation/provider';
import { BOUND } from '@/server/p1/release';
import { serverEnv } from '@/server/env';
import manifest from '@data/registry/sync-manifest.json';

export const dynamic = 'force-dynamic';

/* Public health/version probe. Versions and integrity only — no secrets, no internal data. */
export function GET() {
  const m = vehicles().meta();
  const st = recommendationStatus();
  return json({
    ok: true,
    env: serverEnv().CI_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
    registry: { schema: m.schema, registry_version: m.registry_version, snapshot_id: m.snapshot_id, generated_as_of: m.generated_as_of, source: { repo: m.source.repo, branch: m.source.branch, commit: m.source.commit, path: m.source.path, sha256: m.source.sha256 }, synced_at: manifest.synced_at, models: m.models_total, in_slice: m.models_in_slice },
    // Find My Car runs on P1's recommendation universe (U11), which is separate from the website browse projection above.
    recommendation: { status: st.status, release: BOUND.record, release_commit: BOUND.record_commit, transport_commit: BOUND.transport_commit, schema: BOUND.schema,
      engine_version: st.engine_version, transport_version: st.status === 'ready' ? st.transport_version : null, universe_version: st.universe_version,
      dataset_sha256: st.status === 'ready' ? st.dataset_sha256 : null, p3_artifact: BOUND.p3_artifact, integrity: st.status === 'ready' },
    features: { customer_pii: serverEnv().FEATURE_CUSTOMER_PII === 'true' },
  });
}
