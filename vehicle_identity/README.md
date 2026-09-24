# CarIndex Vehicle Identity Layer v1 — BRAND → MODEL

Permanent granularity rule: the canonical product entity is the **model** (Toyota → Corolla). Trims are supporting observations under a model. A separate cohort exists only as a documented human decision when treating two vehicles as one product would mislead (different generation or architecture).

Inputs are read-only copies of the Drive files (`carindex_master.csv`, `vehicle_candidates.csv`, snapshot 2026-09-17, collected 2026-09-10). No production data was changed. No specs enriched, no scores, no editorial.

```
identity/schema.json            identity schema (brand, model, cohort exception, model view)
identity/brand_registry.json    93 brands, stable IDs          identity/model_registry.json  520 models, stable IDs
identity/decisions.json         human decisions (display names, aliases, cohort exceptions) — all current entries "proposed"
mappings/alias_table.csv        638 raw spelling -> canonical ID
mappings/master_row_map.csv     1,444 master rows -> model_id
mappings/candidate_map.csv      528 candidates -> model_id(s)
mappings/review_queue.csv       123 open items, 9 blocking
reports/integrity_metrics.json  before/after    reports/investigations.json  the 6 investigations
samples/*.json                  model view for Corolla, MG ZS, Tiggo 7 Pro, MG 4, BAIC U5 Plus
out/                            full model view with prices (git-ignored: public repo)
tools/build_identity.py         builder        tools/test_identity.py  28 tests
../vehicle_common/parse.py      shared parsers (also used by vehicle_intelligence)
```
Run: `python3 tools/build_identity.py && python3 tools/test_identity.py` (needs the CSVs in `../vehicle_intelligence/_src/`).

## 1. Canonical model identity schema
`identity/schema.json`. Three objects:
- **brand**: `brand_id`, display, match keys, observed spellings, status, `merged_into`.
- **model**: `model_id`, `brand_id`, display, match keys, spellings, origin, status, `merged_into`, optional `cohorts[]` (exceptions only).
- **model view** (derived, rebuilt each run): price range, powertrains, transmissions, engine, power, seats, body type, variants, conflicts, source coverage, identity/price confidence, freshness.

Trims are not entities. They are observations inside the model view, grouped by a `trim_key` that is only meaningful within one model.

## 2. ID convention
- `brand_id` = slug of the brand display name: `toyota`, `land-rover`, `dongfeng-aeolus`.
- `model_id` = `brand_id/model_slug`: `toyota/corolla`, `chery/tiggo-7-pro`, `volvo/xc60`, `mg/4`, `peugeot/2008`.
- Cohort exception (none approved yet) = `model_id~cohort_slug`, e.g. `hyundai/elantra~cn7`.
- Assigned once at first registration and stored in the registry; never regenerated. A display rename keeps the ID (tested). Merges set `merged_into`; the old ID keeps resolving. Collisions get `-2`.
- IDs never contain model year, price, trim or source. The only digits allowed are the model's own name (`peugeot/2008`, `mg/4`); tested.
- **Not frozen yet.** 20 display decisions in `decisions.json` are `proposed` (e.g. XC60 not "XC 60", CR-V not "CRV", JAC not "Jac"), each chosen from spellings actually observed. Once you confirm them, the IDs are fixed.

## 3. Alias / mapping table
`mappings/alias_table.csv` — every raw brand and model spelling → canonical ID, with its match key, count, origin and method. Matching methods allowed for identity:
1. `exact_normalized`: equal after removing accents, case, spaces and punctuation ("CR-V" = "CRV", "XC 60" = "XC60", "Grand Cherokee (L)" = "Grand Cherokee L").
2. `alias_table` / `model_aliases`: a recorded human decision.
3. `slash_alias_same_model`: a candidate name like "XC60 / XC 60" where every part resolves to the same model.

Similarity scores only appear as suggestions in the review queue; they never map anything (tested).

## 4. Master row → model_id
`mappings/master_row_map.csv` — **1,444 / 1,444 rows mapped**, all by `exact_normalized`. Each row keeps: stable fingerprint (source, URL, brand, model, trim, year; line numbers change between exports), master line, source, raw brand, model, trim and model year, `brand_id`, `model_id`, `trim_key`, and whether it is a summary row. Rows with no trim still map.

