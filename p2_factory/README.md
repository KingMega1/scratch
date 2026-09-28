# P2 Data Readiness Factory (non-production)

> **Correction, 2026-09-28 (later the same day).** An implemented P2 vehicle-data layer already exists
> in GitHub: `KingMega1/scratch`, branch `claude/carindex-buyer-vehicle-data-97yinp`, `vehicle-data/`.
> It has a model registry, `registration_aliases`, snapshots with evidence, change detection, a CI
> refresh, and the P1 view `carindex.p1.buyer_view/v2`. This factory's claims of "no P2 IDs / no
> pipeline" were wrong, and its P1-slug identity duplicates `registry/models.csv`.
>
> Treat this folder as a **Tier-1 recipe prototype** (the Nissan official price JSON). Port it into
> `vehicle-data/scripts`; do not run it as a parallel store. Sync contract: `../p2_sync/SYNC_CONTRACT.md`.

Staging, provenance and readiness measurement for CarIndex automotive data. It implements
`LIVING_DATA_ARCHITECTURE.md` (Drive: `02 …/Claude outputs/vehicle-data/`) L0/L1 plus the
review gates. **It never writes canonical data, P1's universe, n8n, or Drive datasets.**

| File | What |
|---|---|
| `CONTRACT.md` | Observation/provenance contract, source tiers, verification and promotion rules, news rule, P1 path, storage decision |
| `schema.sql` | SQLite schema (sources, evidence, observations, conflicts, promotion_candidates, exceptions, readiness_runs) |
| `sources.csv` | L0 source registry (tier, market scope, access notes) |
| `factory.py` | Legacy load → readiness before → Tier-1 recipe → reconcile → readiness after → export |
| `RECIPES.md` | Extraction recipes plus n8n NOW/NEXT/AI assessment |
| `runs/B001_nissan_eg_2026-09-28/` | First real batch: `REPORT.md`, `staging.sqlite`, CSV exports, evidence hashes |

Run it (local copies only; the Drive mount is unreliable):

```
python3 factory.py run --work /tmp/p2 --out /tmp/p2/out \
  --master carindex_master.csv --universe view.js --reg reg_raw.csv \
  --pdf-python <python with pypdf> [--refetch]
```
