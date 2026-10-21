# P2 handoffs

| File | For | Status |
|---|---|---|
| `p5-release-20261020.json` | P5 | Current. Release sha256 6cac9612…, 391 files. P5 d1b731a: 391/391 sha256, typecheck pass, 76/76. Adds accepted.powertrains corrections; price-count definition. |
| `p1-release-20261020.json` | P1 | Current. Price reconciliation (236/234/226), powertrain corrections, MG GT/7 trim availability. |
| `review/decision_critical_gaps.csv` | P2/ChatGPT Work | Ranked decision-critical gaps (no photos). |
| `p5-release-20261015c.json` | P5 | Superseded (ingested by P5 d1b731a). Release sha256 955699de…, 391 files (85 heroes, 54 logos, 252 gallery). Verified against P5 8f83109: 391/391 sha256, typecheck pass, 74/74. P5 serves 20261015b. |
| `p1-release-20261015c.json` | P1 | Superseded. M13-D prices/specs/Arabic names; canonical sha and regression actions. |
| `review/m13_acceptance_manifest.csv` | all | M13-A–D row-level decisions (190 rows). |
| `p5-release-20261015b.json` | P5 | Superseded (ingested by P5 8f83109). Release sha256 7cbdc3f4…, 374 served files (78 heroes, 54 logos, 242 gallery). Verified against P5 6907ee3: 374/374 sha256 match, typecheck pass, unit tests 73/74 (only the out-of-date Tucson fixture fails). P5 currently serves 20261014c. |
| `p5-release-20261015.json` | P5 | Superseded. Release sha256 e17398b6…, 348 served files (68 heroes, 54 logos, 226 gallery). P5 f131fdc: typecheck pass, unit tests 73/74 (the Tucson fixture expects a price conflict that the GB Auto list resolved upstream). P5 has not ingested it yet. |
| `chatgpt-m10-m12-selections.json` | P2 | ChatGPT Work M10–M12: 54 new images. 25 reproduced sha256-identical (CI 38723488776); 29 blocked by HTTP 403 from the Stellantis and Volvo CDNs (retry 38723784165 with browser Accept and Referer). Resolved 2026-10-15 from ChatGPT Work's Drive originals (manifest 1qeNwbuhgr4nalQhjFJmx0Tn66qlV0tFB; bytes sha256-identical; copies in `snapshots/MR_2026-10-15_drive-recovery`): 26 accepted, 3 rejected. Final M10–M12 ledger: 47 accepted + 1 promoted, 7 rejected, 0 held. Decisions: `review/chatgpt_m10_m12_decisions.csv`. |
| `p5-release-20261014c.json` | P5 | Superseded. Release sha256 4770fbd5…, 327 served files (58 heroes, 54 logos, 215 gallery) with sha256. Verified against P5 f131fdc in a disposable worktree: typecheck pass, unit tests 74/74. P5 has not ingested it yet (P5 still serves 559c718, sha a0032612…). |
| `p5-release-20261014b.json` | P5 | Superseded by `c`. |
| `chatgpt-closure-20261014-selections.json` | P2 | ChatGPT Work priority-record closure: 22 new images. 18 reproduced sha256-identical in CI run 38576320947 and accepted; 4 Mercedes images not reproducible (site timeout). Decisions: `review/chatgpt_closure_20261014_decisions.csv`. |
| `parallel-allocation-20261014.csv` | Claude Code Cloud, ChatGPT Work | Non-overlapping work split, generated from `review/u11_coverage.csv`. |
| `chatgpt-milestone-04-selections.json` | P2 | ChatGPT Work milestone-04 selections. Bytes were reproduced sha256-identical in CI run 38530437824. |

## P5 release route (established by P5 in a6d3f0b)
1. Copy `vehicle-data/views/catalogue-serving.release.json` verbatim to `web/data/registry/catalogue-serving.release.json`.
2. Copy every `src` listed in the manifest from `vehicle-data/media/<models|brands>/...` to `web/public/media/p2/<models|brands>/...`.
3. Check the files against the sha256 values in the manifest.

Verification on a6d3f0b:
- Typecheck passes.
- Unit tests pass 61/62. The failing test is `catalogue-coverage.test.mjs:82`, whose fixture assumes MG HS has no accepted hero. RC2 now accepts an MG HS hero, so P5 should point that fixture at a model without one. No read-model change is needed.

Gallery: 46 models, 202 images, in `accepted.gallery[].src`.

White-only logos (BYD, Nissan) have no dark variant yet.

## Parallel allocation rules
- **P2 (this branch).** Sole canonical acceptance for identity, price, specs, warranty, brochures and media mappings. Owns the `p2_canonical` column: price REWORK and NO_EVIDENCE.
- **Claude Code Cloud.** Owns the `claude_cloud_extraction` column (specs, warranty, brochure).
  - Works on its own branch and writes candidates only, under `vehicle-data/snapshots/X_<date>_<run>/`.
  - No edits to `registry/`, `views/`, `review/`, `scripts/canonical.py` or this branch.
  - Every candidate row carries source URL, issuer, retrieval time and exact trim/model year.
  - Unknown stays unknown.
- **ChatGPT Work.** Owns the `chatgpt_work_images` column: ten-model milestones M01, M02, … ; M00 is the Changan UNI-V reference.
  - Delivers original-resolution official images with source page, image URL, dimensions and exact model/generation notes.
  - No canonical changes, no price research.
- P2 accepts candidates into `registry/*.csv` after verification. Columns already accepted are not re-researched.

## Worker note (2026-10-14)
- `.github/workflows/vehicle-refresh.yml` has a mode allow-list (`case "$MODE" in ...`). An unknown mode silently falls back to `full`, so a new mode must be added there.
- Yallamotor answers 403 to automated requests (probe run 38522693528). Do not use it, and do not try to evade the block.

## Google Sheets sync (2026-10-14)
Review sheet `1TUlGhEYzrOQrYdgMgyVhHwdw_ABGZSk9OhohYnvbZVg` (CarIndex P2 Data Completion Review), via the Google Sheets connection authorised 2026-10-14.
- `P2 Canonical Sync`: read-only mirror of `review/coverage_matrix.csv` at 801acdd (416 models × 28 columns). Read back after writing: 0 text mismatches.
- `P2 ChatGPT Closure 2026-10-14`: mirror of `review/chatgpt_closure_20261014_decisions.csv`.
- Existing tabs (CEO Review, CEO Decisions, Model Completeness, etc.) were not modified.

## 2026-10-21 — October price refresh
- `p5-release-20261021.json`: release `P2-CATALOGUE-U11-2026-10-21-RC2`, see manifest for final sha256, 391 files; verified in a disposable copy of P5 `bd1086f` (typecheck pass, unit 79/79). Not pushed to P5.
- `p1-release-20261021.json`: canonical sha256 in manifest; schema/IDs unchanged; 419 models (3 P2 additions).
- Ledgers: `review/oct21_price_ledger.csv`, `review/oct21_warranty_ledger.csv`, `review/oct21_missing_price_priority.csv`, `review/price_supersession_history.csv`.
