# P2 Data Readiness Factory: Checkpoint 01, batch B001 (Nissan Egypt)

2026-09-28 · Cost $0 (local compute plus public official pages) · **Canonical data changed: NO**

## Objective

This advances P2's milestone "Egypt market reality audit and first P1 data contract" and the
2026-09-28 P2 audit's next step ("prioritize T1 official-source discovery"). The aim is to prove
a repeatable, evidence-backed enrichment loop that improves readiness without touching
canonical data.

## Expected result

For one high-value brand:
- Tier-1 observations with provenance
- a before/after readiness delta
- conflicts kept visible
- a reusable deterministic recipe
- no canonical mutation

## 1. Current data-flow map (verified 2026-09-28)

```
Aggregator sites (ContactCars, Hatla2ee, EgyCar, YallaMotor) + Toyota EG ─one-off 2026-09-10─► source_records.csv ─1:1─► carindex_master.csv (1,444 rows, no IDs)
Official price lists / brochures (Drive: 02…/Automotive Updates, 36 PDFs) ─manual─┐
                                                                                  ├─► [P1 build step: NOT in any repo held locally] ─► data/view.js
Registration Master.xlsx (Ahram, 591,177 rows, monthly manual) ─P1 join (method undocumented)─┘          CI_UNIVERSE U11-2026-09-26: 393 models (283 in-universe), 870 trims
                                                                                                          │   trims: label/min/year/official/date only — NO source URL
                                                                                                          ▼
                                                                                engine.js E6-2026-09-28 ─► live buyer site (GitHub Pages) ─► EV3 events (universe_version, engine_version)
RSS ─► n8n (3 workflows, 132+27+17 nodes) ─► Sheet1 + Notion content DB   (no read/write of any vehicle dataset; Identify Vehicle = free text)
NEW (this batch, non-production): official Nissan EG pages/brochures ─► p2_factory recipe ─► staging.sqlite (evidence → observations → conflicts → promotion_candidates)
```

**VERIFIED CURRENT:**
- the one-time 2026-09-10 snapshot (3 CSVs + Photos)
- the Registration Master
- the P1 universe U11 and engine E6 (public repo, fetched)
- the n8n exports (local, 2026-08-29)
- 36 brochures/price lists in Drive
- LIVING_DATA_ARCHITECTURE (design only)
- Source Registry (2026-09-25)

**DESIGNED/PROPOSED, not built before today:**
- LIVING_DATA L0–L6 layers, crosswalks, change events, review queue, P2 IDs

**MISSING:**
- a P2 database
- any canonical store distinct from P1's `view.js`
- the P1 build script (not held locally)
- vehicle-to-news linkage
- a second price snapshot
- PostgreSQL (none exists)

**BUILT TODAY (non-production):** `p2_factory/` staging contract, source registry, Nissan recipe,
reconciliation and readiness.

## 2. Actions taken

1. **Read the Control Tower.** Covered: Workstreams P2; Checkpoints for P2/P1/P5/I1; Dependencies P2↔P1/P4; CEO Decisions.
2. **Located and read the prior P2 work** instead of re-creating it: `LIVING_DATA_ARCHITECTURE.md`, `AUDIT_EVIDENCE_2026-09-24.md`, `CarIndex_Source_Registry_2026-09-25.md`.
3. **Fetched and profiled P1's live data** (`data/view.js`, `engine.js`) from the public repo.
4. **Built `p2_factory/`:**
   - `schema.sql` and `sources.csv` (15 sources)
   - `CONTRACT.md`
   - `factory.py`: loads 3,823 legacy observations (every attribute of all 1,444 snapshot rows), runs the Tier-1 recipe, reconciles, measures readiness
5. **Selected the batch: Nissan.**
   - It is the highest-volume brand (25,677 passenger registrations, Sep-25 to Aug-26).
   - 0 Tier-1 observations; 7 of its 9 legacy candidate rows carried conflict flags.
   - Its official site publishes a structured price JSON.
   - It is also I1's August distributor-gap brand.
6. **Search order followed:**
   - Drive first: the Magnite brochure in Drive is byte-identical (sha256 `e9b79987`) to the official one.
   - Then legacy CSVs.
   - Then `en.nissan.com.eg`: 7 model pages, 4 spec pages, 6 official brochures. 17 requests; robots.txt checked, paths allowed.
   - No Tier 2–4 web searches were needed.
7. **Ran the factory 4 times** while fixing matching rules, then twice more from the same evidence: the outputs were **byte-identical** (determinism proof).

## 3. Evidence

- **Repo** (local, Drive-synced, **uncommitted**): `CarIndex n8n Workflow/p2_factory/`
  - `schema.sql`, `sources.csv`, `CONTRACT.md`, `RECIPES.md`, `factory.py`
  - `runs/B001_nissan_eg_2026-09-28/`: `staging.sqlite`, `observations_batch.csv` (63), `observations_legacy_nissan.csv`, `evidence_batch.csv` (17 artifacts with sha256), `evidence_files_sha256.txt`, `conflicts.csv` (23), `promotion_candidates.csv` (43), `exceptions.csv` (11), `readiness.csv`, `run_summary.json`
