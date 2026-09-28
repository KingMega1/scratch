# P1.2 data contracts (draft, for P2 / CEO review)

P1 consumes these; it does not produce or infer them. Status: approved contracts; adapters in `app/contracts.js` (tests: `tests/contracts.test.js`). Not loaded by the app, not used by the engine.

## 1. Market status (owner: P2)

One record per model. P1 reads `status` and never infers availability itself.

| Field | Type | Notes |
|---|---|---|
| `model_id` | string | CarIndex model id, e.g. `byd/ti-7` |
| `status` | `official` \| `grey` \| `announced` \| `discontinued` \| `unverified` | `unverified` = insufficient current evidence to determine Egyptian-market commercial status at the required confidence. It does **not** mean unavailable. |
| `confidence` | number 0–1 | P2 methodology |
| `as_of` | date | freshness is judged by P2 thresholds |
| `evidence` | array of `{type, source, date}` | e.g. distributor site, registrations, dealer listing |

P1 placement per status (CEO decision 2026-09-28; `MARKET_POLICY` in `app/contracts.js`):

| Status | Placement |
|---|---|
| official | eligible for main recommendations |
| grey | conditionally eligible, clearly flagged, only when P2 marks the evidence sufficient (`grey_sufficient`) |
| unverified | not eligible for main recommendations (not the same as unavailable) |
| announced | may appear separately as "worth waiting for" |
| discontinued | excluded from normal new-car recommendations |

The gate is **not active**. It may only act on a dataset P2 marks `audited: true` and after an explicit switch
(`gateActive(dataset, enabled)`). Today every model reads `unverified` (no dataset), which would remove all
recommendations — the regression report shows this in shadow (`shadow_market_not_main`).

## 2. Registration signals (owner: P2)

Separates the three meanings registrations currently mix.

| Field | Meaning | P1 use |
|---|---|---|
| `existence.last12`, `existence.first_month`, `existence.last_month` | evidence the model is being sold | input to P2's market status only |
| `adoption.segment`, `adoption.percentile_in_segment` | popularity normalised within segment | the buyer's "popular" priority; display |
| `trend` (later) | velocity, P2-defined | not used until defined |

## 3. Powertrain technology (owner: P2 data, P1 logic)

Per trim: `tech` = `ICE` \| `HEV` \| `PHEV` \| `REEV` \| `BEV` \| `unknown`, with `tech_evidence`.
Today's data has only `petrol` / `hybrid` / `ev` (+ `plugin` on 16 models), so HEV / PHEV / REEV cannot be told apart.

## 4. Buyer Brief — powertrain intent (P1)

Vehicle technology and buyer intent are separate. The brief records intent; the engine maps it to technologies.

```json
"powertrain": {
  "stance": "open | prefer_electrified | avoid_bev | ice_only",
  "excluded": ["BEV"],
  "preferred": ["HEV"],
  "concerns": ["range", "charging_access", "running_cost", "maintenance_cost", "long_distance", "resale", "tech_risk"],
  "home_charging": "yes | no | unknown",
  "source": { "stance": "stated | asked", "concerns": "stated | asked | inferred" }
}
```

- `excluded` holds only technologies the buyer explicitly refused (hard constraint). Everything else is fit.
- `concerns` shape fit per technology, e.g. `range` / `long_distance` lower BEV fit but not REEV / PHEV; `charging_access` + `home_charging: no` lowers BEV and PHEV benefit; `running_cost` raises HEV / PHEV / REEV / BEV.
- Existing `usage` (city / mixed / long) is reused: `long` becomes the `long_distance` concern; no duplicate question.
- Adapter: `powertrainIntent(brief)` derives this block from today's brief fields; `trimTech()` maps today's tags and marks HEV / PHEV / REEV as unresolved; `techAllowed()` returns true / false / null (unresolved).

Questionnaire impact (no new mandatory question):

1. Existing question, relabelled answers: "Open to fully electric" / "Only if I can charge at home" / "No — hybrid or petrol is fine" / "Petrol only".
2. Only after "No", and only when it changes the result (existing materiality check): "Main reason?" range / charging / cost / resale / not sure.
3. Free text fills the same fields ("مش عايز كهربا عشان الشحن" → `avoid_bev` + `charging_access`).
