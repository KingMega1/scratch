import { json, log, rateLimit, readJson } from '@/server/http/guard';
import { BuyerBrief, SEMANTIC_GATE, type RecommendationApiError } from '@/lib/recommendation/contract';
import { recommendationProvider } from '@/server/recommendation/provider';

export const dynamic = 'force-dynamic';

/* POST /api/v1/recommendation — structured buyer brief -> ci.reco.v1 result.
   Validates server-side, then defers to the provider. S1: provider is BLOCKED (503) pending P1 PASS. */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'reco', 20); if (limited) return limited;
  let body: unknown;
  try { body = await readJson(req); } catch { return json({ error: 'invalid_brief', issues: [{ path: '', message: 'body must be JSON <= 16KB' }] } satisfies RecommendationApiError, 400); }
  const parsed = BuyerBrief.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_brief', issues: parsed.error.issues.slice(0, 20).map(i => ({ path: i.path.join('.'), message: i.message })) } satisfies RecommendationApiError, 400);
  if (!parsed.data.confirmed) return json({ error: 'brief_not_confirmed' } satisfies RecommendationApiError, 409);
  const st = recommendationProvider().status();
  if (st.status !== 'ready') {
    log('reco_blocked', { entry: parsed.data.entry });
    return json({ error: 'pending_semantic_acceptance', gate: SEMANTIC_GATE } satisfies RecommendationApiError, 503);
  }
  return json(await recommendationProvider().recommend(parsed.data));
}
