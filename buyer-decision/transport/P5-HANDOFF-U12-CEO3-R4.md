# P1 → P5 consumption contract and release gate — U12-CEO3-R4

Owner: P1. Record: `buyer-decision/release/P1-RELEASE-U12-CEO3-R4.json`. Supersedes `P5-HANDOFF-U12-CEO3-R3.md`; every contract rule there (§0–§5, §7) is unchanged except as listed below.
**Status: ACCEPTED by the release authority (CEO), 2026-11-05.** All P1 gates pass (§2). P5 may bind it after its own integration checks (§4). P1 made no production deployment.

## 1. What changed vs R3

| Item | R3 | R4 |
|---|---|---|
| P2 input | dfbcccc, revision ac757adcfffb, serving sha256 c4bd33ba… | **3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1**, release P2-CEO-CONFIRMED-20261102-R1, revision **ad4cc5e906b4**, serving sha256 **e6d2711d70a786c52cacfd8aa87d0a4fa60d3529434a732431cacd94e41ceb0b** (Control Tower, P2 owner acceptance 5 Nov) |
| Dataset | U12-CEO3-R3-2026-11-04 | **U12-CEO3-R4-2026-11-05**, 424 identities, 392 recommendable, content sha256 `0d34e538944e02cf2244505902c095e77d3b2df552fc980bfb43ba292a6ecddb` |
| Engine / transport / schema / app code | E6.1 / T1.2 / ci.reco.v1 | unchanged (same file hashes as R3 closeout fa739f3) |

Data delta: 6 models change. Five Nissan models (November 2026 list, MY2027, Tier A):

| Model | R3 from | R4 from |
|---|---|---|
| Sunny | 765,000 | 820,000 |
| Magnite | 819,999 (MY2026) | 860,000 |
| Juke | 1,159,999 | 1,189,999 |
| Qashqai | 1,555,000 | 1,650,000 |
| X-Trail | 1,999,990 | 2,500,000 |

Chevrolet Captiva (CEO decision A, 5 Nov): P2 accepted only an official (Tier A) starting price, EGP 1,400,000, no model year. The two carried market versions (LV3 (7 Seats), Premier 7 Seats, MY2026, 1,400,000) are replaced by one `Unspecified trim`, 1,400,000, `official: true`, `year: null`, `price_from_only: true` (same rule as BMW 7 Series). Builder rule: a Tier A model-level price replaces every carried version; only Captiva is affected. `model_year` is null, so hide the year row.

Recommendation effect (57-brief corpus, EN and AR): 15 briefs change, all caused by these 6 models (12 show one of them before or after; 3 shift through pool scoring). EN and AR results identical in every brief.

## 2. Gate results on R4 (final hashes)

| Gate | Result |
|---|---|
| Price parity vs accepted P2 | PASS 0/269 (`P2-PRICE-AGREEMENT.json`) |
| Model-year parity | PASS 0 mismatches |
| Version parity (data rows of the current model year vs P2) | PASS 0 mismatches |
| Stale-price holds | PASS: Passat MY2026 2,550,000 market only, no MY2023 1,600,000 row; Evoque / Land Cruiser / Camry no market price; Denza never official; GAC GS3 Emzoom held |
| Official / market labels | PASS: data vs P2 tier 0 mismatches; rendered EN + AR for all 392 models (784 lists) 0 mismatches |
| Regression | strict U11 1142/1142 (0 changes); R4 1208/1208 |
| AR/EN suites | ceo_failures 135/135 · named_cars 49/49 · buyer_scenarios 691/691 · transport 1517/1517 · browser-vs-transport 1405/1405 (R4) and 1335/1335 (U11) · eligibility 1447/1447 (4 datasets) · u12_data 198/198 · contracts, engine, integrity, redact PASS · build_present --check PASS |

Gate tool: `node tools/gates/release_gates.js . datasets/U12-CEO3-R4-2026-11-05 <P2 catalogue-serving.release.json>` → `R4-GATES.json`.

Display note (info, not a gate): the engine lists same-price versions with the same 5-letter label prefix once. Mercedes E-Class "E 200 Saloon / Exclusive" (5,870,000, same as Sport) and Renault Austral "… Facelift" rows are not listed separately; the data carries every P2 row. P2 data issue: Austral carries both "Esprit Alpine" and "Espirit Alpine" (1,890,000), so both appear.

## 3. Decisions closed

- Captiva official/model-year label: CEO decision A (5 Nov), applied above.
- Copy gate: closed in R3 (no DRAFT strings).

## 4. P5 binding checks

- `T.ENGINE_VERSION === 'E6.1-2026-10-14'`, `T.TRANSPORT_VERSION === 'T1.2-2026-11-03'`
- `ds.universe_version === 'U12-CEO3-R4-2026-11-05'`, `ds.sha256 ===` record `dataset.content_sha256`
- sha256 of every vendored file matches the record.
