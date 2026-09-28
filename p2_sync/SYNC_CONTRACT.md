# P2 vehicle-data sync contract `carindex.p2.sync/v1`

2026-09-28. This contract covers the new-format vehicle-data artifacts across GitHub, Google Drive
and n8n. It is built on what already exists and adds no competing store.

## 1. Where things actually live (verified 2026-09-28)

| Role | System | Location | Evidence |
|---|---|---|---|
| **Canonical source (only writer)** | GitHub | `KingMega1/scratch`, branch `claude/carindex-buyer-vehicle-data-97yinp`, `vehicle-data/`. **Public repo.** Written by Claude sessions and by the GitHub Actions bot | 5 automated refreshes on 2026-09-25 (`carindex-refresh-bot`); head `d475768` |
| New-format artifact | GitHub | `vehicle-data/views/p1_suv_2m.json`, `schema = carindex.p1.buyer_view/v2` (every input sha256 is inside `inputs[]`). History: 7 commits, including an older `v1` | `git log -- vehicle-data/views/p1_suv_2m.json` |
| Producer | GitHub Actions | `.github/workflows/vehicle-refresh.yml`: manual dispatch, or a push to `refresh.request`. Schedule is off (D10/D14) | workflow file |
| Mirror (read-only copy for people) | Google Drive | `CarIndex/99 Temporary & Intake/p2-sync-canary [NON-PRODUCTION]/` (canary). Proposed production path: `02 Automotive Data & Market Intelligence/vehicle-data (GitHub mirror)/` | Drive folder `16qpg1vkJ__0-u1LYmciHaUZ_-YThA7TP` |
| Machine consumer | n8n (live, 2.37.10) | Workflow `P2SyncProbe00001`, "[NON-PROD] P2 vehicle-data sync consumer (GitHub → n8n ledger)". Inactive; run through the CLI | CLI export |
| Not involved | n8n production workflows `smn2kQ7BP9H926pV`, `2hwpP6ahE67waRBn`, `PtkcBo92CSztGzO8` | They never read or write vehicle data. Live config equals the local exports (0 parameter diffs) | diff 2026-09-28 |

**Direction: GitHub fans out to Drive and to n8n. Nothing syncs back.** The architecture
(LIVING_DATA_ARCHITECTURE §2.3/§5.3, the vehicle-data README) makes the git-versioned data layer
canonical and every other system a versioned consumer. Drive is a human-readable mirror, never
edited. n8n consumes from GitHub directly; it does not read Drive because it holds no Drive
credential, and granting one is not needed.

## 2. Identity of every synced artifact

These fields come from existing conventions (`schema` ids, sha256 in `inputs[]`, `drive_file_id` in
snapshot manifests).

| Property | Field | Source of truth |
|---|---|---|
| Stable key | `artifact_id = github:<repo>:<path>` | repo + path |
| Schema/version | `schema` inside the artifact (allowlisted); `version` = ledger sequence 1, 2, 3… | artifact, ledger |
| Provenance | `commit` (full sha), `commit_date`, `canonical_url` (`github.com/<repo>/blob/<commit>/<path>`) | GitHub |
| Integrity | `sha256` of the bytes, plus `git_blob_sha` recomputed and checked against GitHub's own blob sha | computed on both legs |
| Timestamps | `commit_date` (canonical); `mirrored_at` / `processed_at` (consumer) | |
| Canonical location | `canonical_url` | |
| Sync state | ledger `events[]`, one decision per request; `previous` on update; `last_seen_commit` on no-change | Drive `SYNC_LEDGER.json`; n8n workflow static data `p2sync` |

## 3. Decision rules (identical in both consumers)

The rules are evaluated in order, so a failed check never changes current state.

1. **Path allowlist:** `vehicle-data/views/*.json`, `vehicle-data/sync_canary/*.json`. Otherwise `REJECTED_NOT_ALLOWED`.
2. **Commit lineage:** the commit must be identical to, or behind, the canonical branch head (GitHub compare). Otherwise `REJECTED_NOT_ON_CANONICAL_BRANCH`; an unknown ref gives `REJECTED_SOURCE_NOT_FOUND`.
3. **Transient errors:** GitHub 403/429 (rate limit), 5xx or a network error gives **`DEFERRED_SOURCE_UNAVAILABLE`**. It is retryable and changes no state (repair 2026-09-28).
4. **Integrity:** the bytes' git blob sha must equal GitHub's. The optional `expected_sha256` must match. Otherwise `REJECTED_INTEGRITY`.
5. **Format:** UTF-8 JSON object, else `REJECTED_MALFORMED`. `schema` must be allowlisted, else `REJECTED_UNSUPPORTED_SCHEMA`. Required keys must be present, else `REJECTED_MALFORMED`.
6. **Versioning** against the ledger:
   - No entry: `ACCEPTED_NEW` (v1).
   - Same sha256: `DUPLICATE_NO_CHANGE`, even from a newer commit; only `last_seen_commit` advances.
   - Newer commit with different bytes: `UPDATED` (v+1; the previous version is kept).
   - Older commit: **`REJECTED_STALE`**.
   - Diverged history: `REJECTED_DIVERGED`.
7. **Drive only:** if the Drive copy's hash drifts from its ledger version (someone edited or deleted it), the next sync gives `REPAIRED_MIRROR` and restores the canonical bytes. Files are never deleted; superseded versions go to `versions/<v>_<commit7>/`.

Allowed schemas: `carindex.p1.buyer_view/v2`, and `carindex.sync_canary/v1` (synthetic tests only).
`carindex.p1.buyer_view/v1` is deliberately unsupported (superseded).

## 4. Components

| File | What |
|---|---|
| `sync_core.js` | n8n consumer logic (pure JS; SHA-256/SHA-1 implemented in-file because the n8n sandbox blocks `crypto`) |
| `build_workflow.py` → `n8n_p2_sync_consumer.json` | Workflow export: Manual Trigger → Read Sync Request (`/home/node/.n8n-files/p2sync/request.json`, optional) → Parse → Sync |
| `run_n8n.sh` | Runs one request through **live** n8n via `n8n execute` (task-runner port 5699, so it does not collide with the live instance) |
| `github_to_drive.py` | Drive mirror agent (runs where Google Drive for desktop is mounted) |
| `run_canary.py` | Live end-to-end canary: same request sequence through both legs from a clean ledger, plus final-state readback |
| `test_offline.mjs`, `test_offline_drive.py` | Deployed code against mocked GitHub + synthetic canary files (malformed, missing keys, drift repair) |
| `synthetic_canary/` | Synthetic `carindex.sync_canary/v1` artifacts plus `run_synthetic_canary.sh` (needs GitHub push rights) |
| `evidence/` | Canary result JSONs, rate-limit evidence |

## 5. Going to production (not done; each step is additive)

1. Change the Drive mirror root to the production path, and schedule `github_to_drive.py sync` (launchd on the owner's Mac, or any host with Drive for desktop).
2. In n8n, add a Schedule Trigger in parallel with the Manual Trigger and activate. The static-data ledger then persists for trigger executions. Add a GitHub token credential (read-only, public repo) to lift the 60-requests/hour anonymous limit.
3. Downstream use: the content pipeline (Identify Vehicle) can look up `model_id` and prices from the n8n ledger's current version, never from Drive.
