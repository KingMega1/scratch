# CarIndex golden path — Buyer Check

One fixed format, one verified car, real source, real image, deterministic QA, Telegram approval. No auto-publishing.

## Flow (n8n, after `n8n/patch_workflow.py`)

| Step | n8n node(s) | What happens |
|---|---|---|
| SOURCE | RSS lanes / Manual Test Trigger / Execute Workflow Trigger → Code in JavaScript | article + postId |
| CURATE | Triage (+NIM fallback) → IF Relevant Enough | score ≥ 6; low scores now logged |
| VEHICLE | Identify Vehicle → Parse Vehicle ID | make/model |
| REAL IMAGE | Build OEM Queries → DDG → Parse OEM Candidates → Build Image Candidates | only images whose URL contains the model name; none → **Set No Image** (no AI image) |
| CONTENT | Content Creation (NIM) / Gemini fallback | structured Buyer Check JSON, prompt = `prompts/buyer_check_content.md` |
| FACT CHECK | Extract Superlative Claims → Tavily → Auditor → Check Auditor Hard-Fail | unchanged |
| EDITORIAL | Editor-in-Chief (3 tiers) → Merge Verdict → IF Verdict Reject | unchanged |
| TEMPLATE | Parse AI Draft → Carousel Designer | `src/buyer_check_render.js`, 6 fixed slides |
| RENDER | Render Slide to PNG (media-render) → Download Rendered Slide → Merge Slides Into Item | file list: name, url, bytes, 1080×1350 check |
| QA | QA Gate → IF QA Passed | `src/qa_gate.js`; fail → Log QA Failed + Telegram QA Fail Alert, **stop** |
| TELEGRAM | Append row (Pending) → 6 slide previews → approval message | `src/telegram_approval.js` |
| APPROVAL | Poll Telegram → Extract Reply → Switch | `YES` → Approved; `NO <reason>` → Rejected + RejectReason; anything else ignored |
| FINAL ASSET | Sheet row Approved: SlideFiles + ImageURLs | not published |

Buyer Check slides: 1 cover (real image + hook) · 2 key fact · 3 why it matters · 4 strengths · 5 caveat / skip-if · 6 CTA + sources.

## QA gate (blocks on any failure)
Required fields · exactly 6 slides in fixed order · every source has outlet/url/date · every `verified` fact has a source (or checked arithmetic for derived values) · headline number verified · **every number in any text is a verified fact value** · no hype words · no unsourced superlatives · AR/EN both present, same numbers, Latin digits, no Arabic in EN · length limits · real, approved, non-AI image of the same make+model · 6 files, correct names `{postId}_{nn}_{role}.png`, 1080×1350, not blank, no text overflow (local run).

## Run locally
```
cd golden_path
NODE_PATH=$(npm root -g) node run_golden_path.js   # renders + QA + simulated Telegram for fixtures/stories/*
node test_qa.js                                     # 28 QA / reply-parser tests
python3 n8n/patch_workflow.py                       # rebuilds n8n/CarIndex_Workflow.golden.json
```
Outputs: `out/<postId>/` (PNGs, content.json, qa.json, Telegram text), `out/sheet.json` (simulated Sheet), `out/CI-20260924-01/FINAL/` (approved asset).

## Test results (2026-09-24)
Content step was written in this session to the prompt's schema (NIM/Gemini not reachable from here); facts were checked by web search. Everything after the content step ran as code.

| # | Type | Story | Run 1 | Run 2 (final) |
|---|---|---|---|---|
| 1 | Buyer Check | Chery Tiggo 7 Pro local, Comfort EGP 1,080,000 | Approved | **Approved** → `out/CI-20260924-01/FINAL/` |
| 2 | Price change | SEAT Leon −100,000 → 1,499,000 | QA pass → reply `NO …` → Rejected + reason | same |
| 3 | Comparison | Monjaro EM-i Pro 1,699,000 vs MG RX9 1,899,990 | QA fail: 4 false-positive superlatives + image not EM-i | **QA fail: image not confirmed EM-i** (correct stop) |
| 4 | New trim | BAIC U5 Plus Manual 695,000 | QA fail: unsourced "1.5" and "700", Arabic comparative flagged, rejected image | **QA fail: image rejected** (correct stop) |
| 5 | Market data | Aug 2026 licensing, MG ZS 647 | QA fail: hook superlative not linked to its sourced fact, "only" false positive, rejected image | **QA fail: image rejected** (correct stop) |

Failures found and fixes:
1. Fact check: owner's package price for Tiggo 7 Pro (1,075,000) was stale — raised to 1,080,000 on 2026-09-20. Fixed in content; QA now warns when the headline source is >14 days old.
2. Fact check: Monjaro EM-i Max/Ultra prices conflict across sources → stored as `conflict`, rendered "sources conflict", not used.
3. QA false positives (EN adverbs "only/first", AR comparatives with an amount) → superlative patterns narrowed; hook inherits cover facts.
4. Content errors caught by QA (story 4: engine size not in facts, "700k" budget) → content corrected.
5. Drive photo library: BAIC U5 Plus and MG ZS files are ContactCars gallery screenshots (arrows, watermark) → `image_registry.json` marks them rejected; QA requires `approved`.
6. Template: underfilled slides 4–6, LTR icon rows, serif fallback → fixed in `src/buyer_check_render.js`.

## Security
`n8n/scrub_secrets.py` removes hardcoded secrets from any export (also inside the embedded `activeVersion`) and fails if a known key pattern remains. Both workflow JSONs in this repo are scrubbed. Git history still contains the old values (repo is public).
- media-render key → n8n credential **Header Auth** named `CarIndex Media Render API` (header `X-Api-Key`) on Render Slide to PNG, Upload Generated Image, Call Media Render Video.
- Telegram bot token → `{{ $env.TELEGRAM_BOT_TOKEN }}` in Poll Telegram Updates (needs the env var on the n8n container and `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`).

## Image registry
Schema + rules: `src/image_registry.js` (header). Seed data: `image_registry.json` (6 rows, same columns as a Sheet tab `ImageRegistry`). Resolved by brand/model/variant; exact variant first, then model-wide; no fallback across model names (Monjaro ≠ Monjaro EM-i). Blocked: `third_party_listing`, `ai_generated`, `rights_status=not_allowed`, `vehicle_match≠verified`, verification older than 365 days. Rights `unknown` passes with a QA warning. Tested in `test_qa.js`.

## Live deploy runbook (blocked: n8n host not reachable from this environment)
1. `curl -H "X-N8N-API-KEY: …" http://<host>:5678/api/v1/workflows/smn2kQ7BP9H926pV > live.json`
2. `python3 n8n/reconcile.py <base: git show 70b0695:CarIndex_Workflow.json> live.json n8n/CarIndex_Workflow.golden.json`
3. If `conflicting` / `requires decision` are empty: copy live.json over `../CarIndex_Workflow.json`, run `python3 n8n/patch_workflow.py`, import the output as a **new, inactive** workflow. Otherwise resolve those nodes first.
4. Create credential `CarIndex Media Render API`; set `TELEGRAM_BOT_TOKEN`.
5. Sheet1: append headers `SlideFiles`, `QA`, `RejectReason` after the last existing column (no existing column moved).
6. Run Manual Test Trigger once; reply YES, then run a second story and reply `NO <reason>`.
