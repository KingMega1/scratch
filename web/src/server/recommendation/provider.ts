import 'server-only';
import { BOUND, release } from '../p1/release';

/* Find My Car availability. READY only when the P1 release binding verifies (record, file hashes, engine/transport
   versions, accepted dataset); otherwise FMC is refused — there is no fallback engine or dataset. */
export type ProviderStatus =
  | { status: 'ready'; engine_version: string; transport_version: string; universe_version: string; dataset_sha256: string; record: string; p3_artifact: string }
  | { status: 'blocked'; reason: 'release_unavailable'; engine_version: string | null; universe_version: string | null; error: string };

export function recommendationStatus(): ProviderStatus {
  const r = release();
  if (!r.ok) return { status: 'blocked', reason: 'release_unavailable', engine_version: null, universe_version: null, error: r.error };
  return { status: 'ready', engine_version: r.T.ENGINE_VERSION, transport_version: r.T.TRANSPORT_VERSION, universe_version: r.ds.universe_version,
    dataset_sha256: r.ds.sha256, record: BOUND.record, p3_artifact: BOUND.p3_artifact };
}
