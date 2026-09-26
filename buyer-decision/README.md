# CarIndex — Find My Car, buyer test build (P1.1)

A short consultation: the buyer describes what they need in their own words (EN or Egyptian Arabic), CarIndex asks only the follow-ups that change the answer, shows "Here's what we understood" for confirm/edit, then recommends a few **models** with why each fits, trade-offs, versions and prices, market evidence and next steps.

## Run locally
`node tools/collector.mjs` → prints local/LAN links (and a public tunnel link if `cloudflared` is installed). Events go to `events.ndjson`; live KPIs at `/kpi`.
Tests: `node tests/engine.test.js` · `node tests/e2e.mjs` (Playwright).
Public test site: `python3 tools/build_public.py <out>` (static app + sanitized `data/view.js`; no source names, no pipeline, event sending off, noindex).

## Data (`data/build_p11.py` → `p11_client.js`)
View over existing canonical sources (P0 master + identity layer, P2 buyer view, S5 specs, registration explorer payload) plus curation in `data/curation/` (Drive official price lists for SEAT/CUPRA/Mercedes, model families, registration aliases, Arabic names, body fixes, screened Wikimedia Commons photos).
Universe: 283 new models on sale (193 SUV, 59 sedan, 20 hatch, 11 MPV). Price priority: official list > P2 refresh > 10 Sep snapshot. Gaps: `p11_gaps.json`.

## How the recommendation works (`app/brief.js`, `app/engine.js`)
- Parser: deterministic keyword extraction (budget incl. "مليون ونص", around/max/stretch, body, 7 seats, who it's for, usage, powertrain, Chinese brands, brands, named cars as shortlist / size reference / aspiration, priorities).
- Hard constraints: budget ceiling (around = +10%; max = budget, +10% if stretch), body, 7 seats (confirmed only), Chinese brands, excluded brands, powertrain.
- Budget territory: 80–110% of budget; cheaper cars only when the pool is thin or as one explicit "spend substantially less" option.
- Score = fit to the confirmed brief. Always on: how well the budget's version uses the budget, warranty length (light), established presence in Egypt (registrations per month, saturating at 25/month so it can't become "what sells most"). Only when the brief asks: size vs reference car, space, ease, power, warranty, spend less, popularity, fuel use, hybrid/EV preference, brand preference, what attracts them to an out-of-reach car. Unknown values score the median.
- Reliability, resale, aftersales, safety, comfort, tech, design, brand image: recorded, never scored; shown as "Worth checking before you buy".
- A follow-up is asked only if its answers change the top 3 (usage is usually skipped for that reason).

## Open for the strategy session
- Default "established presence" factor (saturating) — keep, tune or drop.
- Default ±10% band and 80% floor.
- Arabic-first vs device-language default.
- Whether Used/CPO and voice input enter the roadmap (recorded as future directions only; not built).
