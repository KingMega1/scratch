# CarIndex Vehicle Intelligence — Data Contract v1 (draft)

> **Superseded entity level (2026-09-24):** records move from trim level to MODEL level (`model_id` from `vehicle_identity/`). See `vehicle_identity/README.md` §12. The trim-keyed examples below remain as v1 test evidence.

The layer between the normalized vehicle database and future Car Detail, Compare and Find My Car.
Design + contract + 5 test records only. No scoring engine, no full enrichment, nothing in n8n/social/website/production data changed.

```
contract/field_registry.json          every attribute, its layer, level, inputs, current coverage, availability
contract/vehicle_intelligence.schema.json   JSON Schema for one record (5 layers)
contract/i18n_labels.json             AR/EN rendering of keys (presentation only)
tools/build_examples.py               CSV rows -> 5-layer records, deterministic rules
tools/validate.py                     contract checks + AR/EN rendering
tools/test_contract.py                12 violation cases, all must be caught
examples/*.json                       5 test vehicles
reports/computability.json            coverage measured over the whole snapshot
```
`_src/` (local copies of the Drive CSVs) is git-ignored: this repo is public and the dataset is CarIndex's core asset.

---

## 1. Current-data audit
Source: Drive `Automotive Market Vehicles Prices Scrapped/` (files dated 2026-09-17), plus `CarIndex_Source_of_Truth_Reconciliation_Report_2026-09-22.md` and `PRD.md`.

| File | Rows | Role |
|---|---|---|
| `source_records.csv` | 1,444 | raw scrape rows |
| `carindex_master.csv` | 1,444 | same rows + normalized brand/model/body (row-parallel, not deduplicated) |
| `vehicle_candidates.csv` | 528 | one row per vehicle cohort/trim group, cross-source status |

Measured findings:
1. **One snapshot.** `collection_date` = 2026-09-10 on every row; `price_date` filled on 7%. No price history → no trends.
2. **Prices are the only dense layer.** official_price 93% (numeric); market_price 41% filled but includes placeholder text ("Data Not Available", "Unavailable"). `starting_price`, `discounted_price`, `engine_raw` are 0%.
3. **Specs are thin.** transmission 64%, fuel type 50%, engine cc 44%, warranty 34% (free text, 6+ formats), power 7%, seats 8%, torque 4% (formats "154/5200", "265/1500-4500"), dimensions/trunk 3%, consumption 2%, EV range 1%.
4. **Recommendation evidence is absent.** No column for reliability, safety rating, resale, running cost, service network, origin/assembly, equipment. Some of it sits in free-text `notes` ("Assembled China", "5-star C-NCAP", "6 airbags").
5. **No stable IDs.** Nothing links a master row to a candidate row. Brand+model+year links 464/528 candidates; exact trim only 169/528. Trim spellings differ per source ("Smart + Sunroof" / "SMART / Sun Roof" / "Smart with Sunroof"); 1,379 raw brand/model/year/trim keys vs 528 candidates.
6. **Normalization incomplete.** Brand spellings: JAC/Jac, Xpeng/XPENG; candidates use "Baic". Model case: "Tiggo 7 Pro" vs "Tiggo 7 pro". 77 rows body = NOT_AVAILABLE; 20 raw body spellings.
7. **Candidate layer is not reproducible from master.** 34 candidates (6%) carry prices that appear nowhere in master for that model, mostly Chery (e.g. Tiggo 7 Pro candidate 1,150,000–1,250,000 vs master 1,075,000–1,175,000). 5 duplicate candidate keys. Status field is free text with ~80 distinct values mixing several flags.
8. **Already stale.** Tiggo 7 Pro Comfort is 1,075,000 in the snapshot; distributor raised it to 1,080,000 on 2026-09-20 (press, found by web search).
9. **Suspect values exist.** MG 4 is body "SUV" in the ContactCars rows (widely sold as a hatchback) — kept as sourced, flagged for check; it changes its price peer group.
10. **Product side.** No recommendation code exists anywhere. Find My Car design (R3, 9 screens) asks budget, new/used, body, seats, city/highway, powertrain, origin, and up to 3 priorities (reliability, running cost, safety, comfort, performance, technology, design, resale). PRD removed "AI Recommendation" as a content pillar: a recommendation is an opinion; CarIndex is "numbers first, opinions last". Target principle in the reconciliation report: "AI for understanding. Software for reasoning. Data for truth."

