/* Public (customer-facing) vehicle shape, adapted from the canonical carindex.p1.buyer_view/v2.
   Only this shape reaches the browser. Internal machinery (confidence grades, row refs, QA queues) stays server-side;
   customer-facing evidence (source name, date, link) is kept because every figure must carry it. */

export type Powertrain = 'ice' | 'hybrid' | 'phev' | 'reev' | 'ev';

/* Brand V2 evidence states. 'checked' = official figure with a named, dated source (bracket allowed). */
export type PriceState = 'checked' | 'near' | 'conflict' | 'unknown';

export type AssetFlag = 'TEMP_UNVERIFIED' | 'PHOTO_NEEDS_ENRICHMENT' | 'EXACT_CAR_UNCONFIRMED' | 'WATERMARK_CROPPED';

export interface SourceRef { name: string; url: string | null; observedAt: string; effectiveDate: string | null }

export interface OfficialPrice {
  state: PriceState;
  value: number | null;      // single figure (AGREED / SINGLE_SOURCE)
  min: number | null;        // NEAR_AGREEMENT range, or lowest conflicting value
  max: number | null;
  values: number[];          // CONFLICT: every disagreeing value, never averaged
  agreedBySources: number;   // count of sources giving the figure
  sources: SourceRef[];
}

export interface PublicTrim {
  key: string;
  label: string;
  modelYear: number | null;
  official: OfficialPrice;
  market: { value: number; source: string; observedAt: string } | null; // separate series, never merged
}

export interface PriceChange { modelYear: number | null; trim: string; from: number; to: number; effectiveDate: string; source: string; url: string | null; kind: 'stated' | 'observed' }

export interface SpecValue { values: { value: string; sources: string[] }[]; multiple: boolean }

export interface PublicImage { src: string; credit: string | null; sourcePage: string | null; flags: AssetFlag[] }

export type GapCode = 'SINGLE_SOURCE_MODEL' | 'FROM_PRICE_IN_CONFLICT' | 'REGISTRATION_UNLINKED' | 'PRICE_RULE_NOT_MET' | 'NO_OFFICIAL_PRICE' | 'UNRESOLVED_TRIMS_IN_PRICED_COHORT' | string;

export interface PublicCar {
  id: string;                // URL slug from the view (identity PROVISIONAL upstream: D3/D4)
  brand: { en: string; ar: string | null };
  model: { en: string; ar: string | null };
  inSlice: boolean;
  priceFrom: {
    state: PriceState;       // checked | near (range) | conflict | unknown
    value: number | null; min: number | null; max: number | null;
    sortValue: number | null; // for ordering/filtering only; never displayed as a price
    modelYear: number | null;
  };
  trims: PublicTrim[];       // latest priced model-year cohort
  otherCohorts: { modelYear: number | null; trims: PublicTrim[] }[];
  changes: PriceChange[];
  specs: Record<string, SpecValue>;
  powertrains: Powertrain[]; // from registrations actually recorded
  registrations: {
    inWindow: number | null; rank: number | null; ranked: number | null; share: number | null;
    yoy: number | null; yoyCaveat: string | null; firstSeen: string | null;
    window: [string, string] | null; monthsMissing: string[];
    monthly: { month: string; count: number }[];
  } | null;
  gaps: GapCode[];
  conflicts: number;
  lastObserved: string | null;
  image: PublicImage | null;
}

export interface RegistryMeta {
  schema: string;
  registry_version: string;
  snapshot_id: string;
  generated_as_of: string;
  models_total: number;
  models_in_slice: number;
  source: { repo: string; branch: string; commit: string; root: string; path: string; sha256: string };
}

export interface BrandSummary { id: string; en: string; ar: string | null; count: number; registrations: number }
