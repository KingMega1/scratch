# P5 release queue (P1 + P2 bound together)

Bound on the protected preview (CEO 5 Nov 2026):

| | Release | Commit | Pin |
|---|---|---|---|
| P1 | P1-RELEASE-U12-CEO3-R4 (ACCEPTED 2026-11-05) | 22c5fe3a68803a4c4afe41b42774b065e7c6b0e1 | record sha256 8de4ea34…, dataset U12-CEO3-R4-2026-11-05 content sha256 0d34e538… |
| P2 | P2-CEO-CONFIRMED-20261102-R1, revision ad4cc5e906b4 | 3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1 | catalogue-serving.release.json sha256 e6d2711d70a786c52cacfd8aa87d0a4fa60d3529434a732431cacd94e41ceb0b (= R4 p2_input) |

Production builds keep P1-RELEASE-T1 until a production GO (`src/server/p1/release.ts`, `PREVIEW_ONLY`).

## Queued: R5 on P2 956a9a7

| | Value |
|---|---|
| P2 commit | 956a9a70096119075c52e18f4a8e8f7dd2fa1544 (frozen P1/P5 input, handoff 0bce9f6) |
| P2 revision | 7bd2d1fb1966 |
| Serving sha256 | 48a58939da4073d20e98a7e12eb70d2a76f01476ff360f43adfc93b249511266 |
| Delta vs 3b4b5ef (prices only, no identity/media change) | Jetour T2: one version 1,970,000 -> 1,930,000 (ceo1102-060 -> ceo1104-016); Geely Coolray 3 -> 6 versions; Geely Emgrand 2 -> 4 versions |
| Owner of next step | P1: rebuild and accept R5 from exactly this P2 commit |

Switch rule (P5): bind P1 R5 and P2 956a9a7 in one change, only when the R5 record is ACCEPTED and its
`p2_input.commit` / `files["catalogue-serving.release.json"]` equal the values above. Then rerun: R4->R5 vendor hash checks,
`tests/unit/p1-r4-release.test.mjs` (renamed for R5), `tests/integration/fmc.r4.test.mjs`, the Find My Car -> car page
parity smoke test, deployed EN/AR smoke. Never serve 956a9a7 with R4 (3 models would disagree between Find My Car and car pages).
