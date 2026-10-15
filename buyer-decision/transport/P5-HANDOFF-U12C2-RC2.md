> **Superseded by `P5-HANDOFF-U12-RC3.md`.**

# P1 → P5 integration handoff — U12C2 release candidate (RC2)

Owner: P1. Task: P1-READINESS-02. Record: `buyer-decision/release/P1-RELEASE-U12C2-RC2.json`. Supersedes RC1 (`P5-HANDOFF-U12C2-RC1.md`); code is identical, only the dataset changed.
**Status: CANDIDATE. Do not bind in production.** Production stays on `P1-RELEASE-T1` (engine E6-2026-09-28, dataset U11-2026-09-26) until (1) P3 approves the DRAFT copy keys below and (2) the release is accepted. P1 will then issue the final record with the approved `i18n.js` hash.

The contract in `transport/P5-INTEGRATION.md` (ci.reco.v1, privacy, version checks, §8 rendering outside the browse projection) is unchanged. This note lists only what differs from T1.

## 1. What changes

| Item | T1 (production) | RC2 |
|---|---|---|
| `engine_version` | E6-2026-09-28 | E6.1-2026-10-14 |
| `transport_version` / `schema` | T1-2026-10-07 / ci.reco.v1 | unchanged |
| Dataset | U11-2026-09-26 (283 in universe) | U12C2-RC2-2026-10-14 (416 identities from P2 ae88ec3; 325 recommendable) |
| Ranking | — | unchanged (1,194/1,194 invariants) |

## 2. Files to re-vendor (verify each sha256 against the RC2 record)

- `app/engine.js` — changed. A known market car that is held out of the set now reports its true reason (`unknown_size` / `scope`), not `not_on_sale`. Ranking is untouched.
- `app/brief.js` — changed. The model-name index is rebuilt whenever the dataset's model list changes (needed when one process loads U11 and RC2). Brand-prefixed 4-digit names are recognised (Peugeot 3008/5008).
- `app/i18n.js` — changed. Includes DRAFT copy (see §4). The final hash will change after P3 approval.
- `app/present.js`, `app/app.js`, `transport/reco.js`, `transport/ci.reco.v1.schema.json` — unchanged.
- `datasets/U12C2-RC2-2026-10-14/{manifest.json, recommendation_view.json}` — new.

## 3. Dataset fields P5 must pass through unchanged

- `u: true` with empty `trims` — the car is on the market but P2 has no price. The engine reports `unknown_price`. It is never recommended. This applies to 48 identities, including Denza B3/B5/B8 (grey imports), Range Rover, Land Cruiser, GLC with EQ Technology and Kia Carnival.
- `held: 'size'` — the car is priced but P2 has no confirmed size class. The engine reports `unknown_size`. It is never recommended (31 identities, including Geely EX5 EM-i).
- `held: 'scope'` — coupe or convertible. The engine reports `scope` (12 identities).
- If the serving projection drops `held` or `u`, these cars fall back to the wrong message. Include both fields in the Postgres projection.

## 4. Copy keys pending P3 (EN/AR, exact once approved)

`conflict_h`, `conflict.unknown_price`, `conflict.unknown_size`, `conflict.scope`, `sl_out.unknown_size`, `sl_out.scope`. The drafts and their rationale are in `datasets/U12C2-RC2-2026-10-14/P3-COPY-REQUEST.md`. Do not hard-code them in P5. They arrive through `notices[]` / `html` as usual.

## 5. Version checks (same as T1 §5, new values)

On binding RC2, verify:
- `T.ENGINE_VERSION === 'E6.1-2026-10-14'`
- `ds.universe_version === 'U12C2-RC2-2026-10-14'`
- `ds.sha256 === 'a0b1cc2e5ea7926bd8591bd9cf290185f374ffab8d1f5771913e6ac8706ce5ef'`

Results stored under T1/U11 are historical. Re-run them from `share.r` and label them as recomputed.

## 6. Acceptance evidence

From `buyer-decision/`:

```
node tools/build_present.mjs --check
CI_DATASET=datasets/U12C2-RC2-2026-10-14/recommendation_view.json node tests/regression/run.js   # 1194/1194
node tests/eligibility.test.js datasets/U11-2026-09-26 datasets/U12C-2026-10-14 datasets/U12C2-2026-10-14 datasets/U12C2-RC1-2026-10-14 datasets/U12C2-RC2-2026-10-14   # 1623/1623
node tests/named_cars.test.js        # 49/49 (+1 reported data gap: Arabic "لاند كروزر")
node tests/transport/transport.test.js   # 1517/1517
```

Test build (no tracking): https://kingmega1.github.io/carindex-buyer-test/u12c2/app/index.html
