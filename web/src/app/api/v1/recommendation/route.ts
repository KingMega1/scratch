import { json, log, rateLimit, readJson } from '@/server/http/guard';
import { FmcRequest, type RecommendationApiError } from '@/lib/recommendation/contract';
import { recommendationStatus } from '@/server/recommendation/provider';
import * as F from '@/server/recommendation/fmc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* POST /api/v1/recommendation — Find My Car steps over the P1 transport (P1-RELEASE-T1, ci.reco.v1).
   Bodies are never logged (they can hold the buyer's own words); errors log only their code. */
export async function POST(req: Request) {
  // ~10 calls per buyer journey; 120/min per client keeps abuse bounded without failing real retries.
  const limited = rateLimit(req, 'reco', 120); if (limited) return limited;
  let body: unknown;
  try { body = await readJson(req, 24_576); } catch { return json({ error: 'invalid_request' } satisfies RecommendationApiError, 400); }
  const p = FmcRequest.safeParse(body);
  if (!p.success) return json({ error: 'invalid_request' } satisfies RecommendationApiError, 400);
  const st = recommendationStatus();
  if (st.status !== 'ready') { log('reco_refused', { reason: st.reason }); return json({ error: 'release_unavailable' } satisfies RecommendationApiError, 503); }
  const r = p.data, L = r.locale;
  try {
    switch (r.op) {
      case 'status': return json({ status: st, copy: F.uiCopy(L) });
      case 'start': return json(F.start(r.path, r.text ?? null, L));
      case 'answer': return json(F.answer(r.brief, r.asked, r.path, r.q, r.value, L));
      case 'summary': return json(F.summaryOf(r.brief, L));
      case 'edit_form': return json(F.editForm(r.brief, L));
      case 'parse_names': return json({ items: F.parseNames(r.kind, r.text, L) });
      case 'edit_save': return json(F.saveEdit(r.brief, r.edit, L));
      case 'execute': return json(F.execute(r.brief, L));
      case 'shared': return json(F.executeShared(r.r, L));
      case 'adjust': return json(F.adjust(r.brief, r.action, L));
    }
  } catch (e) {
    const code = e instanceof F.FmcError ? e.code : 'unavailable', status = e instanceof F.FmcError ? e.status : 500;
    log('reco_error', { op: r.op, code });
    return json({ error: code } as RecommendationApiError, status);
  }
}
