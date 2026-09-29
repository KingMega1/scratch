# Buyer Beta — portable private build (AT-26)

Private. Not deployed anywhere. Brand-token acceptance is held for AT-25 (canonical Brand System V1.5 not yet locked).

## Source provenance
- `original/` — exact copy of the private Claude artifact **CarIndex Portal** (AT-12), https://claude.ai/artifact/43vACeoDVogHBDeA9HWLEP,
  artifact 18b3a9e7-cfeb-40d0-9a61-fe811a3cd5fc, version 1790667504-b79a, retrieved 2026-09-29 by P1 session
  session_01VUELs9m9MFKHK1JQhuXnR4. Digests: `ORIGINAL_SHA256.txt`.
  - `engine.js` is byte-identical to P1 engine E6 (`app/engine.js`); `view.js` is byte-identical to the live P1 public data build.
- `remediated/` — `original/` plus AT-26 product/trust fixes (only `index.html` changed; `redact.js` added). Digests: `REMEDIATED_SHA256.txt`.

## Run
Any static server from the build folder, e.g. `cd beta/remediated && python3 -m http.server 8080`, open `/index.html`.
Invite codes: CARINDEX / BETA2026 (demo gate). Outside the Claude runtime the waitlist and events fall back to this browser.
Internal dashboard: `/index.html?internal=1#admin`.

## QA
`node beta/qa.mjs <build> <out>` (Playwright + axe-core 4.13) — journey on desktop 1280, mobile 390, narrow 320, EN/LTR and AR/RTL;
trust checks; axe WCAG 2.1 AA on home/journey/results/waitlist/explorer; keyboard path; 200% text scale. Reports: `qa/original/`, `qa/remediated/`.

## Remediations in `remediated/` (product/trust only; no brand token changed)
1. No pre-answered questions: every step starts empty and Next stays disabled until the buyer answers ("No preference" is an explicit answer; priorities can be skipped explicitly). The original pre-selected budget mode, SUV, powertrain, riders, two priorities and city, so a buyer could get a "recommendation" without stating anything.
2. Internal dashboard removed from buyer navigation (editors, or `?internal=1`, only).
3. Feedback comments are redacted (phones/emails/long numbers) before being stored or counted; fixed `toast is not defined` thrown on every comment send.
4. Ties shown as equal cards: same size, none pre-opened, none described relative to another, listed by price with a note that none ranks above the others.
5. Approved confidence language: "Best fit for what you told us" / "Our current pick: X" + "Why this one" + "What could change the answer" / "Strong matches".
6. Above-budget pick states what the extra spend buys versus the best in-budget car (approved earned-stretch rule).
7. Keyboard: focus stays on the chosen option after each selection (was reset to the page body).

## Open (not fixed here)
- Brand (AT-25 / P3): official-price green badge `#1F8A44` on `#E4F2E8` = 3.8:1 (fails WCAG AA 4.5:1 at 12px); footer wordmark renders distorted; three token systems unreconciled.
- Product: no free-text entry (P1.2 requires both entry modes); no "Here's what we understood" confirm step; events are a local schema, not EV3 (Analytics owns the contract); client-side invite codes (demo only).
- Data: official prices cover Nissan and MG only; most shown prices are listing-site prices (labelled as such).
