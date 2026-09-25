# CarIndex — Buyer-decision vertical slice ("I have around EGP 2M. What should I buy?")

Sprint day 1 · 2026-09-25 · Status: **working slice, local only. Nothing deployed.**

Run locally: `python3 -m http.server -d buyer-decision 8000` → open `http://localhost:8000/app/index.html` (`?debug=1` shows live events).
Test: `node tests/e2e.mjs` (needs Playwright). It covers 3 journeys at 1440px and 390px, event order, no console errors, no horizontal scroll, and shared-link reproducibility.

## 1. Frozen vehicle universe: `U1-2026-09-25`

A **view** over the canonical files. It is not a new dataset. `data/build_universe.py` regenerates `data/universe.v1.json` deterministically, and the same input gives the same output (hash of normalized input text in `meta`).

| Rule | Value |
|---|---|
| Inputs | `carindex_master.csv` (1,444 rows) + `vehicle_candidates.csv` (528 rows), Sep 10 2026 snapshot. Row counts are asserted against the Source Registry. |
| Grain | Model (`brand_normalized` + `model_normalized`). Trims are attached as evidence only. |
| Cohort | Latest model year per model only (Living Data Architecture §6.3). This drops stale listings, e.g. the 2023 Porsche Macan at EGP 2.39M and the 2022 Honda Accord. |
| Price band | At least one official-priced trim between EGP 1.6M and 2.4M (anchor 2M ±20%). |
| Evidence floor | Official price from **≥2 source families** |
| Body | Passenger only: SUV, Sedan, Hatchback, MPV |
| Trim verification | "Verified" = ≥2 source families list the same price (±0.5%), whatever the trim label |
| **Result** | **26 models in scope.** Excluded: 372 with no trim in the band, 89 with a single source, 51 with no numeric price, 1 non-passenger. |

Universe coverage (26 models, computed from `universe.v1.json`): transmission 25, engine size 22, powertrain 20, dealer market price 17, warranty 16, **seats 12**, horsepower 10, **fuel consumption 3**.

## 2. Recommendation inputs (engine `E1-2026-09-25`, `app/engine.js`)

Only fields that exist in the data are used. Nothing is imputed, and no commercial inputs are read.

| Input | Type | Data field |
|---|---|---|
| Budget + optional 10% stretch | hard filter | trim `official_price` |
| 7 seats needed | hard filter (seats must be **stated**; unknown is excluded and counted) | `seats` |
| Powertrain preference / no home charging | hard filter | `fuel_type_raw`, `powertrain_raw`, trim label |
| Body style | hard filter | `body_type_normalized` |
| Budget use / money left over | score | trim prices |
| Price evidence | score | source-family count, verified trim, official source, open conflicts |
| Space | score | body type + stated seats |
| Usage fit (city/mixed/long) | score | powertrain group |
| Warranty | score | `warranty` (years parsed) |
| Dealer mark-up | score | `market_price` vs `official_price` (ContactCars) |

Priorities (the user picks up to 2) add weight to one component each. Output: 1 Hero, then 2–3 alternatives, each with a distinct role (costs less / different powertrain / more space / best-confirmed / runner-up). When fewer than 2 alternatives match, it adds "just over budget" models, capped at +15%.

## 3. Journey

`Entry (budget + price-strip of all 26 models)` → `Who rides` → `Where you drive` → `Charging`* → `Powertrain`* → `Body`* → `Priorities (max 2)` → **Result**: Hero (why it fits / worth knowing) · Alternatives ("choose this instead if…", "Make this my pick") · Comparison table · "What we can't tell you yet" · editable answer chips · Feedback → **Next step**: evidence sheet (trims, prices, agreeing sources, conflicts, gaps, source URLs) / share shortlist link.

\* Filter questions skip themselves when no answer could change the result (e.g. charging when no EV fits). Each option card shows a live count of matching cars, and 0-match options are disabled. When nothing matches, a relax screen shows options with their counts.

## 4. Event schema `EV1` (`app/track.js`)

Every event carries this envelope: `event, schema, event_id, ts, session_id, anon_id, flow_version, engine_version, universe_version, lang, viewport, page, referrer, utm_*`, plus `props`.

| Event | Required props |
|---|---|
| `fmc_view` | `entry` (direct / shared_link / restart) |
| `fmc_start` | `budget`, `stretch` |
| `q_view` / `q_answer` | `q_id`, `step` / + `value`, `ms_on_step`, `eligible_after` |
| `q_skipped` / `q_back` | `q_id`, `reason` / `q_id`, `step` |
| `result_view` | `hero_id`, `alt_ids`, `alt_roles`, `eligible`, `ms_to_result`, `answers`, `source`, `pinned` |
| `no_match_view` / `relax_apply` | `answers`, `relax_keys` / `key` |
| `alt_promote` | `from_id`, `to_id`, `role` |
| `evidence_open` · `compare_view` · `cta_click` | `model_id`, `source` · `model_ids` · `cta` (evidence / compare / share), `model_id` |
| `edit_answer` · `restart` | `q_id` · `from` |
| `feedback_view` / `feedback_answer` / `feedback_text` | `hero_id` / `helped` (yes/somewhat/no) / `helped`, `text_length`, `text` |
| `exit` (pagehide) | `last_event`, `reached_result` |

Transport: `window.dataLayer` (GTM-ready), plus a `sendBeacon` to `<meta name="ci-track-endpoint">`. **The endpoint is empty, so events stay in a local QA buffer and nothing leaves the browser.**

KPI definitions (computable from EV1): start rate = `fmc_start/fmc_view` · completion = `result_view/fmc_start` · step drop-off = `q_view−q_answer` per `q_id` · median `ms_to_result` · **decision progress = `feedback_answer.helped=yes` / `feedback_answer`** · feedback response = `feedback_answer/result_view` · next-step rate = sessions with `cta_click` or `evidence_open` / `result_view` · hero rejection = `alt_promote/result_view` · no-match rate.

## 5. P2 dependencies

"P2" is not defined in the Source Registry, Drive or Notion. This slice consumes the canonical Sep 10 files through one adapter. To switch to P2, replace the adapter's inputs; the view shape stays the same.

| Needed from P2 | Why | Today |
|---|---|---|
| `model_id` registry (CONFIRMED) | Public URLs, joins, analytics keys | Provisional slugs (`toyota-corolla`) |
| Normalized facts: seats, powertrain, fuel use | Family / 7-seat and usage questions | Seats known for 12/26 models, fuel use for 3/26 |
| Resolved `SOURCE_CONFLICT`s | Fewer "sources disagree" caveats | 13 of 26 models carry ≥1 open conflict |
| Registration crosswalk (model grain) | "How many Egyptians bought it" evidence | Not built |
| Second snapshot / refresh cadence | Price freshness claim | Single 10 Sep snapshot |
| Official (T1) sources beyond Toyota | Fair evidence scoring | Toyota is the only T1 source (0.3% of rows) |

## 6. Provenance

| Output | Produced by |
|---|---|
| Source facts | `CarIndex_Source_Registry_2026-09-25.md` (Drive), `LIVING_DATA_ARCHITECTURE.md` (Drive) |
| Input CSVs | Google Drive connector (`read_file_content`). Composio Drive accounts returned 403 on these files. |
| Universe | `data/build_universe.py` (deterministic) |
| Visual system | Tokens copied from design candidate #3 `ui-ux-pro-max` (FROZEN 2026-09-24). Patterns from Sep 10 homepage + R3. No new system. |
| Ranking, copy, flow | LLM judgment, encoded as deterministic rules in `engine.js` |