- **Input hashes (sha256 prefix):**
  - `carindex_master.csv` `d498a63de00bfe02`
  - `reg_raw.csv` (I1 export of the Registration Master) `8d578a2055a5257e`
  - P1 `view.js` = `U11-2026-09-26`
- **Reproduce:** `python3 factory.py run --work <dir> --out <dir> --master carindex_master.csv --universe view.js --reg reg_raw.csv --pdf-python <python with pypdf> [--refetch]`

## 4. Baseline → Result

"Consumer" = P1 U11 in-universe set, i.e. what buyers see today. AFTER values are a staging
overlay: they show what is verified and ready to promote. **Canonical/consumer values did not
change.**

| KPI (definition in readiness.csv) | Global before | Global after | Nissan before | Nissan after |
|---|---|---|---|---|
| In-universe models with a price | 283/283 (100%) | same | 7/7 | same |
| Market coverage (registration units covered by in-universe models) | 94.3% of 237,442 | same | 99.2% of 25,677 | same |
| Missing models (≥10 regs, not in universe) | NOT MEASURABLE (no registration→model_id crosswalk) | same | 4 (N7 158, Rogue 12, Armada 11, Kicks 10) | 4, now queued |
| **T1-verified trim share** | 31/675 = **4.6%** | 49/675 = **7.3%** | 0/37 = **0%** | 18/37 = **48.6%** |
| **T1-verified model share, registration-weighted** | **8.6%** | **19.5%** | **0%** | **96.3%** |
| Models with any validated T1 observation | 18/283 (6.4%) | 25/283 (8.8%) | 0/7 | 7/7 |
| Trim prices with row-level provenance (URL + hash) | **0%** | 2.7% | 0% | 48.6% |
| Automation coverage (re-runnable deterministic recipe) | 0% | 2.7% | 0% | 48.6% |
| Price freshness ≤30d (observation date) | 96.1% | same | 100% | same |
| Source-stated effective date ≤30d | NOT MEASURABLE (P1 has no effective date) | NOT MEASURABLE | NOT MEASURABLE | **0/27** T1 prices (Nissan `Updated_On`: 2025-07-17 to 2026-07-29) |
| hp / seats / warranty populated (consumer) | 17.0% / 22.6% / 59.0% | same | 100% / 14.3% / 28.6% | same |
| hp / seats / cc / torque backed by T1 | 0 / 0 / 0 / 0 | 1.4 / 0.7 / 1.1 / 1.1% | 0 each | 57.1 / 28.6 / 42.9 / 42.9% |
| Unresolved conflicts, structured | 0 structured (117 free-text legacy flags) | 23 open, structured | 0 | 23 open |
| Trim coverage vs official lineup | NOT MEASURABLE (no T1 lineup outside Nissan) | — | — | 21 of 26 priced official grades matched to consumer trims; 5 official grades unmatched; 11 consumer trims absent from the official site |

**Batch counts:**

| Item | Count |
|---|---|
| Models reviewed | 7 |
| Observations created | 63, all Tier 1 and deterministic (27 price, 36 spec). The DB also holds 3,823 legacy observations (not counted as batch work) |
| `t1_verified` | 20 |
| Candidates | 43: 18 CONFIRM pending, 2 CONFIRM blocked, 5 CORRECT, 7 ADD, 11 FLAG_STALE |
| Unresolved conflicts | 23 |
| Rejected observations | 0 |
| Observations blocked from promotion | 2 (Magnite, model-year conflict) |
| Items routed to deterministic handling | 8 of 34 conflict/exception items |
| AI-exception items | 20 of 34 (59%), all trim-label reconciliation |
| Human-review items | 6 |
| External searches | 0 web searches; 17 official-domain HTTP requests + 8 probe requests |

## 5. Canonical changes

**None.** No change to `carindex_master.csv`, P1 `view.js`, n8n, Notion content DB, or any Drive
dataset. All outputs are new files in `p2_factory/`.

## 6. Exceptions and conflicts (all open, all visible)

**Value conflicts where the official price differs from P1:**

| Model / trim | Official | P1 | Aggregators |
|---|---|---|---|
| Magnite Tekna+ | 888,000 (upd 2026-07-29) | 868,000 | ContactCars/EgyCar 888,000 |

P1 has mislabelled Tekna's price as Tekna+, and the official "Tekna" grade (868,000) is missing
from P1.

| Model / trim | Official | P1 |
|---|---|---|
| Qashqai N-connecta Plus | 1,777,000 | 1,757,000 |
| Qashqai Tekna | 1,888,000 | 1,868,000 |
| Sunny Mid | 799,999 | "Midline" 800,000 |
| X-Trail Tekna | 2,299,990 (upd 2025-10-08) | 2,300,000 |

**Model year.** Official Magnite price key says 2026; P1 and aggregators say 2027. Not relabelled.