## 2. Proposed data contract
One record per **variant** (trim). Identity has three levels; each fact is stored at the level where it is true (registry `level`):

| Level | ID | Example |
|---|---|---|
| model | `brand-model` | `chery-tiggo-7-pro` |
| cohort | model + CarIndex cohort label (generation / year group / CKD vs CBU) | `chery-tiggo-7-pro@2027-ckd` |
| variant | cohort + trim slug | `chery-tiggo-7-pro@2027-ckd/comfort` |

`model_year` is a fact, not part of the ID, so a year conflict (MG ZS 2026 vs 2027) doesn't split one car into two.

Five layers, each only built from the one below:

| Layer | Contract key | Content | Who writes it |
|---|---|---|---|
| RAW FACT | `observations[]` | exact string per source cell, source, date, `file:row:column` | scraper / researcher; immutable |
| NORMALIZED FACT | `facts{}` | typed value + unit + qualifiers, status, confidence, observation IDs, conflict candidates | deterministic parsers + resolution rules |
| DERIVED ATTRIBUTE | `derived{}` | versioned formula over facts, peer set, inputs, confidence | deterministic code |
| EDITORIAL INTERPRETATION | `editorial[]` | CarIndex judgment: topic, stance, claim key + params, cited evidence, author, approval, review date | CarIndex editor (LLM may draft, human approves) |
| RECOMMENDATION SIGNAL | `signals{}`, `buyer_fit[]` | per-dimension state + value + rule + inputs used/missing + coverage + confidence | approved, versioned rules |

Every registry fact appears in every record, with `status: unknown` and a reason when there is no evidence — so gaps are visible, never implied.

## 3. Intelligence field definitions
Scale for rated signals: ordinal 1–5 or a named band, or `null`. Signal `state`: `known` (value produced), `partial` (some inputs, no value), `unknown` (no required input).

| Dimension | What it means | Built from | Editorial role |
|---|---|---|---|
| price_position | Where the price sits among same-body cars on sale in Egypt. Says nothing about value for money. | official price, body type → percentile → quintile band; optional trim position, market premium | none |
| city_suitability | Ease of daily urban use: size, parking, gearbox | length class, transmission, turning circle, cameras/sensors | thresholds + final call |
| highway_suitability | Stability and effort at speed | power-to-weight, ADAS (adaptive cruise, lane keep), consumption | final call |
| family_practicality | Room for people and luggage | seats, trunk, third row, rear AC, wheelbase | none once thresholds approved |
| running_cost_profile | Money per km to own | fuel/energy cost per 100 km (consumption × official fuel/electricity price), service interval, warranty | none |
| energy_efficiency | Consumption on a stated test cycle | L/100 km or kWh/100 km with cycle | none (cycles never mixed) |
| reliability_evidence | What evidence exists about durability | recalls, owner surveys, brand years in Egypt, volume | required; absent evidence = unknown, never "unreliable" |
| resale_liquidity | How easily it sells used and how much it keeps | used price retention, used listing count, registration trend | none |
| safety_evidence | Independent crash-test and safety equipment evidence | NCAP program/stars/year/vehicle tested, airbags, AEB, blind spot | none; equipment alone never implies a rating |
| performance_character | How it drives in a straight line | power-to-weight, power, torque band, gearbox, drivetrain | wording of character |
| comfort | Ride, seats, noise, cabin | editorial + equipment (power seats), wheelbase | required |
| powertrain_suitability | Whether the powertrain fits a use pattern | fuel type, gearbox, EV range, battery; charging access comes from the buyer | required |
| ownership_considerations | Distributor, assembly, parts, brand presence | distributor, assembly country, service centres, brand years | required |
| service_warranty | Warranty and after-sales cover | warranty years/km, battery warranty, service network | none for warranty; network needs a source |
| strengths | Evidence-backed positives | approved editorial with stance `strength` citing facts/derived | required |
| compromises | Evidence-backed trade-offs | approved editorial with stance `compromise` | required |
| buyer_fit | Tags such as city_commuter, large_family, long_highway_commute, budget_under_1m | approved rules over signals | rule approval |

