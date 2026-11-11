# P5 release queue (P1 + P2 bound together)

Bound in preview and production, 8 Nov 2026 — P1 R5 and P2 723748d moved together in one change:

| | Release | Commit | Pin |
|---|---|---|---|
| P1 | P1-RELEASE-U12-CEO3-R5 (ACCEPTED 2026-11-08, CEO) | a3fe98fab4cda8137d29507035fa405910338fc8 (source ba2120d) | record sha256 e4f19c1c…, dataset U12-CEO3-R5-2026-11-08 content sha256 b136d0e6… |
| P2 | P2-CEO-CONFIRMED-20261102-R1, revision cddfe91b3287 | 723748dfd32a7b88ef56b3bc55893fdd19ed7a0c | catalogue-serving.release.json sha256 02139f4146067089942fcdcc945e4008ad567a12095f84a3f0fc993c1c4f3a81 (= R5 p2_input) |

Production (carindexed.com): CEO GO 8 Nov. Deployment dpl_67aT5u9dUcSoksQH8tZTqGPoQcgX, P5 7c5a67e, P1 R5 a3fe98f + P2 723748d.
Rollback target: dpl_H37sXYezyAjZKCSUq2z77zgqdmi3 (P5 f386e95, P1 R4 22c5fe3 + P2 3b4b5ef).
Car pages show the CEO display name from the vendored P1 decisions (lexus/lx600 -> "LX"), matching Find My Car.

### Previous binding (R4)

Production 5–8 Nov 2026 (CEO GO 5 Nov):

| | Release | Commit | Pin |
|---|---|---|---|
| P1 | P1-RELEASE-U12-CEO3-R4 (ACCEPTED 2026-11-05) | 22c5fe3a68803a4c4afe41b42774b065e7c6b0e1 | record sha256 8de4ea34…, dataset U12-CEO3-R4-2026-11-05 content sha256 0d34e538… |
| P2 | P2-CEO-CONFIRMED-20261102-R1, revision ad4cc5e906b4 | 3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1 | catalogue-serving.release.json sha256 e6d2711d70a786c52cacfd8aa87d0a4fa60d3529434a732431cacd94e41ceb0b (= R4 p2_input) |

Previous production (rollback target): deployment dpl_ASHYNjuYrunxVL1NeP1Ejb32cZ2B, P5 commit 5356b9e, P1-RELEASE-T1 + P2 635b897 (revision 03089cc2febb).
BMW X1 confirmed price / eligibility: arrives through P2 and P1; applied only with the matching accepted release pair (separate from this release).

## Superseded queue entry: R5 on P2 956a9a7 (never bound; R5 was built on 723748d)

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
