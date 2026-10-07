# P1-TRANSPORT-01 — verification evidence (2026-10-07)

Transport commit `49b73a5379735d59ba74c65425f48b02ddf18ca7` on P1 source `dcbe9dbaa2f93f99dfb162745b11ef315e52a5f6`. Engine E6-2026-09-28 · universe U11-2026-09-26 · transport T1-2026-10-07.

| Check | Command | Result |
|---|---|---|
| present.js = verbatim extraction of released app.js | `node tools/build_present.mjs --check` | PASS |
| Regression corpus (57 cases, 35 parse checks), strict | `node tests/regression/run.js --strict` | invariants 1142/1142, understanding failures 0, changes vs snapshot 0 |
| Transport vs engine / snapshot / accepted view; determinism; share; schema; EN/AR copy; privacy; parser; data swap; integrity; no DOM | `node tests/transport/transport.test.js` | 1517/1517 PASS |
| Browser (published build 1a139e5, real Chromium) vs transport, 57 briefs × EN/AR | `node tests/transport/browser_equivalence.mjs <1a139e5 checkout>` | 1335/1335 PASS (also 1335/1335 on a fresh build from source) |
| Existing unit suites | `node tests/{contracts,engine,integrity,redact}.test.js` | 17/17, 26/26, 22945 checks, 18/18 PASS |
| End-to-end browser journeys (unchanged app) | `node tests/e2e.mjs` | ALL PASSED |

The browser comparison covers:
- mode, eyebrow, hero name, size, price range and price note;
- the full hero detail block: WHY, trade-offs, what could change, versions, specs, market, next steps;
- every alternative and equal card, the compare table, notices, the spend-less line, checks and the no-match block (nearest above and fixes);
- the brief bar and budget;
- the detail sheets for the first alternative and for the spend-less car.

HTML is compared after the browser's own parse and serialise.

Serialization-only differences: none in rendered content. The transport adds structured fields (ids, prices, versions with `official`/`date`/`stale`, provenance), which have no effect on the recommendation. `stale` follows the 14-day rule against `price_as_of`; the released app does not show stale flags.

Observed, not changed (engine scope): a share token built from an **un-normalized** brief whose budget comes from a reference car (corpus H2, S4) makes `E.recommend` throw. The released UI never produces such a token, because it normalizes at the confirm step. The transport contract requires `normalize()` before `execute`.
