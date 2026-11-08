# P1 → P5 consumption contract and release gate — U12-CEO3-R5

Owner: P1. Record: `buyer-decision/release/P1-RELEASE-U12-CEO3-R5.json`. Supersedes `P5-HANDOFF-U12-CEO3-R4.md`; every contract rule there is unchanged except as listed below.
**Status: CANDIDATE. Do not bind in production.** P1 made no production deployment.

## 1. Bind together (one change)

P5 must move **both** sides in one change: P1 R5 and P2 `723748d`. Its parity smoke test fails if only one side moves.

| Item | Value |
|---|---|
| P2 commit | `723748dfd32a7b88ef56b3bc55893fdd19ed7a0c` (frozen; not the moving branch) |
| P2 release / revision | `P2-CEO-CONFIRMED-20261102-R1` / `cddfe91b3287` |
| Dataset | `U12-CEO3-R5-2026-11-08`, 425 identities, 396 recommendable |
| Dataset file sha256 | `649bc8e5c0eaa61c3038fd53b9142ab8b29c5a246fe4eae2f9b0a3a98f721865` |
| Dataset content sha256 (`ds.sha256`) | `b136d0e66fd9dda89c31c0ac5c46116d090a68f0756baa2e99e08f8da2b0046a` |
| Engine / transport / schema | E6.1-2026-10-14 / T1.2-2026-11-03 / ci.reco.v1 (unchanged) |

P2 input files (copied from `723748d`):

| File | sha256 |
|---|---|
| `catalogue-serving.release.json` | `02139f4146067089942fcdcc945e4008ad567a12095f84a3f0fc993c1c4f3a81` |
| `market_universe.json` | `733bc13bfffec4033e38381c736ec74c6b42bd65f9a91d35408edf459324439d` |
| `registration_models.csv` | `e6f43df6596f3fe38f4b13f9afb7d24663379fc96db31cfb5a588f17a94571af` |
| `u11_models.csv` | `97130c17516a5e1edbbe38f94048d9ff4397121011198ab90ff721ec15a20f98` |
| `arabic_names.csv` | `91a7d71b7165da6a9b87544b2a0eb6dc1d1aaa4253ce063fce283e8a6429c188` |
| `u11_prices.csv` | `62972049af7785f95bbcf903caa66a80647815d0d082f87a82804afce8279bd7` |

CEO-confirmed price IDs now carry `ceo1102-`, `ceo1104-` and `ceo1108-`. Widen the P5 `ceo1102-` test to `/^ceo\d{4}-/`, keeping the provenance check.

## 2. What changed vs R4

- **P1-MAP-01** (P2 patch `vehicle-data/handoff/patches/p1-build_u12-p2-price-canonical-20261103.patch`): already in the P1 builder since 7111835 (R2); every line present.
- **26 models change price** (P2 handoff `p1-release-20261108.json`): Changan CS55 Plus, CS75 Plus; Chery Arrizo 5, Tiggo 7 Pro, Tiggo 8; Geely Coolray, Emgrand (Auto Mobility CKD versions next to Abou Ghaly); Haval H6, H7, Jolion, V7; Hyundai Elantra, IONIQ 9, Tucson, Venue; Jetour T2 (Matte Color 1,930,000); Lexus LX, RX (new), RZ; Toyota bZ4X, Camry (new price), Corolla, Fortuner, Land Cruiser (new price), Land Cruiser Prado (new price), RAV4.
- **New identity** `lexus/rx` (P2 m_000427): RX350h AWD Hybrid 9,100,000; RX350 AWD F-Sport 10,400,000 (MY2027, official).
- **`lexus/lx600` displays as "LX"** (id unchanged; `tools/ceo_fact_decisions.json` → `display_name`). From 15,600,000 (LX700h hybrid) to 18,900,000.
- **Version powertrain from the version's own P2 label** (new builder rule, reversible `CI_LABEL_PT=0`): a version stored as petrol/diesel whose label says HEV/PHEV/REEV/EV/`…h` hybrid is typed accordingly. 4 models: Haval V7 (HEV, PHEV Hi4), Kia Carnival HEV, Hyundai Staria HEV, Lexus LX700h. Before, a "no hybrid" buyer could be shown these. Blank powertrains stay unknown.
- Kept: Passat at the CEO-approved U11 market price (EGP 2,550,000, MY2026, not official; P2 serves no price); Peugeot 2008 MY2027 from 1,499,990; Chery Tiggo 8 Pro and eQ7 as served.

## 3. P1 evidence on R5

| Check | Result |
|---|---|
| P2 `check_p1_price_agreement.py` (from 723748d) | **0/275 disagreements** (BMW 7 Series and Captiva also agree: their single model-level "from" entry equals P2's) |
| Release gates (price, model year, versions, holds, official/market labels EN+AR) | PASS, 0 failures; 792 rendered lists |
| Regression | U11 strict 1142/1142 (0 changes); R5 1220/1220 |
| ceo_failures / named_cars / buyer_scenarios | 135/135 · 49/49 · 691/691 |
| u12_data / ceo_intake (P2 dir) | 195/195 · PASS (73 models, 169 rows, all price IDs `ceo\d{4}-`) |
| eligibility (4 datasets) / transport | 1451/1451 · 1517/1517 |
| contracts, engine, integrity, redact | PASS |
| browser vs transport | R5 1405/1405 · U11 1335/1335 |
| build_present --check | PASS |

Display note (info): the engine lists same-price versions with the same 5-letter label prefix once (Geely Coolray "Sport + (Auto Mobility CKD)" = Sport GF Plus 1,199,000; Mercedes E-Class Exclusive; Renault Austral Facelift rows). The data carries every P2 row.

## 4. P5 binding checks

- `T.ENGINE_VERSION === 'E6.1-2026-10-14'`, `T.TRANSPORT_VERSION === 'T1.2-2026-11-03'`
- `ds.universe_version === 'U12-CEO3-R5-2026-11-08'`, `ds.sha256 === 'b136d0e66fd9dda89c31c0ac5c46116d090a68f0756baa2e99e08f8da2b0046a'`
- P2 serving sha256 `02139f4146067089942fcdcc945e4008ad567a12095f84a3f0fc993c1c4f3a81`
- sha256 of every vendored file matches the record.
