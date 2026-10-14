import { z } from 'zod';

/* P5 <-> P1 Find My Car API envelope. The result object is P1's ci.reco.v1 (P1-RELEASE-T1,
   p1-release/buyer-decision/transport/ci.reco.v1.schema.json): P5 renders it and recomputes nothing.
   The brief is the buyer's own working state: it travels only in request/response bodies between that buyer and
   the server (never URLs, storage, logs or analytics). The only URL-safe value is ci.reco.v1 share.r. */
export const RECO_SCHEMA_VERSION = 'ci.reco.v1';
const Locale = z.enum(['en', 'ar']);
const Obj = z.record(z.unknown());
const Asked = z.array(z.string().max(16)).max(16);
const Path = z.enum(['text', 'guided', 'shared']);

export const FmcRequest = z.discriminatedUnion('op', [
  z.object({ op: z.literal('status'), locale: Locale }),
  z.object({ op: z.literal('start'), locale: Locale, path: z.enum(['text', 'guided']), text: z.string().max(1000).optional() }),
  z.object({ op: z.literal('answer'), locale: Locale, brief: Obj, asked: Asked, path: Path, q: z.string().max(16), value: z.unknown() }),
  z.object({ op: z.literal('summary'), locale: Locale, brief: Obj }),
  z.object({ op: z.literal('edit_form'), locale: Locale, brief: Obj }),
  z.object({ op: z.literal('parse_names'), locale: Locale, kind: z.enum(['brand', 'car']), text: z.string().max(200) }),
  z.object({ op: z.literal('edit_save'), locale: Locale, brief: Obj, edit: Obj }),
  z.object({ op: z.literal('execute'), locale: Locale, brief: Obj }),
  z.object({ op: z.literal('shared'), locale: Locale, r: z.string().max(4000) }),
  z.object({ op: z.literal('adjust'), locale: Locale, brief: Obj, action: z.object({ kind: z.enum(['budget', 'fix', 'relax']), key: z.string().max(16).optional(), to: z.number().optional(), dir: z.number().optional() }) }),
]);
export type FmcRequest = z.infer<typeof FmcRequest>;

export type RecommendationApiError =
  | { error: 'invalid_request' | 'invalid_brief' | 'invalid_answer' | 'invalid_share' }
  | { error: 'release_unavailable' | 'release_version_mismatch' | 'privacy_guard' | 'unavailable' }
  | { error: 'rate_limited' };
