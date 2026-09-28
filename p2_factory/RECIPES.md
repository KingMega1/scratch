# Extraction recipes and automation candidates

## R1 `nissan_eg_vlp_json@1`: official prices (deterministic, Tier 1)

- **Source:** `https://en.nissan.com.eg/vehicles/new/<page>.html`. robots.txt allows these paths.
- **Payload:** the element `id="individualVehiclePriceJSON"` holds
  `{<modelKey>: {<channel>: {grades: {<gradeKey>: {gradePrice}}}, Updated_On}}`.
  - `Updated_On` is the source-stated price date.
  - A `modelKey` such as `2026-magnite` carries the model year.
- **Grade names come from three page variants on the same site:**
  - (A) `data-grade-data="Name=KEY, …"` (Magnite, Qashqai, X-Trail, Patrol; Juke is partial)
  - (B) grade cards in page order labelled `<MODEL> <grade>` before "Starting from" (Sunny)
  - (C) no name anywhere. The observation is kept as `UNNAMED:<key>` and sent to an AI/human exception (Juke LVL002/003).
- **Empty `gradePrice`:** recorded as `NOT_PUBLISHED`, never as 0.
- **Likely reusable** on other brands running the same Nissan Europe AEM stack (URL/HTML pattern `nissan-cdn.net`). This is untested.

## R2 `nissan_eg_spec_table@1`: official spec table (deterministic)

- `/vehicles/new/<page>/specifications.html`, parsed as `|label|value|` pairs from a fixed label list.
- The table shows **one grade**, so results are grade-scoped. Seats and other Find My Car hard constraints always go to review.
- Sunny, Sentra and Qashqai return 404: the brochure is the only official spec source for them.

## R3 `nissan_eg_brochure_regex@1`: official brochure PDFs (deterministic, fragile)

- Uses pypdf text extraction plus one regex per field, listed in `factory.BROCHURE_RULES`.
- Works: Sunny, Patrol, X-Trail (including a 5 vs 7 seat split by version); Sentra positional (confidence MEDIUM).
- Fails: Magnite and Qashqai, whose values are not in the text layer. These go to AI-assisted or manual reading.

## Manual → recipe conversions made in this batch

| Problem solved by hand | Now deterministic as |
|---|---|
| Transmission distinguishes Sunny Base MT from Base AT | `trans_of()` plus a compatibility match |
| Engine-size tokens polluted trim identity (`3.8L V6 SE T2`) | `trim_key()` strips `\d.\d[LT]`, maps `T1/T2/LE1` → `1/2` |
| Nissan price-JSON key differs from the page slug (`new-patrol`, `x-trail-epower`) | `MODEL_SYNONYMS` |

## n8n assessment

The live n8n API returned 401 with the stored key, so this assessment is based on the local exports.

**n8n NOW** (deterministic, mature):
1. Scheduled weekly fetch of registered T1 pages (R1). Hash the payload; skip unchanged; otherwise append evidence and observations to staging.
2. Source-health check: HTTP status, robots.txt diff, payload element present, then `SOURCE_HEALTH` events.
3. Diff an `Updated_On` / price change against the last observation, then create a `PRICE_CHANGE` candidate.
4. Readiness recalculation (`factory.readiness`) after each run.
5. Notion return: one Checkpoint row per run, with the summary JSON.

**n8n NEXT** (needs one more proof):
1. Drive "Automotive Updates" watcher: new PDF → evidence row plus a brochure-recipe attempt.
2. Registration monthly append → new `Consolidated` labels → `MISSING_MODEL` / `REGISTRATION_FIRST_SEEN`.
3. News `price_change_claim` from the content pipeline → queue a T1 recheck of that model. Read-only hook; no write into vehicle data.
4. Duplicate detection across sources by (`model_id`, `trim_key`, field, value).

**Keep with AI** (exceptions only):
- trim-label reconciliation (renamed or unnamed grades)
- columnar/image brochure reads
- model-year convention judgement
- importer attribution
- Arabic-only sources

AI output only ever enters `exceptions`/`conflicts` as a labelled suggestion.
