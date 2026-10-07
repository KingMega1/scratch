import { RecommendationResult, type BuyerBrief } from '@/lib/recommendation/contract';

/* Prepared P5 boundary only. P1 owns brief binding and result semantics. Nothing here
   scores, ranks, parses, invents statements or derives a tie/lean state. The default
   provider remains blocked; this module is not activated by an environment flag. */
export interface SemanticRelease {
  decision: 'RELEASE';
  p3_artifact_id: string;
  p1_evidence_ref: string;
  engine_version: string;
  universe_version: string;
  registry_snapshot_id: string;
}
export interface ReleasedP1Transport {
  execute(brief: BuyerBrief): Promise<unknown>;
}
export const P3_INTEGRATION_ARTIFACT = '1791368192-d509';

export function prepareReleasedAdapter(release: SemanticRelease | null, transport: ReleasedP1Transport) {
  if (!release || release.decision !== 'RELEASE' || release.p3_artifact_id !== P3_INTEGRATION_ARTIFACT ||
      !release.p1_evidence_ref || !release.engine_version || !release.universe_version || !release.registry_snapshot_id) {
    throw new Error('pending_semantic_acceptance');
  }
  return async (brief: BuyerBrief) => {
    if (!brief.confirmed) throw new Error('brief_not_confirmed');
    const raw = await transport.execute(brief);
    // Sharing must reject unexpected fields rather than silently stripping private data.
    const result = RecommendationResult.strict().parse(raw);
    if (raw && typeof raw === 'object' && 'brief' in raw &&
        (raw as { brief: Record<string, unknown> }).brief?.free_text !== undefined) throw new Error('unsafe_result');
    if (result.engine_version !== release.engine_version || result.universe_version !== release.universe_version ||
        result.registry_snapshot_id !== release.registry_snapshot_id) throw new Error('release_version_mismatch');
    return result;
  };
}
