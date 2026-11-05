# P1 → P5 consumption contract and release gate — U12-CEO3-R4

Owner: P1. Record: `buyer-decision/release/P1-RELEASE-U12-CEO3-R4.json`. Supersedes `P5-HANDOFF-U12-CEO3-R3.md`; every contract rule there (§0–§5, §7) is unchanged except as listed below.
**Status: CANDIDATE. Do not bind in production.** One release gate failed (§3). Production stays on P1-RELEASE-T1.

## 1. What changed vs R3

| Item | R3 | R4 |
|---|---|---|
| P2 input | dfbcccc, revision ac757adcfffb, serving sha256 c4bd33ba… | **3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1**, release P2-CEO-CONFIRMED-20261102-R1, revision **ad4cc5e906b4**, serving sha256 **e6d2711d70a786c52cacfd8aa87d0a4fa60d3529434a732431cacd94e41ceb0b** (Control Tower, P2 owner acceptance 5 Nov) |
| Dataset | U12-CEO3-R3-2026-11-04 | **U12-CEO3-R4-2026-11-05**, 424 identities, 392 recommendable, content sha256 `91b4f81c492fc48998504935d39915351aac5fc4ed184a262d44fa5e07e37736` |
| Engine / transport / schema / app code | E6.1 / T1.2 / ci.reco.v1 | unchanged (same file hashes as R3 closeout fa739f3) |

Data delta: only 5 models change, all Nissan (November 2026 list, MY2027, Tier A):

| Model | R3 from | R4 from |
|---|---|---|
| Sunny | 765,000 | 820,000 |
| Magnite | 819,999 (MY2026) | 860,000 |
| Juke | 1,159,999 | 1,189,999 |
| Qashqai | 1,555,000 | 1,650,000 |
| X-Trail | 1,999,990 | 2,500,000 |

Recommendation effect (57-brief corpus, EN and AR): 15 briefs change, all caused by the 5 Nissan models (12 show a Nissan car before or after; 3 shift through pool scoring). EN and AR results identical in every brief.

## 2. Gate results on R4

| Gate | Result |
|---|---|
| Price parity vs accepted P2 | PASS: 0/269 disagreements (`P2-PRICE-AGREEMENT.json`) |
| Model-year parity | FAIL 1: chevrolet/captiva (see §3) |
| Version parity | Data-level PASS except Captiva. Display note: the engine de-duplicates same-price versions with the same 5-letter label prefix, so Mercedes E-Class "E 200 Saloon / Exclusive" (5,870,000, same as Sport) and Renault Austral "Facelift" duplicates are not listed separately. Pre-existing E6.1 behaviour; the data carries every P2 row |
| Stale-price holds | PASS: Passat MY2026 2,550,000 market only, no MY2023 1,600,000 row; Evoque / Land Cruiser / Camry no market price; Denza never official; GAC GS3 Emzoom held |
| Official / market labels (EN + AR, all 392 models, rendered) | Rendering PASS (784 lists, 0 mismatches). Source FAIL 2: Captiva versions (§3) |
| Regression and AR/EN suites | PASS: regression strict U11 1142/1142 (0 changes), R4 1208/1208; ceo_failures, named_cars, buyer_scenarios, transport, eligibility (4 datasets), u12_data, contracts, engine, integrity, redact ALL PASSED; build_present --check PASS |

Gate tool: `node tools/gates/release_gates.js . datasets/U12-CEO3-R4-2026-11-05 <P2 catalogue-serving.release.json>`; output `datasets/U12-CEO3-R4-2026-11-05/R4-GATES.json`.

## 3. Open gate (blocks ACCEPTED)

**chevrolet/captiva.** P2 accepted only a model-level starting price: EGP 1,400,000, Tier A (official, chevrolet_eg_web, as of 2026-10-13), no model year, no versions. P1 still serves two carried market versions: "LV3 (7 Seats)" and "Premier 7 Seats", both 1,400,000, MY2026, 2026-09-10, `official: false`. Customers see "Market price, not official" and "MY2026" for a price P2 accepted as official with no model year. The from-price itself agrees.

Product decision needed (P1 recommends option a):
- a. Replace the two carried versions with one `Unspecified trim` at 1,400,000, `official: true`, no model year, `price_from_only` (the existing BMW 7 Series rule).
- b. Keep both version names and mark them official at 1,400,000 (version names are not on the official source).
- c. Waive: keep them as market prices.

## 4. P5 binding checks (when accepted)

- `T.ENGINE_VERSION === 'E6.1-2026-10-14'`, `T.TRANSPORT_VERSION === 'T1.2-2026-11-03'`
- `ds.universe_version === 'U12-CEO3-R4-2026-11-05'`, `ds.sha256 ===` record `dataset.content_sha256`
- sha256 of every vendored file matches the record.
