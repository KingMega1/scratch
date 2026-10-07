import 'server-only';
import type { BuyerBrief, RecommendationResult } from '@/lib/recommendation/contract';
import { p1EngineInfo } from '../p1/loader';
import { serverEnv } from '../env';

/* Server-side Recommendation integration boundary.
   The browser never receives P1 scoring, weights or eligibility code; it calls POST /api/v1/recommendation.
   S1 state: BLOCKED. The provider reports availability only. Engine -> ci.reco.v1 mapping is deliberately
   NOT implemented until P1 passes the revised P3 semantics (see SEMANTIC_GATE). */

export type ProviderStatus =
  | { status: 'blocked'; reason: 'pending_semantic_acceptance'; engine_version: string | null; universe_version: string }
  | { status: 'ready'; engine_version: string; universe_version: string };

export interface RecommendationProvider {
  status(): ProviderStatus;
  recommend(brief: BuyerBrief): Promise<RecommendationResult>;
}

class GatedP1Provider implements RecommendationProvider {
  status(): ProviderStatus {
    const info = p1EngineInfo();
    // FEATURE_FMC_SEMANTIC may only be switched on after the P1 PASS; even then recommend() must be implemented first.
    return { status: 'blocked', reason: 'pending_semantic_acceptance', engine_version: info.engine_version, universe_version: info.universe_version };
  }
  async recommend(): Promise<RecommendationResult> {
    throw new Error(`recommendation semantics blocked (FEATURE_FMC_SEMANTIC=${serverEnv().FEATURE_FMC_SEMANTIC})`);
  }
}

let p: RecommendationProvider | null = null;
export const recommendationProvider = () => (p ??= new GatedP1Provider());
