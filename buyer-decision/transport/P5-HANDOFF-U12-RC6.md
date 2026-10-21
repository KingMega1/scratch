# P1 → P5 consumption contract and release gate — U12-RC6

Owner: P1. Record: `buyer-decision/release/P1-RELEASE-U12-RC6.json`. Supersedes `P5-HANDOFF-U12-RC4.md`. Engine, parser and transport are identical to RC4; `i18n.js` adds body labels (coupe, convertible, van); the dataset applies the CEO decisions of 2026-10-21.
**Status: CANDIDATE. Do not bind in production.** Production stays on `P1-RELEASE-T1` (engine E6-2026-09-28, transport T1-2026-10-07, dataset U11-2026-09-26) until every gate in §6 is closed.

The base contract in `transport/P5-INTEGRATION.md` (ci.reco.v1, normalize() before execute(), privacy, §8 rendering outside the browse projection) is unchanged. This note lists only the differences from T1.

## 1. What changes

| Item | T1 (production) | U12-RC6 |
|---|---|---|
| `engine_version` | E6-2026-09-28 | E6.1-2026-10-14 (ranking unchanged) |
| `transport_version` | T1-2026-10-07 | T1.1-2026-10-15 |
| `schema` | ci.reco.v1 | ci.reco.v1 (unchanged) |
| Dataset | U11-2026-09-26, 283 recommendable | U12-RC6-2026-10-21, 419 identities, 387 recommendable |
| P2 input | — | aadc647 (handoff p1-release-20261021), serving release P2-CATALOGUE-U11-2026-10-21-RC2, sha256 49756cd3…2ec4 |

## 2. Files to re-vendor (verify each sha256 against the record)

- `app/engine.js`: a held market car reports `unknown_size` / `scope`, never `not_on_sale`.
- `app/brief.js`: the model-name index is rebuilt when the dataset changes; brand-prefixed 4-digit names (Peugeot 3008/5008) are recognised.
- `app/i18n.js`: contains six DRAFT strings pending P3 (§6 gate 1). Its hash will change once P3 approves.
- `transport/reco.js`: T1.1. `compare_html` is `null` when the result is a single car with no alternatives, as in the released app. The schema already allows null.
- `datasets/U12-RC6-2026-10-21/{manifest.json, recommendation_view.json}`: new.
- Unchanged: `app/present.js`, `app/app.js`, `transport/ci.reco.v1.schema.json`.

## 2a. CEO decisions in this dataset (2026-10-21)

- Cars with no accepted price use P2's held market prices: 22 cars. They are shown as market prices (`official: false`, `date` = when seen).
- Cars without a size class are recommended. Their size is unknown (`segment` empty). The engine's approved handling applies, and no size/space factor was dropped in 97 test briefs.
- Coupes, convertibles and vans are recommended like any passenger car. `body` can be `coupe`, `convertible` or `van`, with EN/AR labels in `i18n.js`.
- CEO price overrides (`tools/ceo_price_overrides.json`): Evoque, Land Cruiser and Camry have no market price; Denza prices are never official.

## 3. Dataset fields P5 must pass through unchanged

Every field the transport reads must survive the Postgres serving projection.
- `u: true` with empty `trims`: on the market, no current price. Engine reports `unknown_price`, never recommended (31 identities).
- `u: false` with no `held`: off sale by P2/CEO decision (geely/emgrand-7, discontinued 21 Oct). Engine reports `not_on_sale`. Note: it is recommendable in production U11 today.
- `held: 'size'` / `held: 'scope'`: still supported by the engine, but **no car in RC6 carries them** (CEO decisions above).
- Version `year: null` with `official: true` and `date`: an official dated list with no model year stated (e.g. Mercedes-Benz Egypt 24.09.2026, Mansour/MG 15.10.2026; 23 models). Render "official price, list dated <date>". Do not invent a model year. `model_year` is null for these models, so hide the year row.
- `ar.model` (array): Arabic model names. U12 (since RC3) adds 57 P2-accepted names (P2 registry `arabic_names.csv` / `u11_models.csv model_ar`). The field already exists, so there is no contract extension.

## 4. Arabic names: consumption route

**Decision: consume through the existing identity record (`ar.model` in the recommendation view). No serving-contract extension is needed for P1 or P5.**
- P1's build reads P2's accepted registry (status ACCEPT only) and writes into `ar.model`. The parser already indexes it, and P5 needs no code change.
- Backward-compatible improvement requested from P2: publish `ar: {brand, model}` on `market_additions` in `catalogue-serving.release.json`, as core entries already do. P1 can then drop the registry read. This is not a blocker.
- Coverage in RC4 (unchanged from RC3): top-40 popular models, full Arabic 31/40 (was 29); 92 launch-flagged, full Arabic 18/92 (was 4).

## 5. Version checks P5 must enforce on binding

- `T.ENGINE_VERSION === 'E6.1-2026-10-14'`
- `T.TRANSPORT_VERSION === 'T1.1-2026-10-15'`
- `ds.universe_version === 'U12-RC6-2026-10-21'`
- `ds.sha256 ===` the `dataset.content_sha256` in the record
- The sha256 of every vendored file matches the record.

Results stored under T1/U11 are historical: recompute them from `share.r` and label them as recomputed.

## 6. Release gate: all must be closed before P5 binds

1. **Copy approval (CEO, in P1 session):** `conflict_h` approved. With the 2026-10-21 decisions, the size and scope strings are no longer shown (no car carries `held`). Still open: the no-price wording (`conflict.unknown_price`, `sl_out.unknown_price`), shown only for the 31 cars without a price. P1 then reissues the record with the final `i18n.js` hash.
2. **Release authority acceptance** of engine E6.1, transport T1.1 and dataset U12-RC6. Closed since RC3: target universe (broad set, owner instruction 17 Oct) and official MG trims (P2 20 Oct: list only).
3. **P1 test evidence on the final hashes**:
   - regression 1219/1219 (U11 1142/1142, 0 changes)
   - eligibility on 9 datasets 3106/3106 (949/949 on the original 3)
   - u12_data 191/191
   - named_cars 49/49
   - buyer_scenarios 690/690 (42 EN/AR scenarios)
   - transport 1517/1517
   - browser-vs-transport 1347/1347 (RC6) and 1335/1335 (U11)
   - build_present --check PASS
4. **P5 integration**: re-vendor, version checks, deployed EN/AR smoke on the RC4 binding, including one single-car result (`7-seater around EGP 1M` → BAW M7, no compare table).

## 7. Acceptance commands (from `buyer-decision/`)

```
node tools/build_present.mjs --check
CI_DATASET=datasets/U12-RC6-2026-10-21/recommendation_view.json node tests/regression/run.js
node tests/eligibility.test.js datasets/U11-2026-09-26 datasets/U12C-2026-10-14 datasets/U12C2-2026-10-14 datasets/U12C2-RC1-2026-10-14 datasets/U12C2-RC2-2026-10-14 datasets/U12-RC3-2026-10-15 datasets/U12-RC6-2026-10-21
node tests/u12_data.test.js datasets/U12-RC6-2026-10-21
node tests/named_cars.test.js datasets/U12-RC6-2026-10-21
node tests/buyer_scenarios.test.js datasets/U12-RC6-2026-10-21
node tests/transport/transport.test.js
node tests/transport/browser_equivalence.mjs <build of RC4> datasets/U12-RC6-2026-10-21
```
