# Skipping Vercel builds on data branches (P1/P2) — P5-Run, 11 Nov 2026

**Problem.** Project `carindex-web` has Root Directory `web`. Branches without a `web/` directory (P1/P2 data branches) fail in about 12 s with
`The specified Root Directory "web" does not exist` (errorCode `NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST`, step `build-container-init`). No metered cost, but red deployments and noise.

**Why `web/vercel.json` cannot fix it.** Its `ignoreCommand` lives inside `web/`, which does not exist on those branches, and the main-branch file is never read there.

**Supported mechanism that works.** A repository-ROOT `vercel.json` carrying an `ignoreCommand` that exits 0 (= skip build). Template: `ops/vercel/data-branch.vercel.json`.

Evidence (same tree as data branch `chatgpt/p2-media-support-20261103`, which has no `web/`):

| Run | Branch / commit | Root `vercel.json` | Deployment | State |
| --- | --- | --- | --- | --- |
| Before | `chatgpt/p2-media-support-20261103` 7949b9b | none | dpl_mJj6VmHXAZWjQUdbR9R8ougq2QA9 | ERROR in ~10 s, Root Directory "web" does not exist |
| After | `p5-run/exp-skip-nonweb` bdfd21b | `ignoreCommand: "exit 0"` | dpl_7iVTPfSVikF4Qq8vkPacSriFcX9Z | CANCELED, errorLink = git-settings#ignored-build-step (no push followed it) |
| Variant | `p5-run/exp-skip-nonweb` 1a57a6a, ec639e1 | `ignoreCommand: "test ! -d web"` | dpl_FxRpNSxDJGdoviQoTaae7sw57KY7, dpl_9p1DhpKX34Rvhk6HA3s2urTjsLqW | ERROR (same failure): do NOT use a conditional command here |

**Rules.**
1. Put the template at the ROOT of each data branch as `vercel.json` (P1/P2 owners; branch creation scripts should copy it).
2. NEVER put it on `main` or any branch that has `web/`: `exit 0` would skip every build. `web/tests/unit/data-branch-build-skip.test.mjs` fails if a root `vercel.json` appears on a branch that has `web/`.
3. Not changed: Vercel project settings (Root Directory, Ignored Build Step), production, GTM, GA4.

**Not yet applied to the real data branches** (P1/P2-owned, outside this P5 branch). Until their owners add the file, those branches keep failing as before.
