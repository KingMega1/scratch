import { z } from 'zod';

/* P5 <-> P1 Recommendation integration contract — ci.reco.v1 (SCAFFOLD).
   Flow: structured buyer brief -> Recommendation API (server-side, P1 engine) -> result object.
   STATUS: semantic binding BLOCKED pending "P3 semantic delta -> P1 delta re-review -> PASS"
   (P1-P3-INTEGRATION-REVIEW-01 = FAIL/REWORK). This file fixes SHAPES only. Meaning, ranking, tie logic,
   confidence wording and WHY text are P1-owned and are produced server-side by the P1 engine, never in the browser.
   Deliberately absent: fit tiers ("Very good fit"/"Good fit") and any default single-winner state. */

export const RECO_SCHEMA_VERSION = 'ci.reco.v1';

/* ---------- buyer brief ---------- */
const Body = z.enum(['suv', 'sedan', 'hatch', 'mpv']);
const Pt = z.enum(['petrol', 'hybrid', 'ev']);
const ModelId = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/);

export const BuyerBrief = z.object({
  entry: z.enum(['guided', 'free_text']),
  // Free text is parsed server-side and is never echoed into analytics or share objects.
  free_text: z.string().max(1000).optional(),
  // Every answer is explicit. Absent/null = not answered. Nothing is preselected.
  answered: z.array(z.string().max(32)).max(32),
  budget: z.object({
    amount: z.number().int().min(50_000).max(100_000_000),
    intent: z.enum(['target', 'max', 'stretch']),
    stretch_pct: z.number().min(0).max(50).optional(),
  }).nullable(),
  body: z.array(Body).max(4).nullable(),
  body_any: z.boolean().optional(),
  seats_min: z.union([z.literal(5), z.literal(7)]).nullable(),
  powertrain: z.object({ prefer: Pt.nullable(), exclude: z.array(Pt).max(3) }).nullable(),
  chinese_brands: z.enum(['open', 'prefer_not', 'exclude']).nullable(),
  drive_4wd_required: z.boolean().nullable(),
  brands: z.object({ only: z.array(z.string().max(40)).max(10), exclude: z.array(z.string().max(40)).max(20) }).nullable(),
  models: z.array(z.object({ id: ModelId, role: z.enum(['consider', 'reference', 'avoid']) })).max(10),
  usage: z.enum(['city', 'mixed', 'long']).nullable(),
  priorities: z.array(z.string().max(24)).max(3),
  checks: z.array(z.string().max(24)).max(10),
  // Results are only produced for a brief the buyer has confirmed (or edited and confirmed).
  confirmed: z.boolean(),
}).strict();
export type BuyerBrief = z.infer<typeof BuyerBrief>;

/* ---------- result ---------- */
const PriceRef = z.object({
  amount: z.number(),
  state: z.enum(['official', 'listing', 'dealer_quote', 'unknown', 'conflict']),
  date: z.string(),
  stale: z.boolean(), // freshness limit is set by data policy, not here
  version_label: z.string().nullable(),
});
const Provenance = z.object({ field: z.string(), source_kind: z.string(), date: z.string(), ref: z.string().nullable() });
// WHY / trade-offs are engine-bound: a code + params from P1, plus P1-rendered text per locale.
const EngineStatement = z.object({ code: z.string(), params: z.record(z.unknown()), text: z.object({ ar: z.string(), en: z.string() }).nullable() });

export const Candidate = z.object({
  model_id: ModelId,
  role: z.string(), // P1 vocabulary (e.g. 'equal', 'runner_up', 'cheaper'); P5 renders P1-supplied labels only
  price: PriceRef,
  why: z.array(EngineStatement),
  tradeoffs: z.array(EngineStatement),
  provenance: z.array(Provenance),
});

export const ResultState = z.discriminatedUnion('kind', [
  // A single lead the engine has earned on the confirmed brief.
  z.object({ kind: z.literal('clear'), lead_model_id: ModelId }),
  // Current pick that depends on named factors; must be presented as provisional.
  z.object({ kind: z.literal('lean'), lead_model_id: ModelId, depends_on: z.array(z.string()) }),
  // No winner: N cars fit equally well. No candidate may be presented above another.
  z.object({ kind: z.literal('tie'), tied_count: z.number().int().min(2), shown_model_ids: z.array(ModelId).min(2) }),
  // Only one eligible car exists.
  z.object({ kind: z.literal('only_one'), model_id: ModelId }),
  // Nothing eligible; engine-suggested relaxations.
  z.object({ kind: z.literal('no_match'), relaxations: z.array(z.object({ key: z.string(), matches: z.number().int().optional(), to: z.number().optional() })) }),
]);

export const RecommendationResult = z.object({
  schema: z.literal(RECO_SCHEMA_VERSION),
  result_id: z.string().uuid(),
  created_at: z.string(),
  engine_version: z.string(),
  universe_version: z.string(),
  registry_snapshot_id: z.string(),
  brief: BuyerBrief.omit({ free_text: true }), // share-safe: no free text
  state: ResultState,
  candidates: z.array(Candidate),
  why_not_others: z.object({ considered: z.number().int(), excluded_by_reason: z.record(z.number().int()), text: z.object({ ar: z.string(), en: z.string() }).nullable() }).nullable(),
  share_safe: z.literal(true),
});
export type RecommendationResult = z.infer<typeof RecommendationResult>;

/* Saved result snapshot (My CarIndex). Persisting requires verified identity (feature-gated). */
export const SavedResultSnapshot = z.object({
  result: RecommendationResult,
  saved_at: z.string(),
  customer_ref: z.string(), // opaque pointer into the identity service; no PII here
});

/* ---------- API envelope ---------- */
export type RecommendationApiError =
  | { error: 'invalid_brief'; issues: { path: string; message: string }[] }
  | { error: 'brief_not_confirmed' }
  | { error: 'pending_semantic_acceptance'; gate: string }
  | { error: 'rate_limited' }
  | { error: 'unavailable' };

export const SEMANTIC_GATE = 'P1 R3 RELEASE (after P3 semantic delta -> P1 delta re-review -> PASS)';
