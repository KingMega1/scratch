# CarIndex — Find My Car, buyer test build (P1.1)

A short consultation: the buyer describes what they need in their own words (EN or Egyptian Arabic), CarIndex asks only the follow-ups that change the answer, shows "Here's what we understood" for confirm/edit, then recommends a few **models** with why each fits, trade-offs, versions and prices, market evidence and next steps.

## Run locally
`node tools/collector.mjs` → prints local/LAN links (and a public tunnel link if `cloudflared` is installed). Events go to `events.ndjson`; live KPIs at `/kpi`.
Tests: `node tests/engine.test.js` · `node tests/e2e.mjs` (Playwright).
Public test site: `python3 tools/build_public.py <out>` (static app + sanitized `data/view.js`; no source names, no pipeline, event sending off, noindex).

## Data (`data/build_p11.py` → `p11_client.js`)
View over existing canonical sources (P0 master + identity layer, P2 buyer view, S5 specs, registration explorer payload) plus curation in `data/curation/` (Drive official price lists for SEAT/CUPRA/Mercedes, model families, registration aliases, Arabic names, body fixes, screened Wikimedia Commons photos).
Universe: 283 new models on sale (193 SUV, 59 sedan, 20 hatch, 11 MPV). Price priority: official list > P2 refresh > 10 Sep snapshot. Gaps: `p11_gaps.json`.

## How the recommendation works (`app/brief.js`, `app/engine.js` v4: Eligibility → Fit → Challenge)
- **Eligibility** (per model: eligible / ineligible / unknown). Hard constraints: price ceiling (around = +10%; max = budget, +10% only with stretch), body, 7 seats, "no Chinese brands", "X only" brands, excluded brands, excluded powertrains. Unknown critical data never qualifies: a model with unconfirmed seats is not eligible for a 7-seat brief; a version with unknown powertrain is not eligible when a powertrain is excluded. Only eligible models are ranked; a final guard drops anything ineligible from the output.
- **Fit**: only factors the confirmed brief asks for (budget intention, size wanted, size like a reference car, space, ease, spend less, fuel use, powertrain preference, driving pattern, named brands, "prefer not Chinese", premium class for an aspiration, popularity only when asked). No default proxies: horsepower (known for 48/283) and warranty (verified for SEAT/CUPRA only) are not ranking signals. A factor ranks only if ≥80% of the candidates have evidence for it; unknowns take the mean of the known values. The whole budget territory is flat (price position inside it is not fit).
- **Earned winner**: totals within 0.02 are a tie. If more than one car ties at the top, CarIndex does not name a winner: it asks the follow-up whose answers best split the tie (size, what matters most, powertrain, Chinese brands, driving), at most 4 follow-ups; if still tied, it shows up to three equally good options spanning the budget and says so. Tied named cars get a "they fit equally" verdict; a challenger is added only if it fits clearly better.
- **Vehicle character (P1.1 semantic layer, evidence-limited)**: "premium/luxury/فخمة" ranks on the registration segment (luxury class, known for 96% of models); "4x4/AWD/دفع رباعي" is a must-have checked against confirmed drivetrain (known for 46/283, AWD for 8) — unknown never qualifies; "off-road/rugged" triggers the 4WD question and an explicit caveat (ground clearance, low range, construction not in data). "Sporty/driving character", design and technology are recorded as checks, never scored. Space = size class only (seat counts too sparse to reward).
- **Buyer's named cars**: if a confirmed must-have rules them all out, a conflict card says which requirement does it and offers to compare them without it. The seats question warns when 7 seats would rule them out.
- **Challenge**: named cars outside the eligible set (aspirations, over-budget shortlist) are explained in their own card and never recommended. When the buyer names eligible cars, the best of them leads and one challenger is added.
- Cars below 70% of budget appear only in a separate "spend substantially less" card, and only if they fit the stated priorities as well as the lead car.
- Reliability, resale, aftersales, safety, comfort, tech, design, brand image: recorded, never scored; shown as "Worth checking before you buy".
- A follow-up is asked only if its answers change the top 3.
- Tests: `tests/engine.test.js` (parser/engine), `tests/integrity.test.js` (1,500 randomized briefs + hostile + named adversarial briefs; `--print` shows outputs), `tests/e2e.mjs`.

## Open for the strategy session
- Declared default tie-breakers when the brief is silent (size class, warranty, power).
- ±10% stretch; 70% of budget as the line between main recommendations and the "spend less" card (presentation only).
- Arabic-first vs device-language default.
- Whether Used/CPO and voice input enter the roadmap (recorded as future directions only; not built).
