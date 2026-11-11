# AT-43 / P5-PARALLEL-HARDENING-01 — verified return

Date: 2026-10-07. State: DONE for bounded hardening; overall WEB-LAUNCH-01 remains VERIFYING. No production deployment.

## Baseline and authority

- P5 branch: claude/vigilant-cori-ce710x; base c25ca2a0cf864d763007cf592b2fd5e015e051fc, descendant of app f814a46.
- Verified deployed smoke run 37596571387 concluded success on c25ca2a.
- Audit source: 2f3f5adc67a9ef0752a0d9934c14aa33d7d10146. Its bounded patch was applied to the current base; no branch merge.
- Current P3 artifact pinned for integration: Version 5, 1791368192-d509 (CEO supplied). No semantic RELEASE inferred.
- Recommendation semantics, engine, parser, ranking, canonical vehicle data, approved IA and Brand V2 rules unchanged.

## Changes and verification

| Task | State | Outcome | Tests | Acceptance | Remaining risk | Next autonomous action |
|---|---|---|---|---|---|---|
| Selective Tranche A port | DONE | Environment-aware noindex; bilingual sitemap/hreflang/x-default; CMS draft boundary including related articles; SHA-256 fixed-size credential comparison; EV3 key/nested/array guards; production QA-buffer disabled; WOFF2 and WebP | Preview and local production builds; typecheck; 47 unit tests; vendor integrity | PASS | Hero remains flagged temporary/unverified; production canonical origin must be configured | Review bounded delta into current P5 branch; no deploy |
| Non-FMC launch pages | DONE | Home, Cars, Car Detail, Compare, Market, Search, News & Guides and account shell checked in EN/AR, desktop/mobile | 126/126 preview checks, including 48 axe WCAG A/AA page/device checks and both-language overflow checks; 6/6 local production boundary checks | PASS for requested automated hardening | No new deployed smoke claimed; automated axe is not exhaustive accessibility certification | Run deployed preview smoke after preview integration |
| Settled recommendation QA | DONE | Read-only accepted P1 baseline fixtures; negation/exclusion, unresolved comparative brands, max/around/stretch, 36-brief deterministic tie/lean matrix, EN/AR parity; share UUID and stale official-price preservation | Unit suite 47/47; app P1 hashes verified | PASS | Accepted P1 QA source is newer than app vendored parser; no silent vendor replacement | Bind released P1 transport only after exact RELEASE |
| P2 gap analysis | DONE | 552 proposed field rows / 278 models, separated by P1 QA baseline and current canonical P2 baseline | Deterministic read-only CSV generator | PASS | U11 baseline gaps may already be enriched in newer P2; report is a proposal, not canonical promotion | P2 reconciles each baseline and verifies exact Egypt trim/year evidence |
| P5 integration adapter preparation | DONE | Inactive adapter checks exact P3 artifact, P1 RELEASE evidence reference, engine/universe/snapshot versions, confirmed brief and share-safe result schema; passes P1 statements/state/prices unchanged | Rejects missing/older release, mismatched versions and free-text results; preserves tie/lean and stale flags | PASS for preparation | P1-approved brief/result transport and canonical universe binding still require semantic RELEASE | Plug released transport into provider, then enable route and rerun integration smoke |

## Evidence

- `docs/hardening-evidence/preview-smoke.json`: 126 passed; 6 production-only checks intentionally skipped in preview.
- `docs/hardening-evidence/production-smoke.json`: 6 passed, local production-mode fixture on loopback. Nothing deployed.
- `docs/hardening-evidence/unit-results.txt`: 47 passed.
- `docs/hardening-evidence/p2-recommendation-gaps.csv`: Model | missing field | why it affects recommendation | priority | proposed P2 action | evidence baseline.
- `scripts/report-recommendation-gaps.mjs`: reproducible read-only report.
- `src/server/recommendation/integration-adapter.ts`: inactive P5 release boundary.
- `tests/fixtures/p1-accepted/manifest.json`: QA-only P1 source 1a139e538d32c05457d344a53cf9f59c54b5925f and source hashes. These fixtures never enter the application.

## Priority P2 examples

| Model | Missing field | Recommendation consequence | Priority | Proposed P2 action |
|---|---|---|---|---|
| Kia Sportage | seats | Canonical seven-seat eligibility binding lacks evidence | P0 | Verify exact trim/year seat count |
| Hyundai Tucson | current official grade price | Entry price conflict weakens budget/display reliability | P0 | Resolve against dated importer price list; retain conflicting observations |
| Volkswagen Tiguan | drive_type | Unknown hard 4WD eligibility | P0 | Verify Egypt trim/year drivetrain from official brochure |
| Jetour T2 | drive_type | Unknown hard 4WD eligibility | P0 | Verify Egypt trim/year drivetrain from official brochure |
| Kia Sportage / Hyundai Tucson | fuel_consumption | Current economy score uses powertrain proxies; measured consumption does not currently affect ranking | P2 | Capture cycle/units/grade; any scoring change requires separate P1 approval |
| Volkswagen Tiguan | trunk_capacity | Buyer comparison gap; current engine does not rank measured boot volume | P2 | Capture litres and seat configuration; separate P1 decision for future use |

## Integration delta after RELEASE

Keep the existing provider blocked. Obtain P1 RELEASE for exact Version 5 plus approved transport and version bindings. Instantiate the prepared adapter with that evidence and the P1-owned transport; connect it to provider status/recommend; enable the route through the existing feature gate. No flag alone can bypass today's hard block. Do not derive engine states, score priorities, invent WHY text or bind the older U11 universe silently.

## Limits and cost

No production change, publishing, semantic gate closure, new P1 engine outcome or canonical-data promotion. Source trees for app P1 vendor, registry projection and vehicle read-model compare byte-identically with the base. Native token/cost telemetry unavailable; no paid service invoked. Earlier smoke failures from old audit URL assumptions and stale localhost responses were corrected by canonical slugs and explicit 127.0.0.1/distinct test ports; final checks pass.
