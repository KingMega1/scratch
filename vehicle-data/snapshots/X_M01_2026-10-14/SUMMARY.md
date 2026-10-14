# X_M01_2026-10-14: Claude Cloud extraction lane, milestone M01 (CANDIDATES ONLY)

Twenty models: the top 20 by registrations among allocation rows whose `claude_cloud_extraction` column includes `specs`.
Excluded: the 3 models that already have spec candidates from batch 1 (`mitsubishi/eclipse-cross`, `nissan/qashqai`, `renault/taliant`).
Nothing here is accepted. P2 verifies and accepts into `registry/`.

## Method
- Evidence reuse first. Batch-1 evidence (`X_2026-10-14_38522002564`) was mined offline, with no re-download.
- One bounded new harvest. `extract_official.py harvest --targets inputs/x2_targets.csv` (mode `x2`) ran as GitHub run 38525999365.
  - It fetched 10 URLs: 8 returned HTTP 200, including 2 PDFs.
  - Targets were only official pages already linked from harvested official pages, plus 3 exact-model probes.
- `scripts/x_milestone.py` builds the CSVs from `facts.json`.
  - Each candidate has a source URL, the evidence snapshot, a locator (PDF page, or `html` for the page text) and a verbatim quote.
  - `verify` fails if a quote is not present at its locator.
  - `tests/test_x_milestone.py` checks that this verification passes, and that an altered quote or a wrong page is rejected.
- CSV columns follow batch 1 (P2-compatible). Appended columns: `source_tier, confidence, locator, sha256, note`.
- `source_tier`:
  - `1` = official Egypt OEM/importer site.
  - `1-claimed` = the site self-identifies as Geely Egypt (hotline 16402, brochure issuer "Auto Mobility"); ownership is not independently proven.

## Results (model_status.csv)
| Result | Models |
|---|---|
| Specs extracted | forthing/t5-evo (14, HIGH/MEDIUM), jetour/x70-plus-ckd (13, MEDIUM, identity flag), geely/cool-ray (10, MEDIUM) |
| Specs held for identity | geely/emgrand-7 (11, LOW): the source model is "Emgrand", not "Emgrand 7" |
| Warranty only | changan/cs55: shared 2021 booklet, 60 months / 150,000 km |
| No official evidence | 15 models; exact blocker per model in `model_status.csv` |

Blockers among the 15 models:
- 4 models (Citroën C5, C4 X, C4 and Peugeot 5008): HTTP 403 bot protection. Not evaded.
- 7 models: the official host is unreachable or unknown.
- 2 models: no official page exists, likely because they are discontinued.
- 1 model: the official page has no specs.
- 1 model: an identity question (Outlander vs Outlander Sport).

## Decisions needed from P2
1. Does `geely/emgrand-7` map to the current "Emgrand"?
2. Does `jetour/x70-plus-ckd` map to the brochure's "X70 Plus"?
3. Do `mitsubishi/outlander` registrations refer to the Outlander Sport?
4. For the Geely Coolray, the per-trim table and brochure (172 hp / 290 Nm) disagree with the marketing text on the same official site (174 or 177 hp / 255 Nm). See `conflicts.csv`.
5. Official URLs are needed for JAC, Kaiyi, GAC, BMW, Honda, Lynk & Co and SEAT, or a decision to accept Tier-2/Tier-3 sources for these models.
