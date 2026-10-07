/* Public (customer-facing) vehicle shape. This is the only vehicle shape that reaches the browser.
   Internal fields (universe flags, raw source rows, QA machinery) never leave the server. */

export type Body = 'suv' | 'sedan' | 'hatch' | 'mpv';
export type Powertrain = 'petrol' | 'hybrid' | 'ev';
export type PriceState = 'official' | 'listing';

/* Internal asset flags (P2 enrichment handoff). Rendered only as data-* attributes, never as UI copy. */
export type AssetFlag = 'TEMP_UNVERIFIED' | 'PHOTO_NEEDS_ENRICHMENT' | 'EXACT_CAR_UNCONFIRMED' | 'WATERMARK_CROPPED';

export interface PublicTrim {
  label: string;
  price: number;
  year: number;
  state: PriceState;
  date: string; // ISO date the price was recorded
  powertrain: Powertrain | null;
}

export interface PublicImage {
  src: string;
  credit: string | null;
  sourcePage: string | null;
  flags: AssetFlag[];
}

export interface PublicCar {
  id: string; // stable: "<brand-slug>/<model-slug>"
  brandId: string;
  brand: { en: string; ar: string | null };
  model: { en: string; ar: string | null };
  body: Body;
  segment: string | null;
  origin: string | null;
  chineseBrand: boolean;
  powertrains: Powertrain[];
  modelYear: number | null;
  hp: number[] | null;
  seats: number[] | null;
  awdConfirmed: boolean; // true only when the registry confirms AWD/4WD; false means "not confirmed", not "2WD"
  warranty: { text: string | null; years: number | null; verified: boolean } | null;
  distributor: string | null;
  price: { min: number; max: number; state: PriceState | 'mixed'; asOf: string; trims: PublicTrim[] } | null;
  registrations: {
    last12: number;
    since2021: number;
    trend: 'gaining' | 'steady' | 'declining' | 'new' | null;
    firstMonth: string | null;
    rankInBody: number | null;
    ofBody: number | null;
    yearly: Record<string, number>;
  } | null;
  image: PublicImage | null;
}

export interface RegistryMeta {
  registry_version: string;
  snapshot_id: string;
  built: string;
  last12_window: [string, string];
  models_in_universe: number;
  source: { repo: string; commit: string; path: string; sha256: string };
}

export interface BrandSummary {
  id: string;
  en: string;
  ar: string | null;
  count: number;
  registrationsLast12: number;
}
