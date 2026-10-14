# P2 handoffs

| File | For | Status |
|---|---|---|
| `p5-rc2-integration-20261014.patch` | P5 | `git am` on P5 head 4fe3ea0 (verified identical apply; P5 typecheck clean, unit 61/61). Supersedes the 20261013 media patch. |
| `parallel-allocation-20261014.csv` | Claude Code Cloud, ChatGPT Work | Non-overlapping work split, generated from `review/u11_coverage.csv`, ordered by U11 registrations (last 12 months). |

## P5 RC2 integration
- `web/data/registry/p2-accepted.json`: the RC2 `accepted` block for each route (price, specs, warranty, brochures, logo, hero_image, market_status, conflicts).
  - Generated from `vehicle-data/views/catalogue-serving.release.json`.
  - `buildCatalogue(snap,u,cw,p2)` merges it and fails closed if a route is unknown or a p1_id does not match.
- Files:
  - 40 heroes at `/media/models/<site_slug>.webp`, which replaces 5 P5 Nissan photos in place with the same models at 2400 px;
  - 37 logos at `/media/brands/<brand>.png`.
- Rendering is unchanged. Only `accepted.hero_image` is consumed today, through `p2Hero()`.
  - Prices and logos are delivered as data for P5 to adopt.
  - The BYD and Nissan logos are white on a transparent background, so they need a dark surface.
- Gallery images (35 models, 180 files) are not in the patch because P5 has no gallery UI yet. They are under `vehicle-data/media/models/<slug>/` and listed in RC2 `accepted.gallery`.

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
