# P1 event needs — input to the Analytics workstream (names NOT final)

P1 will not add or rename events until Analytics sets the canonical taxonomy. This lists what P1 needs to
measure and the data each need carries. Names below are placeholders only.

## Current state (verified 2026-09-27/28)

- Transport: `track.js` beacon → Apps Script → Sheet tab `events`, one row per event.
- Envelope today: `ts, event, session_id, anon_id, lang, viewport, flow_version, engine_version, utm_*, page, referrer, props`.
- Gap: the collector keeps only `utm_source` as a column. `utm_medium`, `utm_campaign`, `utm_content`, `page`,
  `referrer` are sent by the app but dropped. `utm_source` is verified end to end (`chatgpt.com` rows, 27 Sep).
- Prepared fix (not deployed): add those columns to the collector. Needs a new Apps Script deployment by the
  account owner and the Analytics column naming.

## Needs

| Need | Data carried | Today |
|---|---|---|
| Acquisition | utm source / medium / campaign / content, referrer, landing page | partly (source only) |
| Entry mode | free text vs guided vs shared link | yes (`fmc_start.path`) |
| Answers, changes, back / undo | question id, value, previous value, step | answers yes; changes / back no |
| Evidence data gap | model id, missing field, why it mattered (buyer priority), brief hash | no |
| Confidence shown | level (tie / lean / clear / only), depends-on factors | no |
| Narrowing (prototype) | stage, models kept / dismissed / restored, reason asked | no |
| Recommendation interactions | card opened, compare, evidence viewed, alternative chosen | partly |
| Satisfaction | helped yes / somewhat / no, free text | yes |
| Post-recommendation intent | save, share, email, brochure, official source, where to buy | share only |

## Data-gap condition (prepared logic)

Raised once per result when a recommended model lacks evidence for a field the buyer's priorities make relevant
(e.g. `economy` → fuel consumption; `space` → seats / size; any result → official price, official warranty).
Carries: model id, field, priority that required it. Intended consumer: P2 backlog. Event name pending Analytics.