Facts and derived attributes: `contract/field_registry.json` (39 facts, 2 market reference facts, 15 derived formulas, each with unit, level, inputs and measured coverage).

## 4. Provenance model
- **Observation level (finest):** each raw value keeps `source_id`, `source_url`, `observed_at` (price_date, else collection_date), `record_ref` (`carindex_master.csv:442:official_price`), optional `verification` (e.g. `search_snippet`).
- **Source registry:** `type` and `tier` — A official/OEM/test body, B press reporting an official announcement, C aggregator new-car listing, D summary/classified/internal. `publisher` groups sub-feeds (ContactCars, ContactCars(Lineup), ContactCars(classified)) so one site never counts as two confirmations.
- **Fact:** `observation_ids` + `candidates` (every distinct value and who said it) + `resolution.rule`.
- **Derived:** `formula id@version`, input references, `peer_set` (id, size, definition, snapshot date).
- **Editorial:** `cites[]` (facts/derived/observations — at least one), author, drafted_by (human|llm), approved_by/at, review_due.
- **Signal:** rule id + status, `inputs_used`, `inputs_missing`, `evidence_coverage`.
- CarIndex's own `vehicle_candidates.csv` is recorded as a tier-D `carindex_internal` source — its values are evidence, not truth.

## 5. Confidence model
Deterministic, four levels: `high | medium | low | unknown`.

| Layer | Rule |
|---|---|
| Fact | **high**: a tier-A source, or ≥2 independent publishers (tier ≥ C) agree. **medium**: one tier B/C publisher. **low**: only tier D (summary/classified/internal), or parsed from free text. Caps: `search_snippet` ≤ medium. Time-sensitive facts (prices, 30 days) drop one level when older than the window. A value picked by a conflict rule drops one level. No value → unknown. |
| Derived | lowest confidence of its inputs; peer-based metrics also note the peer snapshot date. |
| Editorial | set by the approving editor, may not exceed the lowest-confidence cited fact; expires at `review_due`. |
| Signal | lowest of inputs used, capped at medium when only partial inputs exist; `evidence_coverage` (0–1) reported separately so "confident but thin" is visible. |

## 6. Conflict-handling model
Applied in order; every applied rule is written into `resolution.rule`; all original values stay in `candidates`.

| Rule | When | Result |
|---|---|---|
| R0 tolerance | prices within max(1,000 EGP, 0.1%) | same value (rounding), strongest/newest kept |
| R1 specificity | "automatic" vs one specific automatic type (CVT/DCT/DHT) | counted as support for the specific type |
| R2 time supersession | time-sensitive fact; newer observation from an equal-or-stronger tier (≥ B) | newer wins, older kept as history, confidence −1 |
| R3 tier precedence | same date, one side is tier A | tier A wins, confidence −1 |
| R4 unresolved | anything else | `status: conflict`, `value: null`, needs CarIndex check |

Never: averaging prices, picking the majority of weak sources, or letting a conflict leak into derived/signals (a derived value needs non-null inputs). Model-year disagreement becomes a `model_year` conflict inside one cohort. Editors can close a conflict manually: `resolution.decided_by` = editor name + note.

## 7. Example records (from existing data)
| Record | Why chosen | Obs | Facts known / 39 | What it shows |
|---|---|---|---|---|
| `toyota-corolla@2026/active` | best covered | 46 | 20 | 4 publishers agree on 1,280,000 (high); R1 merges "Automatic" into CVT; YallaMotor "Price Coming Soon" and hp "116-168 (range)" stay raw, not normalized; price band lower (33.0 pct of sedans); warranty middle; market premium 9.4% |
| `mg-zs@2026-27/comfort` | year conflict | 24 | 15 | `model_year` conflict 2026 vs 2027, price agreed; "5-star C-NCAP" note is on another trim → not transferred |
| `chery-tiggo-7-pro@2027-ckd/comfort` | stale + internal conflict | 11 | 6 | 1,075,000 (snapshot) superseded by 1,080,000 (press, 2026-09-20) via R2, confidence low; cohort price range conflict master vs candidate layer (R4, null); power/seats/specs unknown |
| `mg-4@2026/luxury` | BEV | 10 | 9 | battery 64 kWh, range 450 km (cycle unknown), energy consumption unknown → efficiency `partial` with no value, running cost `unknown`; body "SUV" from source, flagged |
| `baic-u5-plus@2026/manual` | sparse | 10 | 8 | price + "Assembled China" (free text → low); R0 treats 974,900 vs 975,000 as rounding |