## 5. Candidate → model_id
`mappings/candidate_map.csv` — **520 / 528 mapped to exactly one model**, 8 unresolved and blocked. The 8 are candidate rows that bundle several models in one line: BMW "~30 model lines", Land Rover (5 names), VW ID family (5), Dongfeng (3), Baic "X35 / X3", GAC "Aion LX / Aion Y", GAC "GS3 Emzoom / EMZOOM", Subaru "XV Crosstrek / Crosstrek". They are listed with the models they touch; none is split or merged automatically.

## 6. Ambiguous / unresolved queue
`mappings/review_queue.csv` — 123 open items, 9 block a decision:

| Kind | # | What a human decides |
|---|---|---|
| candidate_unmapped (blocking) | 8 | split per model or map |
| brand_sub_brand_overlap (blocking) | 1 | Dongfeng vs Dongfeng Aeolus: "HUGE-Hybrid" exists under both → one model or two |
| candidate_price_not_in_master | 32 | regenerate candidate prices from master or record their source/date |
| cohort_exception_candidate | 19 | 14 models whose trims differ in powertrain (e.g. Corolla petrol + hybrid, BYD Sealion 6 BEV + PHEV, Forthing T5 petrol/BEV/PHEV) + 5 candidate notes describing a second cohort (Tiggo 7 Pro 2026 cohort, Tucson, Sportage, MG ZS, Kodiaq) |
| model_spelling_normalized | 18 | confirm display name |
| trim_price_conflict | 16 | which source is current |
| same_model_or_separate: generation/assembly suffix | 8 | Elantra vs Elantra AD vs Elantra CN7, Tucson vs Tucson NX4e, Octavia vs Octavia A8, Jolion vs Jolion CKD, C4 vs C4 Facelift, X70 vs X70 facelift, iX3 vs iX3 Neue Klasse |
| same_model_or_separate: powertrain suffix | 8 | H6 vs H6 HEV, EX5 vs EX5 EM-i, Song L vs Song L DM-i, Q8 vs Q8 e-tron, Macan vs Macan Electric, Captiva vs Captiva EV, Escalade vs Escalade IQ/IQL |
| duplicate_candidate | 5 | keep one row |
| body_type_check | 5 | legit body styles (Mazda 3 sedan/hatch, Mini Cooper hatch/convertible, BMW M850i coupe/convertible) or misclassification (Kia EV6 hatchback/SUV, Kia Carnival van/SUV) |
| brand_spelling_normalized | 2 | JAC, XPENG |
| suspect_value | 1 | MG 4 body type |

Default while open: kept as **separate** models. Splitting is non-destructive; a wrong merge is not, so merges wait for a decision.

## 7. Model-level aggregated view
`out/models.json` (all 520, git-ignored) and `samples/` (5). Per model:

| Field | Rule |
|---|---|
| verified price range | min/max of trims whose official price is agreed by ≥2 independent publishers or comes from an official source (R0 rounding tolerance: max of 1,000 EGP or 0.1%) |
| corroborated range | trim min/max matched by an independent publisher's summary range |
| observed range | min/max of all official trim prices, also split by model year |
| powertrains / transmissions / engine / power / seats / body | `uniform` (one value across trims), `varies_by_variant` (values + trim counts), or `unknown`; "Automatic" + one specific type (CVT) counts as the specific type |
| variants | per trim: source labels, model years, every price with source/date/year, specs |
| conflicts | trim price conflict (same trim and year, different price); price differing by model year; model-year disagreement; body conflict within a trim |
| coverage | publishers, rows per source, candidate rows |
| confidence | identity: high ≥2 publishers, medium 1; price: high verified, medium corroborated, low single source, unknown |
| freshness | collection date, latest source price date, age |

Price range status across 520 models: 19 verified, 24 corroborated, 407 single-source, 70 no price. Example, Corolla: verified 1,280,000–1,630,000 (5 trims, official Toyota list); observed up to 2,000,000 (Hybrid, ContactCars only); powertrain `varies_by_variant` petrol 5 / hybrid 1; transmission CVT; classified listings kept separately.

