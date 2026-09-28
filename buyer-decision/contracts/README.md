# P1.2 data contracts (draft, for P2 / CEO review)

P1 consumes these; it does not produce or infer them. Status: draft, not wired into the app or engine.

## 1. Market status (owner: P2)

One record per model. P1 reads `status` and never infers availability itself.

| Field | Type | Notes |
|---|---|---|
| `model_id` | string | CarIndex model id, e.g. `byd/ti-7` |
| `status` | `official` \| `grey` \| `announced` \| `discontinued` \| `unverified` | `unverified` = insufficient current evidence to determine Egyptian-market commercial status at the required confidence. It does **not** mean unavailable. |
| `confidence` | number 0–1 | P2 methodology |
| `as_of` | date | freshness is judged by P2 thresholds |
| `evidence` | array of `{type, source, date}` | e.g. distributor site, registrations, dealer listing |

P1 behaviour per status is one config table (proposal; needs CEO approval):

| Status | Main recommendation | Shown as |
|---|---|---|
| official | yes | — |
| grey | proposal: yes, flagged | "Not sold through the official distributor" |
| unverified | proposal: yes, flagged | "Availability not yet confirmed" |
| announced | no | may appear in "coming soon" context only |
| discontinued | no | explained if the buyer names it |

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
- Existing `usage` (city / mixed / long) stays and feeds the same fit.

Questionnaire impact (no new mandatory question):

1. Existing question, relabelled answers: "Open to fully electric" / "Only if I can charge at home" / "No — hybrid or petrol is fine" / "Petrol only".
2. Only after "No", and only when it changes the result (existing materiality check): "Main reason?" range / charging / cost / resale / not sure.
3. Free text fills the same fields ("مش عايز كهربا عشان الشحن" → `avoid_bev` + `charging_access`).