Across all 5: `price_position` is the only signal with a value everywhere; `service_warranty` has a value for Corolla only; the rest stay `unknown`/`partial` with their missing inputs listed. No record has editorial entries — that layer needs a CarIndex editor. AR/EN output (from the same keys):
> EN: Price position: entry (6.4 percentile among SUVs)
> AR: موقع السعر: دخول (المئين 6.4 بين الـSUV)

Checks: `python3 tools/validate.py` → 5/5 OK; `python3 tools/test_contract.py` → 12/12 violations caught.

## 8. Computable from existing data now
Measured over 1,379 raw brand/model/year/trim keys (`reports/computability.json`):
| Attribute | Coverage |
|---|---|
| price_percentile / price_band → price_position | 87% |
| trim_position_in_model | where one source lists all trims of a cohort |
| market_premium_pct (same source, same date) | 33% |
| warranty years/km → service_warranty (warranty part) | 35% |
| fuel type + transmission (powertrain facts, not suitability) | 37% |
| price_source_agreement | all priced variants |
| length_class / footprint / third_row | 3% / 3% / 8% (only where specs exist) |

## 9. Needs additional sources / research
- Per-trim spec sheets (power, torque, weight, dimensions, seats, trunk, turning circle, ground clearance, consumption with test cycle, battery, energy consumption): distributor brochures/official sites.
- Equipment by trim (airbags, cameras, sensors, ADAS): brochures; structured extraction of existing `notes` with human spot-check.
- Safety ratings: Euro NCAP / ANCAP / C-NCAP / Latin NCAP records, matched to the exact vehicle tested.
- Official fuel prices and electricity tariffs (dated) for running cost.
- Registration/licensing volumes (AMIC/Al-Ahram monthly data CarIndex already uses in content).
- Used-market listings and prices (Hatla2ee/ContactCars used sections) over time for resale/liquidity.
- Recalls, service network size, service intervals, parts availability, brand years in Egypt, distributor, assembly country.
- Repeated dated price snapshots (≥ monthly) for price trend.

## 10. Needs CarIndex editorial judgment
- Thresholds that turn facts into bands: what length/turning circle is "city-friendly", what seats+trunk is "family-ready", power-to-weight bands.
- Reliability narrative and how much weight recall/brand-history evidence gets.
- Comfort, performance character, powertrain fit per use case, ownership considerations.
- Strengths and compromises (each must cite evidence).
- Buyer-fit tag definitions and rule approval; which peer groups are fair comparisons (body type vs size class vs price band).
- Manual resolution of R4 conflicts and of suspect values (e.g. MG 4 body type).

## 11. Gaps / blockers
1. No stable vehicle ID and no row-level link master ↔ candidates; trim identity must be resolved (alias table) before scale-up.
2. Candidate layer disagrees with master on 34 vehicles; it cannot be treated as derived from master until regenerated.
3. One snapshot only; prices already stale for at least one car.
4. Brand/model/body normalization incomplete (case variants, NOT_AVAILABLE, suspect body types) — this directly distorts price peer groups.
5. Recommendation evidence (reliability, safety, resale, running cost, comfort) has 0% coverage.
6. No editor role or approval workflow exists yet for the editorial layer.
7. Only `price_position` has a proposed rule; all signal rules are `proposed`, none approved — a scorer must ignore them until approved.
8. Repo `KingMega1/scratch` is public; raw data was deliberately not committed.

## 12. Recommended next step
Build the vehicle identity table: assign stable `model_id / cohort_id / variant_id` to all 528 candidates and map every master row's raw trim spelling to one variant (alias table), re-deriving candidate prices from master so the two layers agree.