## 8. Rules for trim/variant differences
1. A model record is valid with zero trims; missing trim data never blocks it.
2. Trim facts stay trim facts; the model shows `uniform` only when every trim that reports the fact agrees.
3. Differences are shown, never averaged or reduced to one value: `varies_by_variant` with each value and its trim count.
4. Prices: range from real observed prices only; verified, corroborated and single-source ranges kept apart; model years kept apart.
5. Summary rows (aggregator min–max) and classified listings are model-level observations, never trims.
6. Trim grouping (`trim_key`) is within one model only and never becomes an ID.
7. A trim difference becomes a cohort only by a recorded decision (`decisions.cohort_exceptions`), with the reason (different generation / architecture / body platform) and evidence.
8. Intelligence, comparison and Find My Car read the model view; trims are drill-down evidence.

## 9. Before / after integrity
| Metric | Before | After |
|---|---|---|
| Stable ID on any row | 0 | 1,444 rows + 528 candidates |
| Brand strings → canonical brands | 95 | 93 (JAC/Jac, XPENG/Xpeng) |
| Brand+model strings → canonical models | 553 | 520 |
| Master rows linked to a model | none linked | 1,444 / 1,444 |
| Candidates linked to master by brand+model+year strings | 464 / 528 | 520 / 528 to one model_id; 8 queued |
| Candidates linked by exact trim string | 167 | not required at model level |
| Model name "normalized" field actually normalized | 0 / 1,444 differ from raw | 18 spelling groups unified |
| Candidate prices absent from master | 34 | 32 (2 explained by normalization), all queued |
| Price conflicts | not separable | 16 real trim conflicts in 8 models; 51 trims differ by model year |
| Body "conflicts" | — | 0 within a trim; 5 models vary by trim (queued) |
| Duplicate candidate keys | 5 | 5, queued |
| IDs encoding year/price | n/a | 0 |

## 10. Validation tests
`tools/test_identity.py` — 28 pass:
- **IDs:** correct format, brand prefix, no year/price encoded, no silent merges.
- **Master rows:** every row mapped once, unique fingerprints, deterministic methods only, the alias table resolves every raw spelling, rows without a trim still map.
- **Candidates:** every row mapped or blocked in the queue; similarity never used for mapping.
- **Prices:** range endpoints are real observed prices (nothing averaged); every disagreeing trim is recorded as a conflict and never counted as verified.
- **Aggregation:** coverage, confidence and freshness present on every model; facts that differ by trim are kept visible.
- **Stability:** rebuild is byte-identical; IDs survive a display rename.
- **Samples:** all 5 exist.

The tests caught one real bug during the build: candidate and queue review IDs didn't match.

## 11. Migration plan
1. Confirm the 20 proposed display names → freeze IDs (registry becomes append-only in practice).
2. Work the 9 blocking review items, then the generation/powertrain pairs (16) and cohort candidates (19); record each in `decisions.json`.
3. Add `model_id` as a column alongside existing columns in master/candidates copies (no column removed); keep the raw fields.
4. Regenerate the candidate layer from master + decisions instead of hand-maintaining it (removes the 32 price mismatches at the root).
5. New scrapes: map every row through `alias_table` at ingest; unknown spellings go to the review queue, never auto-create a merge.
6. Rebuild the model view after every scrape; keep each snapshot to build price history.
7. Move Vehicle Intelligence records to model level (section 12).

## 12. Impact on Vehicle Intelligence Data Contract v1
- **Entity:** the record key becomes `model_id` (required). Trim ID becomes optional drill-down; cohort ID only for approved exceptions. The v1 examples (keyed by trim) are superseded and will be regenerated per model.
- **Facts:** each fact gets a model-level representation (`uniform` / `varies_by_variant` / `unknown`) on top of the trim observations. Prices become the verified / corroborated / observed ranges.
- **Derived and signals:** computed from the model view. Where a fact varies by trim, derived values are ranges (e.g. price band from the range) or per-powertrain, never averages.
- **Provenance:** observations gain `model_id` and a row fingerprint; the identity decision that linked them is traceable through `method` and `decisions.json`.
- **Coverage:** model-level price position becomes available for 450 of 520 models (any price), with confidence from `range_status`.

## 13. Recommended next step
Confirm the 20 proposed display names and decide the 9 blocking review items, so the model IDs can be frozen.
