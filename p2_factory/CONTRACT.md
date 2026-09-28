# P2 staging / provenance contract v0.1

2026-09-28. Status: **non-production**. It implements L0/L1 plus the review gates of
`LIVING_DATA_ARCHITECTURE.md` (Drive: `02 Automotive Data & Market Intelligence/Claude outputs/vehicle-data/`).
Storage is SQLite (`schema.sql`) with CSV exports. PostgreSQL is not required at this scale (see §9).

## 1. Principle

An observation is **what one source said, when, where**. It is never canonical truth. Finding
a value changes nothing downstream. Only a governed promotion (§6) can change what P1 or the
website shows, and none has happened.

## 2. Observation record (table `observations`)

| Requirement | Column(s) |
|---|---|
| Vehicle/model identity | `brand_raw`, `model_raw`, `model_id` (PROVISIONAL; see §3), `identity_confidence` |
| Trim | `trim_raw`, `trim_key` (deterministic normalisation, `factory.trim_key`) |
| Field | `field`, from a controlled vocabulary: `price_official_egp`, `price_market_egp`, `power_hp`, `torque_nm`, `engine_cc`, `seats`, `length_mm`, `wheelbase_mm`, `fuel_tank_l`, `boot_l`, `ground_clearance_mm`, `fuel_type`, `drive`, `transmission`, `trim`, `model_year` |
| Observed value | `value_raw` (verbatim), `value_num`, `unit`, `value_status` (`OK`/`NOT_PUBLISHED`/`COMING_SOON`/`RANGE`/`PARSE_FAILED`, never coerced to 0) |
| Source, type, tier, market scope | `source_id` → `sources` (name, family, tier, market_scope, access notes); denormalised `source_tier`, `market_scope` |
| Retrieval timestamp | `observed_at`; the evidence row keeps the exact `retrieved_at` |
| Source-stated date | `effective_date` (e.g. Nissan `Updated_On`). Never back-filled from `observed_at` |
| Model year | `model_year` only when the source states it; otherwise NULL |
| Confidence | `confidence` (HIGH/MEDIUM/LOW) |
| Verification state | `verification_state`: `observed` → `validated` → `corroborated` / `t1_verified`, or `rejected` |
| Conflict state | `conflict_state`: `none`/`open`/`resolved`, linked to `conflicts` |
| Original evidence | `evidence_id` → `evidence` (URL or Drive path, sha256, bytes, retrieved_at), plus `evidence_pointer` (JSON path, PDF rule, CSV row) |
| Canonical promotion state | `promotion_state`: `not_candidate`/`candidate`/`blocked`/`promoted`; proposals live in `promotion_candidates` |
| Method | `extraction_method` (recipe@version), `extraction_kind` (`deterministic`/`ai_assisted`/`manual`/`legacy_unknown`) |

Observation IDs are hashes of (evidence, pointer, field, trim, value), so a re-run never
duplicates. Proven 2026-09-28: two runs from the same evidence gave byte-identical exports.

## 3. Identity

P1's Find My Car universe (`data/view.js`, version `U11-2026-09-26`) already uses stable slugs
such as `nissan/sunny`. P2 had no IDs at all. Rather than invent a competing scheme, staging
uses the **P1 slug as a PROVISIONAL `model_id`**. `resolve_model()` is a deterministic lookup
(exact slug, then hyphen-folded). Anything that does not resolve becomes `IDENTITY_UNKNOWN` or
`MISSING_MODEL` in `exceptions` and yields no promotable facts. The final ID format is still
LIVING_DATA decision D3.

## 4. Source authority

| Tier | Meaning | Examples in `sources.csv` |
|---|---|---|
| 1 | Official Egypt OEM/distributor: site, price list, brochure, official communication | `nissan_eg_web`, `nissan_eg_brochure`, `official_toyota_eg`; Drive copies of official PDFs inherit the issuer's tier |
| 2 | Official regional/global OEM, only when Egypt data is absent; `market_scope` kept as `regional`/`global` | none used in B001 |
| 3 | Reputable automotive publications/data | `news_rss` (claims only, §7) |
| 4 | Aggregators, classifieds, community | ContactCars, Hatla2ee, EgyCar, YallaMotor (all variants) |

