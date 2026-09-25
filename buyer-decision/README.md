# CarIndex — Find My Car, buyer test build (v2)

"About EGP 2M for an SUV — what should I buy?" One pick, 2–3 real alternatives, the evidence behind them. EN + AR (RTL). **Not deployed.**

## Run a buyer test

```
node tools/collector.mjs 8787 events.ndjson     # serves the app + records events
```
1. In `app/index.html`, set `<meta name="ci-track-endpoint" content="http://<laptop-ip>:8787/e">`.
2. Open `http://<laptop-ip>:8787/app/index.html` on the buyer's phone (same Wi-Fi). Add `?lang=ar` for Arabic; the header button switches language live.
3. After the sessions: `node tools/kpi_report.mjs events.ndjson` gives the funnel, "helped" rate by confidence level, per-question drop-off, and the written notes.

Without a collector, events stay in the browser. Open with `?debug=1` to see them live and export a JSON file (`kpi_report.mjs` reads that too).

Tests: `node tests/engine.test.js` (2,160 answer sets, coverage-neutrality check) · `node tests/e2e.mjs` (EN/AR, desktop/390px, real collector → KPI report; needs Playwright).

## Data (consumed, not rebuilt)

`data/p2_view.v1.js` is P2's canonical buyer view `carindex.p1.buyer_view/v1` (branch `claude/carindex-buyer-vehicle-data-97yinp`, `vehicle-data/views/p1_suv_2m.json` + `review/review_queue.csv`). `data/adapt_p2.py` passes it through unchanged except for display labels, trim powertrain read from the trim's own label, and warranty years. The P2 SHA-256 is recorded in `meta`.
Universe: P2's 21 in-slice SUVs. The 3 models P2 marks `in_slice=false` are not shown.

## How the pick works (`app/engine.js`)

- **Rank = fit to the buyer's answers only**: how well it uses the budget (or money left over, if the buyer asks for that), powertrain vs. driving pattern, warranty, and registrations only if the buyer asks for "what most Egyptians buy". **Source coverage never enters the score.** A missing field scores the universe median. A test asserts that the order stays identical when every price is flipped to single-source or to fully agreed.
- **Confidence = how the pick is worded, never its rank.** Trim price AGREED/NEAR → strong; SINGLE_SOURCE or single-source model → fair; CONFLICT → thin. Wording: *Our pick* (strong, lead ≥3%) · *Our pick — by a small margin* · *Best match — confirm the price first* (thin).
- Questions: seats (5/7) · driving pattern · charging (asked only when an EV fits) · powertrain (skipped when it can't change the result) · up to 2 priorities.

## Events (schema EV2, `app/track.js`)
`fmc_view, fmc_start, q_view, q_answer, q_skipped, q_back, result_view{mode, confidence, margin, …}, no_match_view, relax_apply, alt_promote, evidence_open, compare_view, cta_click, edit_answer, restart, lang_switch, feedback_view, feedback_answer, feedback_text, exit`. Every event carries session, anon id, lang, viewport, flow/engine/universe versions and UTM tags.
