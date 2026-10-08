# AT-43 P0 — Recommendation universe vs website catalogue (2026-10-08)

Computed from the two pinned datasets in this repo; no data was changed.

| Side | Dataset | Version | Hash / commit |
|---|---|---|---|
| Website catalogue (browse, Car Detail, Compare) | `data/registry/universe.snapshot.json` (P2 `vehicle-data/views/p1_suv_2m.json`) | `suv_2m_v1/S6_2026-09-30`, snapshot `suv_2m_v1/S6_2026-09-30@6f3df7dc12bd`, synced 2026-10-07T07:39:24Z | commit `6f3df7dc12bd389d924ad9a74cad1c0533913cf7` |
| Find My Car (P1-RELEASE-T1) | `p1-release/.../U11-2026-09-26/recommendation_view.json` | `U11-2026-09-26` (393 models, 283 on sale) | content sha256 `5348da57…` |

## Findings

**Identifiers.** No canonical crosswalk exists:
- The website uses P2 `model_id` `m_0000NN` (`id_status: PROVISIONAL`) and slug `brand-model`.
- P1 uses `brand/model`.
- P5 currently joins the two by converting the slug and checking that the names match. Nothing is substituted when they don't match.

**Coverage**

| Bucket | Count | Models |
|---|---|---|
| Site model, P1 on sale (linked) | 18 | kia-sportage, hyundai-tucson, volkswagen-tiguan, jetour-t2, mitsubishi-eclipse-cross, peugeot-3008, nissan-qashqai, opel-grandland, jetour-t1, baic-bj30, mg-hs, chery-tiggo-8-pro-max, renault-austral, peugeot-5008, kia-seltos, kgm-torres, byd-sealion-6, haval-h7 |
| Site model, **absent from U11** (FMC can never recommend it) | 3 | soueast-s06 (m_000019), soueast-s09 (m_000013), deepal-s05 (m_000021) |
| Site model, in U11 but **not on sale** | 3 | byd-song-plus (m_000010), citroen-c5-aircross (m_000008), byd-song-l-dm-i (m_000024) |
| P1 on-sale model **with no Car Detail page** | 265 of 283 | — |

**Prices (price-from, 18 linked models).** Site and U11 values are identical for all 18 (difference 0). There is no price drift today. Provenance differs on two models:
- hyundai-tucson: the site shows **CONFLICT**; FMC shows 1,775,000 with no conflict marker. P1's data has no conflict state.
- mg-hs: the U11 trim date is 2026-09-10. FMC marks it `stale` under the 14-day rule; the site uses S6 (30 Sep).

## P5 behaviour now (no substitution, no fabricated pages)
- Every P1 recommendation is shown from ci.reco.v1 in P1 order.
- The site link is shown only for the 18 linked IDs. Every other car shows "Car page not on the site yet".

## Required from P2 (with P1 for the universe)
1. A canonical model ID registry with a published crosswalk `{p2_model_id, p1_id, site_slug, status}`, versioned.
2. A single serving release that both surfaces consume: the recommendation universe and the browse catalogue, built from the same P2 snapshot with the same version ID. Alternatively, an explicit declared subset relation.
3. Decide for the 3 site models absent from U11 and the 3 not on sale: add them to the universe, or remove them from the catalogue.
4. Car Detail coverage for recommended models. Either P2 publishes catalogue entries for the U11 on-sale set, or P1 scopes the launch universe to the published catalogue (a P1 semantic decision).
5. Carry price-conflict state into the recommendation view (Tucson case). This is a P1 view schema change.

## Save to My CarIndex (separate from Share)
- **Share (working):** a `?r=` token containing SHARE_KEYS only.
- **Save, minimum safe option:** "Saved on this device". Store `{share.r, result_id, engine_version, universe_version, saved_at}` in `localStorage`. No account, no server storage, no PII.
  - It reopens through the existing `shared` route, which recomputes on the live binding.
  - If the saved `engine_version` or `universe_version` differs from the live binding, label the result "recomputed" (P5-INTEGRATION §7).
- **Account Save stays behind `FEATURE_CUSTOMER_PII`.** It needs the existing identity/OTP route and a privacy decision.
- **Not built.** It needs P3 copy and placement in My CarIndex (approved IA) before implementation.

## Arabic price presentation
- Brand V2 (skill v0.7 / brand v2.0-draft.10) requires `1,895,000 ج.م` and the short form `1.9 مليون ج.م`.
- P1 engine-owned copy (`app/i18n.js`, `S.ar.egp` / `S.ar.mill`) renders `… جنيه` / `… مليون جنيه`.
- P5 must not rewrite engine-owned copy. The fix belongs to P1:
  1. P1 changes the AR currency templates only, with no semantic change.
  2. P1 issues a new release record with the new `i18n.js` and `present.js` hashes.
  3. P5 re-vendors with `scripts/vendor-p1-release.mjs` and updates `BOUND`.
- Website-owned prices already use `ج.م`.
