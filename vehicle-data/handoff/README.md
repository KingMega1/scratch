# P2 handoffs

| File | For | Status |
|---|---|---|
| `p5-release-20261014c.json` | P5 | Current. Release sha256 4770fbd5…, 327 served files (58 heroes, 54 logos, 215 gallery) with sha256. Verified against P5 f131fdc in a disposable worktree: typecheck pass, unit tests 74/74. P5 has not ingested it yet (P5 still serves 559c718, sha a0032612…). |
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
