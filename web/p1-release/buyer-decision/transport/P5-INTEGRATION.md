# P1 → P5 integration contract — recommendation transport T1 (`ci.reco.v1`)

Owner: P1. Task: P1-TRANSPORT-01. Release record: `buyer-decision/release/P1-RELEASE-T1.json` (verify it before binding).

## 1. Files to consume (vendor verbatim; verify every sha256 against the release record)

| File | Role |
|---|---|
| `buyer-decision/transport/reco.js` | entry point (CommonJS, Node ≥ 18, no dependencies, no DOM) |
| `buyer-decision/app/engine.js` | released engine E6-2026-09-28 (unchanged) |
| `buyer-decision/app/brief.js` | released parser (unchanged; dcbe9db comparative-brand fix) |
| `buyer-decision/app/i18n.js` | released engine-owned EN/AR copy (unchanged; evaluated as-is) |
| `buyer-decision/app/present.js` | WHY / trade-offs / why-not / dependencies / notices — generated verbatim from released `app/app.js` |
| `buyer-decision/transport/ci.reco.v1.schema.json` | output contract |
| `buyer-decision/datasets/U11-2026-09-26/{manifest.json, recommendation_view.json}` | pinned launch dataset (data, not code) |

Keep the directory layout (`transport/` resolves `../app/`). Do not edit any of these files. Your vendored f994e7f `brief.js` (`6c476efa…`) and `i18n.js` (`3e91dbb1…`) are **superseded**: they predate the dcbe9db parser fix and are not the release.

## 2. Accepted dataset: load and identify

```js
const T = require('./transport/reco.js');
const ds = T.loadAcceptedDataset('<dir with manifest.json>');   // pinned launch: T.loadLaunchSnapshot()
// or, from the Postgres serving projection (same shape: { meta: { version, ... }, models: [...] }):
const ds = T.loadAcceptedDataset(rowsAsView, { manifest });       // manifest.content_sha256 is verified when given
```
- Identity: `ds.universe_version` (`U11-2026-09-26`), `ds.id` (`U11-2026-09-26/recommendation_view`), `ds.sha256` (content hash `5348da57…`).
- Shape: the published `data/view.js` projection (`tools/build_public.py sanitize`). Required per model: `id, brand_id, brand, model, body, trims[{label, min}]`. Engine-read optional fields: see the file.
- Load once per process and reuse. `execute` refuses objects that did not come from `loadAcceptedDataset`.
- Source: only accepted/versioned recommendation views. Never Google Sheets, P2 staging, unverified observations, scraping output or CMS.
- New data (U12, U13 …): publish a new snapshot directory or projection with its own `meta.version` and manifest, then load it. No engine or transport change is needed. `tests/transport/transport.test.js` §8 proves this.

## 3. Calling the transport (same flow as the released app)

```js
let brief = T.understand(freeText, ds);                   // PRIVATE: holds the buyer's text. Keep server-side.
let q = T.nextQuestion(brief, asked, ds, { path });       // path 'text' | 'guided'; null -> confirm step
brief = T.mergeAnswer(brief, answerPatch, ds);            // per answered question (same patches as the released UI)
brief = T.normalize(brief, ds);                           // REQUIRED before confirm/execute (released app: advance -> norm)
const rows = T.summary(brief, ds, { locale });            // "Here's what we understood" (includes "Not applied" rows)
const reco = T.execute(brief, ds, { locale, asOf });      // -> ci.reco.v1 ; locale 'en' | 'ar' ; asOf 'YYYY-MM-DD' (default today, UTC)
// shared link: T.execute(T.decodeShare(reco.share.r, ds), ds, { locale })
```
- Always call `execute` on a **normalized** brief or on a decoded share token. A share token built from an un-normalized brief can crash the released engine (corpus cases H2 and S4: budget derived from a reference car). The released UI never produces such a token, and the transport does not patch engine behaviour.
- `execute` is synchronous, deterministic and pure. The same brief, dataset and locale always give the same `result_id` and the same output; `asOf` only affects the `stale` flags.
- Edits on the confirm screen (brands only/leave out, resolving unresolved phrases) are brief changes. Apply them exactly as the released Edit screen does, then `normalize`.

## 4. `ci.reco.v1`

Schema: `transport/ci.reco.v1.schema.json`. Render from it. Do not recompute any semantics.
- `mode`: `single | equal | shortlist | conflict | no_match`.
- `confidence`: `{level: clear|lean|tie|only, depends[], vs}`.
- `eyebrow`: the single-pick label. It is null for ties and no-match.
- `hero`, `alternatives[]`: each has `why[]`, `trade_offs[]`, `what_could_change[]` (lean only), `card` (the released alternative/equal card), `versions[]` (`official`, `date`, `stale`) and `html.detail` (the released detail block).
- Also: `notices[]`, `equal`, `compare_html`, `less`, `checks[]`, `no_match`, `brief_bar[]`, `budget`, `share`, and provenance (`result_id`, `engine_version`, `universe_version`, `dataset`, `registry`, `transport_version`).
- Every text is `{html, text}`. `html` is the released markup (escaped data, fixed classes), and P3 Version 7 binds to these same fields. `text` is the plain-text version.
- Engine-owned copy is exact, including Unicode. Example: `Details we don’t have yet for some of these cars` uses U+2019. Never retype or substitute copy.
- Ties: render `hero` + `alternatives` as equal cards, in the given order (by price), and do not lead with any card.

## 5. Release / version checks P5 must enforce

On startup:
1. Verify the sha256 of every vendored file against `release/P1-RELEASE-T1.json`.
2. Verify that `T.ENGINE_VERSION === record.engine_version` and `T.TRANSPORT_VERSION === record.transport_version`.
3. Verify that `ds.universe_version` and `ds.sha256` match an accepted dataset you deliberately bound: U11 at launch, or a newer accepted snapshot.

Refuse to serve FMC when any check fails. On every result, persist `result_id, engine_version, universe_version, dataset.sha256, transport_version, locale, share.r`. That set reconstructs and audits the decision.

## 6. Privacy / redaction

- The brief from `understand()` contains the buyer's raw text (`text`, `notes`, `unresolved[].text`). It may be shown back to the same buyer on the confirm step, and must never go into URLs, logs, analytics or shared results.
- `ci.reco.v1` contains no free text, notes or unresolved phrases (tested). `share.r` / `share.brief` carry only the released SHARE_KEYS.
- Free text sent to analytics goes through the released `app/redact.js` (EV3 / D5), as the live app does.
- No scoring weights, margins (`lead`), `basis`, `gain` or source names are exposed (tested).

## 7. Detecting incompatible versions

- Engine semantics change → new `engine_version` and a new release record.
- Copy or presentation change → new hashes for `i18n.js` / `present.js` in a new release record.
- Data change → new `universe_version` and `dataset.sha256`.
- A stored result whose `engine_version` or `dataset.sha256` differs from the live binding is historical. Re-run it from `share.r` and label it as recomputed; do not present it as the same result.
- `present.js` is regenerated from `app.js` (`node tools/build_present.mjs --check` must pass). If the check fails, the release is invalid.

## 8. Recommendation outside P5's 24-model browse projection (`p1_suv_2m`)

The P1 result is authoritative. Do not drop, substitute or rerank any recommended car.

If a recommended `id` has no Car Detail/Compare page in the current website projection, render the card from `ci.reco.v1` alone (name, prices, WHY, trade-offs, `html.detail`). You may disable or hide only the downstream navigation links for that car until the website projection includes it.