**Official silent.** The Sunny Base MT grade exists with no price; P1 shows 665,000 (Hatla2ee only).

**Trim naming (20 items, AI exception):**
- Official X-Trail lists 2 grades (Acenta Premium 1,999,990; Tekna 2,299,990). P1 lists Acenta Plus, N-Trek, Tekna and Tekna e-4ORCE.
- Patrol "SE T2" vs P1 "SE".
- Juke LVL002/003 have no names on the site; prices equal P1 Tekna/Tekna N-design.
- Qashqai "N-connecta+ 2T", "Tekna 2T" and "e-Power" are absent from the official site.
- Sentra "Full Option" is absent from the official site.
- Sunny "plus" (799,900) is absent from the official site.

**Unstructured sources:**
- Sunny/Sentra/Qashqai spec pages return 404.
- The Magnite and Qashqai brochures have no extractable spec values.

**Missing models (human review):**
- N7: 158 regs, not on the Nissan EG site (other importer?)
- Rogue, Armada, Kicks: 10–12 regs each (likely grey imports)

**Stop conditions hit:**
- n8n API: HTTP 401 with the key stored in `.claude/settings.local.json`. Not pursued (authentication). Used the local exports instead.
- `mgmotor.com.eg`, `cheryegypt.com` and variants: DNS/no response. Not pursued.

## 7. Contradictions with the Control Tower and prior assumptions

1. **P1 already runs a de facto canonical vehicle dataset.** `CI_UNIVERSE` has slug IDs, a registration join and official flags. LIVING_DATA/AUDIT say "no dataset shares a key" and "no IDs exist". I1 says `registration_aliases` is "not built", yet P1 joins 298 models to registrations. The canonical owner is effectively P1's build step, which is undocumented and outside P2.
2. **I1's semantic layer is wrong on one point.** It says P1 IDs look like `U11-2026-09-26`. That is the universe *version*; the model IDs are slugs (`nissan/sunny`).
3. **Tier table conflict.** LIVING_DATA proposes aggregators = T2; the assignment says T4. Resolved to T4 here, flagged for a decision.
4. **"Freshness" is misleading.** 96% of prices are "fresh" by observation date, yet official Nissan prices were last updated by Nissan between Jul 2025 and Jul 2026. Freshness needs effective dates.
5. **P1 fields look complete but are unsourced.** Nissan hp is 100% populated, with zero row-level provenance before this batch. Completeness ≠ readiness.

## 8. Automation candidates

See `RECIPES.md`. In short:

**n8n NOW** (deterministic, proven):
- weekly Nissan EG VLP price-JSON check with a diff against the last evidence hash
- robots.txt/health check per T1 source
- evidence hashing and observation append
- readiness recalculation
- a Notion return row

**n8n NEXT:**
- the same VLP recipe for other brands on the Nissan/Renault/Mitsubishi AEM platform (probe needed)
- a Drive "Automotive Updates" watcher that registers new PDFs as evidence
- registration-append → MISSING_MODEL/REGISTRATION_FIRST_SEEN exceptions
- a news `price_change_claim` → trigger the T1 recheck for that model

**Keep with AI:**
- trim-label reconciliation (20 items)
- brochure spec reads where the PDF text is columnar or image-based
- model-year convention judgement
- importer attribution for N7-type cases

## 9. Dependencies

- **P1:**
  - hand over the U11 build script, or add `source_id`/`evidence_id` per trim
  - accept `p2_dataset_version` in `CI_UNIVERSE.meta`
  - review the 5 CORRECT and 2 Magnite items; they affect live recommendations (Magnite Tekna+ is under-priced by 20,000 EGP)
- **A1:** host `p2_staging` as a schema in the planned PostgreSQL when S1 happens; no separate server.
- **I1:** the N7 attribution and Nissan distributor gap share one root cause, the importer mapping.
- **P4:** news claims map to observation types (CONTRACT §7); no workflow change needed now.
- **P5:** the n8n API key is invalid (401). Live read-only verification needs a valid key.

## 10. Next autonomous action

**Batch B002, MG** (18,541 regs, 9 models, 0 T1). Candidate sources, in order:
1. MG brochures already in Drive (RX9, HS)
2. discover the official MG Egypt domain (the guessed domains failed)

Fallbacks:
- **Hyundai** (16,707 regs), then **Chery** (17,686 regs): Tiggo 7 Pro brochure in Drive; official domain undiscovered.
- In parallel: add a VLP-platform probe for Renault/Mitsubishi.

## 11. CEO gate

None required to continue. Decisions that are useful but not blocking:
1. **Confirm the tier table:** aggregators T4 per this assignment, vs T2 in LIVING_DATA D5.
2. **Name the canonical owner** of the vehicle dataset. P1's build currently acts as canonical; P2 should own it, with P1 consuming a versioned export.
3. **Authorize CONFIRM auto-promotion** (T1 + deterministic + no conflict), or keep every promotion owner-reviewed.
