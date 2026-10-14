# AT-43 — Find My Car bound to P1 release P1-RELEASE-T1

Supersedes `P5-FMC-RELEASE-BINDING-BLOCKER.md` (blocker resolved by P1-TRANSPORT-01 PASS).

| Item | Value |
|---|---|
| P1 branch | `claude/carindex-buyer-decision-slice-applo4` |
| Transport commit | `49b73a5379735d59ba74c65425f48b02ddf18ca7` |
| Release record | `P1-RELEASE-T1` @ `090edb4680a8a228d8b1fe8043b4700dfca248ee` (record sha256 `012e5c4b…`) |
| Engine / transport / schema | `E6-2026-09-28` / `T1-2026-10-07` / `ci.reco.v1` |
| Recommendation universe | `U11-2026-09-26` (283 on sale; dataset content sha256 `5348da57…`) |
| P3 | Version 7 `1791369522-eecc` |

## Binding (per `p1-release/buyer-decision/transport/P5-INTEGRATION.md`)
- `web/p1-release/` holds the release files verbatim (`scripts/vendor-p1-release.mjs 090edb4`). They are loaded from disk at runtime, not bundled.
- Startup checks (`src/server/p1/release.ts`). Any failure makes FMC refuse to serve (503, blocked page); there is no fallback.
  1. The record's sha256 matches the bound value.
  2. Every file's sha256 and byte count match the record.
  3. `ENGINE_VERSION`, `TRANSPORT_VERSION` and `SCHEMA` match the record.
  4. The dataset id, universe and content hash match the bound values.
- Flow (`src/server/recommendation/fmc.ts`): `understand` → `nextQuestion` / answer patches → `normalize` → `summary` → **`normalize` → `execute`**. Shared links run `decodeShare` → `normalize` → `execute`.
- Answer, edit and relax patches reproduce the released `app.js` UI patches. P5 adds no scoring, ranking, parsing or copy.
- Every result is checked before it is served:
  - schema, engine, transport, universe, dataset id and hash, locale, and `result_id` format all match the bound release;
  - `share.brief` contains `SHARE_KEYS` only;
  - none of the buyer's text, notes or unresolved phrases appears in the result.
  - Audit line `reco_result` records: `result_id`, `engine_version`, `universe_version`, `dataset_sha256`, `transport_version`, `locale`, `share_r`.
- Privacy: the brief exists only in request/response bodies between the buyer and the server.
  - Never in URLs, storage, logs or analytics. Only `share.r` goes in the URL.
  - Analytics events carry ids and keys only.
- UI (`src/components/fmc/FindMyCar.tsx`) renders P1 engine-owned copy and ci.reco.v1 `html` exactly (U+2019 preserved). Ties show equal cards in P1 order, with no lead card.
- Outside the 24-model browse projection (§8): every P1 recommendation is rendered from ci.reco.v1, in P1 order.
  - Only P5's own "Car page" link is withheld, replaced by "Car page not on the site yet".
  - The "Compare these cars" link uses only cars that are on the site.
- The 503 semantic gate is removed. FMC stays noindex (launch policy).

## Tests
- `npm run verify:p1`: release integrity.
- `tests/unit/recommendation-regression.test.mjs`: binding accepts the release. It refuses a tampered engine, i18n copy, dataset, record, or a missing transport.
- `npm run test:fmc` (`tests/integration/fmc.api.test.mjs`, live server):
  - P1 corpus of 57 briefs × EN/AR: the API result deep-equals the P1 transport result;
  - question order; EN/AR copy;
  - outside-24 handling; tie; privacy, including the server log;
  - share round trip; refusal of invalid input; result actions; page has no gate.
- Playwright `find my car (P1 transport)`, desktop and mobile:
  - EN/AR journeys;
  - shared link and guided path;
  - outside-24 card and link behaviour;
  - axe on the result view.