**Contradiction flagged.** LIVING_DATA §4.3 (proposal D5, undecided) ranks established
aggregators as T2. This contract follows the CEO assignment hierarchy and ranks them **T4**.
P2/CEO should confirm one table.

Global specs are never recorded as Egypt specs: `market_scope` is carried on every row, and a
scope mismatch is a `MARKET_SCOPE` conflict.

## 5. Validation and verification

- `validated`: deterministic recipe; value parsed and within type; identity resolved.
- `corroborated`: a non-T1 observation equal to a T1 value. It is never counted as verified.
- `t1_verified`: Tier 1, deterministic, identity HIGH/MEDIUM, **no open conflict**. An open
  conflict (value, model year, trim) demotes the observation back to `validated` and blocks promotion.
- Legacy 2026-09-10 snapshot rows are `legacy_unknown` / `observed`. Their collection method is
  undocumented, so they are never verified.

## 6. Promotion (proposal only)

`promotion_candidates.change_type`:

| Type | When | Gate |
|---|---|---|
| `CONFIRM` | T1 equals the current consumer value | Auto-eligible under this contract, but **not executed**. Canonical promotion needs the P2 owner to adopt this rule |
| `CORRECT` | T1 differs from the consumer value | P2 owner review |
| `ADD` | T1 has a trim or field the consumer set lacks | P2 owner review. Seats/body/powertrain are Find My Car hard constraints and always need review |
| `FLAG_STALE` | Consumer trim is absent from the official site | P2 owner review; may be stale, dealer-only, renamed or a duplicate label |

Nothing is ever `promoted` by this factory.

## 7. News is not truth

An n8n RSS article can only create an observation with `source_id=news_rss` (T3) and a *claim*
field: `price_change_claim`, `launch_claim`, `specification_claim` or `market_event`. It keeps
`extraction_kind=ai_assisted` (Identify Vehicle output) and `verification_state=observed`. The
flow is: claim → P2 recipe re-reads the T1 source → a T1 observation either confirms (candidate)
or refutes (conflict) → governed promotion. A claim never writes a price or spec field directly.
The existing content pipeline has no vehicle-data write path today (verified in the exported
workflow JSON: 13 Google Sheets nodes, none referencing vehicle datasets).

## 8. P1 data path

**Today (verified):** a 2026-09-10 aggregator scrape plus official price lists, P1-side edits and
registration joins → a P1 build step (not in any repo CarIndex holds locally) → `data/view.js`
(`window.CI_UNIVERSE`, `meta.version`) → `engine.js` (`ENGINE_VERSION`).
- Trims carry `official` + `date` but **no source URL**, so row-level provenance is 0%.
- 31 of 870 trims are official (SEAT/CUPRA price lists 22-08-2026, Mercedes 13-01-2026,
  Toyota site); 83 trims dated 2026-09-25 come from an undocumented refresh.

**Target:** promoted canonical facts → a versioned export (`model_id`, trim_key, value,
source_id, evidence_id, `dataset_version`) → the P1 build → `CI_UNIVERSE.meta` carries both
`universe_version` and `p2_dataset_version`. Each EV3 `result_view` already records
`universe_version` + `engine_version`, so a recommendation becomes traceable to the P2 dataset
version with no ranking change.

## 9. Storage decision

SQLite + CSV now. PostgreSQL waits until one of these is true:

- ingestion is concurrent from more than one writer;
- A1 S1 PostgreSQL exists anyway;
- a live API is needed.

Evidence for waiting:
- the whole vehicle layer is about 4k observations (2.4 MB SQLite);
- there is one writer (a batch script);
- the OCI VM has 1 OCPU / 6 GB and its disk was 88% full (77% after cleanup), and A1 D1 is still blocked on capacity;
- backup is a file copy plus git.

Migration is mechanical: `schema.sql` is ANSI-ish (only `json_each` is SQLite-specific, and
`jsonb` replaces it), and P2 tables should live in A1's PostgreSQL as schema `p2_staging`,
not in a second server.
