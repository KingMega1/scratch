# CarIndex — Find My Car, buyer test build (v2)

"About EGP 2M for an SUV — what should I buy?" One pick, 2–3 real alternatives, the evidence behind them. EN + AR (RTL). **Not deployed.**

## Run a buyer test (5–10 people)

Needs Node.js 18+ on one laptop. From this folder:

```
node tools/collector.mjs
```
It prints the links to give testers and keeps a record of every session in `events.ndjson`:
- **Same Wi-Fi (in-person tests):** give testers the `http://<laptop-ip>:8787/` link. Add `?lang=ar` for Arabic; the header button also switches language.
- **Remote testers:** install `cloudflared` (`brew install cloudflared` or `winget install Cloudflare.cloudflared`) and rerun. A public `https://….trycloudflare.com/` link is printed. It works while the laptop is on.
- **Live KPIs while you watch:** `http://localhost:8787/kpi` (refreshes every 15 s). Raw events: `/events.ndjson`.

Tests: `node tests/engine.test.js` · `node tests/e2e.mjs` (needs Playwright).

## Data (consumed, not rebuilt)

`data/p2_view.v1.js` is P2's canonical buyer view `carindex.p1.buyer_view/v2` (branch `claude/carindex-buyer-vehicle-data-97yinp`, `vehicle-data/views/p1_suv_2m.json` + `review/review_queue.csv`). `data/adapt_p2.py` passes it through unchanged except for display labels, trim powertrain read from the trim's own label, and warranty years. The P2 SHA-256 is recorded in `meta`.
Universe: P2's 21 in-slice SUVs. The 3 models P2 marks `in_slice=false` are not shown.

## How the pick works (`app/engine.js`)

- **Rank = fit to the buyer's answers only**: how well it uses the budget (or money left over, if the buyer asks for that), powertrain vs. driving pattern, warranty, and registrations only if the buyer asks for "what most Egyptians buy". **Source coverage never enters the score.** A missing field scores the universe median. A test asserts that the order stays identical when every price is flipped to single-source or to fully agreed.
- **Confidence = how the pick is worded, never its rank.** Trim price AGREED/NEAR → strong; SINGLE_SOURCE or single-source model → fair; CONFLICT → thin. Wording: *Our pick* (strong, lead ≥3%) · *Our pick — by a small margin* · *Best match — confirm the price first* (thin).
- Questions: seats (5/7) · driving pattern · charging (asked only when an EV fits) · powertrain (skipped when it can't change the result) · up to 2 priorities.

## Events (schema EV2, `app/track.js`)
`fmc_view, fmc_start, q_view, q_answer, q_skipped, q_back, result_view{mode, confidence, margin, …}, no_match_view, relax_apply, alt_promote, evidence_open, compare_view, cta_click, edit_answer, restart, lang_switch, feedback_view, feedback_answer, feedback_text, exit`. Every event carries session, anon id, lang, viewport, flow/engine/universe versions and UTM tags.

## Open for the strategy session (not decided in this build)
- SUV-only scope (P2 slice definition) vs. including sedans/hatchbacks.
- Whether registrations/popularity should weigh on ranking by default (today: only if the buyer picks "What most Egyptians buy").
- Default recommendation philosophy: the pick uses the version that makes most of the budget unless the buyer asks to keep money.
- Arabic-first vs. device-language default; Arabic register (decision log C-07).
