# CarIndex — Strategic Roadmap

**Type:** Strategic control layer (living document). This is not a backlog.
**Last updated:** 2026-09-24
**Companion:** [`DECISION_LOG.md`](./DECISION_LOG.md)

**How to use this document**
- Any piece of work should trace to a buyer-journey stage, a workstream and a milestone listed here. If it doesn't, question it before funding it.
- Items marked **[OPEN]** are unresolved strategic questions. They are not decided until they appear in the Decision Log as *Active*.
- Items marked **[CONFLICT]** are places where existing documents disagree. They are flagged here and are not resolved.
- Sources reviewed for this version: `PRD.md` (2026-08-26), `CarIndex_Roadmap_LIVE.md` (2026-09-20), `CarIndex_Current_State_Implementation_Snapshot_2026-09-22.md`, `CarIndex_Source_of_Truth_Reconciliation_Report_2026-09-22.md`, design-lab `BRIEF.md` and `00-design-plan.md` (2026-09-24), and the owner's strategy brief (2026-09-24).

---

## 1. North Star

**CarIndex is an independent automotive decision platform.**

**Core user job:**
> "I have X budget and Y needs. Help me understand which cars I should consider — and why."

**Permanent independence principle:**
> "Nobody can pay to change what CarIndex believes is right for the buyer."

Commercial relationships, advertising, marketplace participation and transaction economics must never influence recommendation ranking or editorial conclusions.

**[CONFLICT]** Earlier documents set a different north star. `PRD.md` and `CarIndex_Roadmap_LIVE.md` define it as *"produce content the audience engages with, in order to grow the brand"*. That was written for the content pipeline. The decision-platform North Star above now governs. The older statement is still active in the n8n project docs (`CLAUDE.md`, `PRD.md`) and should be retired or re-scoped there.

---

## 2. Strategic principles

1. **Independence is permanent and not for sale.** Recommendation Intelligence ≠ Commercial Ranking / Marketplace Offers.
2. **Data is the source of truth.** Every claim is sourced and dated, or explicitly flagged as unverified.
3. **AI for understanding, software for reasoning, data for truth.** AI interprets what the user wants. Deterministic software produces the recommendations.
4. **Model-first.** The model is the unit of decision. Trims are supporting observations inside a model.
5. **Surface conflicts and gaps. Don't hide them.** Where sources disagree, show both. Where data is missing, say so.
6. **Arabic is first-class.** Arabic is designed as its own layout, not mirrored from English at the end. Numerals are always Latin.
7. **Independent and faceless.** Authority comes from evidence, not from a personality.
8. **Same evidentiary standard for every brand.** This does not mean equal airtime.
9. **Brand building and product development run in parallel.**

---

## 3. Value proposition

For Egyptian car buyers facing a crowded, fast-changing market with many new entrants: CarIndex turns budget and needs into a short, explained list of models to consider. It uses sourced, dated and conflict-aware market data. No dealer or advertiser can buy a better recommendation.

**[OPEN]** The positioning line is not settled:
- "Every car, indexed." appears in the brand book (2026-07-15) and `PRD.md`.
- "Know the market. Know your car." appears in the Sep 10 homepage design.

Neither is marked as final.

---

## 4. Buyer journey

```
Discover → Understand the market → Find My Car → Recommended models
        → Understand why → Car Detail → Compare → Decide → Return
```

| Stage | Owning surface | Status (as of 2026-09-24) |
|---|---|---|
| Discover | Social / media, homepage | Social is live on 6 platforms, with manual publishing. No site is deployed. |
| Understand the market | "What's happening", Stories | Design exists for the homepage module only |
| Find My Car | Guided flow (+ natural-language mode, intended) | Guided flow is design-only and English-only. Natural-language mode has no design. |
| Recommended models | Recommendation engine | Not built. The data has no recommendation attributes yet. |
| Understand why | Explanation layer | One static mock screen only |
| Car Detail | Model page | A design benchmark is in progress (Corolla, 2026-09-24) |
| Compare | Compare | No design exists |
| Decide | Results, Detail, Compare | Not defined |
| Return | Retention loop | **[OPEN]** Not defined in any artifact |

---

## 5. Competitive moat

Moat hypotheses (not validated):
- **Trust / independence.** No one can pay for a recommendation, and this is enforced by structure, not only by policy.
- **Vehicle Truth.** Multi-source, reconciled, provenance-tracked Egyptian market data. As of 2026-09-17 this covers 539 brand-model combinations, with a cross-source status for each vehicle.
- **Vehicle Intelligence.** Derived attributes and confidence levels that competitors don't publish.
- **Arabic-first decision experience.**
- **Brand and audience** built through independent media.

**[OPEN]** No competitive landscape has been documented anywhere (`PRD.md` says so explicitly). The moat has not been tested against named competitors.

**[OPEN]** Should data licensing / API access be pulled forward as a moat play? `PRD.md` records this as a consideration, not a decision.

---

## 6. Brand strategy

- **Identity:** independent, faceless, data-driven, skeptical, buyer-first. Brand book values: Independence, Data Precision, Unbiased Objectivity, Transparency.
- **Voice (current rule):** "Numbers first, opinions last."
- **Brand is built alongside the product, not after it.** Media builds trust and audience ahead of product traffic.

**[CONFLICT] Voice rule vs. decision platform.** "Numbers first, opinions last" was used to remove the "AI Recommendation" content pillar, on the grounds that a recommendation is an opinion. The North Star is now a recommendation-and-explanation product. The relationship between editorial interpretation and the voice rule needs an explicit decision.

**[CONFLICT] Visual identity authority.** Three sources compete:
- the Pomelli brand book (2026-07-15), which the design lab treats as the highest authority
- the Sep 10 design direction
- the planned Visual Identity Playbook v2, which was not found in the reviewed Drive files

No document states which one is binding.

---

## 7. Product strategy

- **Core product:** Find My Car → recommended models with explanations → Car Detail → Compare.
- **Recommendation architecture (intended):** user intent (guided and/or natural-language) → AI interpretation → structured preference profile → deterministic matching over Vehicle Truth and Intelligence → ranked models → explanation. The explanation covers why it fits, what to consider, why it didn't score higher, and why an obvious car wasn't recommended.
- **Unit of decision:** the model. Trims sit inside the model.
- **Proof strategy:** a deliberately limited, well-covered vehicle set (Vertical Slice #1, §12) before any broad catalogue coverage.

**[OPEN] Find My Car question design.** Documents disagree:
- 4 questions (Sep 8 v1)
- 5 questions (Sep 8 v2)
- "adaptive", no count stated (Sep 10 homepage)
- 9 steps (Sep 10 R3 mock, with Step 7 missing)

**[OPEN]** Natural-language entry is intended but has no design anywhere.

**[OPEN]** Scope of new vs. used cars. The R3 mock asks "new or used", but the data is new-market only.

---

## 8. Data & intelligence strategy

- **Vehicle Truth** (identity, normalization, provenance, price integrity) is the foundation. Nothing ranks on data that can't be traced to a source.
- **Vehicle Intelligence** (derived attributes, confidence, editorial interpretation, recommendation signals) sits on top of Truth and is versioned separately from it.
- **Current state:** a one-time snapshot (collected 2026-09-10, files dated 2026-09-17):
  - official price is present for 94% of rows
  - market price is present for 41% of rows
  - about a quarter of candidate vehicles come from a single source
  - recommendation attributes (usage fit, running cost, reliability, safety, resale) are absent

**[CONFLICT] "Live" vs. snapshot.** Homepage designs promise a "LIVE INDEX". The data is a single snapshot. **[OPEN]** Refresh cadence has not been committed.

**[OPEN]** Registration data is part of the brand positioning in `PRD.md` and the old homepage, but it is not in the vehicle dataset. A separate Vehicle Registration Explorer exists, and no roadmap references it.

---

## 9. Content / media & distribution strategy

- **Role of media:** build authority, trust and audience ahead of product traffic, and feed the "Discover" and "Understand the market" stages.
- **Current engine:** the n8n pipeline has two RSS lanes (local Arabic, global English) and 9 content pillars. All content goes through a human approval gate on Telegram. Output is published manually to Facebook, Instagram, Threads, X, TikTok and YouTube.
- **Standing rules:** Arabic-primary with inline English; Latin numerals; every claim sourced or tagged `[UNVERIFIED]`; source conflicts stated, not silently picked.

**[OPEN]** Editorial franchises are not yet defined beyond the 9 pillars. Only "New Model Launch" has a documented process.

**[OPEN]** Distribution:
- publishing after approval is still manual
- no performance measurement exists
- no handle or domain is registered (placeholders `@CarIndexEG` / `carindex.eg`)

**[OPEN]** Arabic register: Egyptian colloquial vs. MSA. The two Sep 22–24 reviews read the same Sep 10 Arabic differently. This needs a native-speaker decision.

---

## 10. Monetization hypotheses

**All items below are hypotheses, not decisions.**

| Stage | Hypothesis | Precondition |
|---|---|---|
| 1 | Social/video platform revenue; programmatic website advertising | Audience scale; a live site |
| 2 | Value-added automotive services: finance, insurance, charging, maintenance, warranty, related ownership services | Trust + traffic on the decision journey |
| 3 | Automotive e-commerce / marketplace / transaction revenue | Find My Car has strong trust, traffic and brand recognition |
| Later | B2B automotive market / data intelligence | Mature Vehicle Truth and Intelligence |

**Permanent separation:** Recommendation Intelligence ≠ Commercial Ranking / Marketplace Offers. A commercial partner must never be able to buy a better recommendation.

**[CONFLICT] Two monetization sequences exist.** `PRD.md` (2026-08-26) has:
- Phases 1–2: no monetization
- Phase 3: affiliate links
- Phase 4: ads
- Phase 5: e-commerce / VAS
- Phase 6: subscriptions / data API

The differences from the 2026-09-24 hypotheses:
- **Early revenue:** the PRD has zero monetization early; the new Stage 1 has platform and ad revenue.
- **Affiliate:** the PRD has an affiliate phase. The new stages have none, and affiliate income is transaction-linked, which bears on independence.
- **Subscriptions:** the PRD has subscriptions; the new stages don't.
- **Order:** e-commerce sits in Phase 5 alongside VAS in the PRD, and in Stage 3 in the new sequence.

---

## 11. Current workstreams

| WS | Workstream | Scope | North Star link | Current state (evidence) |
|---|---|---|---|---|
| A | **Vehicle Truth** | Canonical model identity, normalization, provenance, price/data integrity | "Data is the source of truth" | Raw → normalized → reconciled CSV layers exist (Sep 17). Not connected to any product surface or to content. |
| B | **Vehicle Intelligence** | Intelligence data contract, derived attributes, confidence, editorial interpretation, future recommendation signals | Powers "Recommended models" and "Understand why" | No contract or attributes exist in the data yet |
| C | **Product** | Find My Car, Car Detail, Compare, recommendation engine, buyer journey | The core user job | Design-only (homepage, R3 mock). Car Detail benchmark in progress. No production code. |
| D | **Brand & Design** | Design skill bake-off, Visual Identity Playbook v2, proprietary CarIndex design skill, Figma design system | Trust and consistency across surfaces | Bake-off running (Corolla Car Detail, 2 candidates, 2026-09-24). Playbook v2 / Figma DS not located. |
| E | **Media & Brand Building** | Editorial franchises, social content, authority/trust, audience growth | Discover / Understand the market; audience for all monetization stages | Live on 6 platforms. 10 approvals pending since 2026-08-25 (per the 2026-09-20 log). |
| F | **Automation** | n8n Golden Path, content production, QA, approval, eventual publishing/performance loop | Scales E without breaking sourcing discipline | Production + QA + approval are live (132-node workflow). Publishing and performance loop are absent. |
| G | **Monetization** | Audience monetization, advertising, VAS, commerce, future B2B | Business model; must not touch ranking | Hypotheses only (§10) |

---

## 12. Current major milestone — CARINDEX VERTICAL SLICE #1

**Definition:** a usable end-to-end buyer journey, built on a deliberately limited set of well-covered vehicles.

**Example journey:**
```
Budget + needs → Find My Car → 2–3 model recommendations → explain why
             → Car Detail → Compare → informed decision
```

**Exit criteria (principle-level):**
- Every recommended model is traceable to sourced Vehicle Truth data, with conflicts and gaps shown.
- Ranking comes from deterministic logic. The explanation states why each model fits and what to consider.
- Arabic and English are both first-class across the full slice.
- No commercial input exists anywhere in the ranking path.

**Requires strategic approval before scoping:** **[OPEN]**
- Exact vehicle count and which models or segment
- Budget band(s) covered
- New-only vs. including used cars
- Which visual-identity authority the slice is built against (§6)
- Which Find My Car question set / input modes are in scope (§7)
- Whether the slice is public or internal

**Existing inputs that fit the slice:**
- Toyota Corolla Car Detail benchmark (2026-09-24). It is model-first, surfaces source conflicts, and is bilingual.
- Corolla data has 5 trims confirmed across 4 sources.

---

## 13. Now / Next / Later / Parked

Placement below reflects the dependencies documented in the sources reviewed. Order within Next and Later is **not** owner-approved.

**Now** (in flight)
- Strategic control layer: this roadmap and the Decision Log
- Design skill bake-off (WS-D) on the Corolla Car Detail
- Vehicle Truth for well-covered models (WS-A)
- Content pipeline operating under the human approval gate (WS-E/F)

**Next** (needs strategic decisions first)
- Approve Vertical Slice #1 scope (§12)
- Resolve the visual-identity authority: brand book vs. Playbook v2; decide the role of Figma (WS-D)
- Define the Vehicle Intelligence data contract for slice vehicles (WS-B)
- Settle the Find My Car input design for the slice (WS-C)
- Close the loop from approval to publishing to performance (WS-F), which PRD 2026-08-26 names as the next priority

**Later**
- Build Vertical Slice #1 end-to-end (WS-C)
- Expand coverage beyond the slice
- Retention / "Return" loop, saving and sharing
- Stage 1 monetization (WS-G)

**Parked**
- Removing the human approval gate on content (explicitly out of scope, `PRD.md`)
- Anthropic fallback tier in the pipeline (parked by the owner since 2026-08-15)
- Stage 2 / Stage 3 / B2B monetization (hypotheses only)
- `Website/index.html` (2026-07-28) as a starting point (rejected by the owner, 2026-08-26)

---

## 14. Key strategic questions still unresolved

1. Scope of Vertical Slice #1: vehicle count, models/segment, budget bands, public vs. internal.
2. Market scope: Egypt only, or Egypt + MENA? Documents say "Egypt/MENA"; the data is Egypt only.
3. New cars only, or used cars as well?
4. Positioning line: "Every car, indexed." vs. "Know the market. Know your car."
5. Which visual authority is binding: the brand book (Jul 15), the Sep 10 direction, or Visual Identity Playbook v2?
6. How editorial interpretation and recommendations coexist with "Numbers first, opinions last."
7. Monetization: are affiliate links compatible with independence? Should data/API be pulled forward? Do subscriptions stay? Which sequence governs (§10)?
8. Arabic register for the product and media: Egyptian colloquial or MSA?
9. Data freshness commitment: what refresh cadence justifies any "live" claim?
10. Image rights basis for production content. Flagged as open in `PRD.md`; the OEM scraper applies no rights filtering.
11. Governance of the independence principle: who can change recommendation logic, and what is disclosed about commercial relationships?
12. Success measures and targets (§15). No KPI framework exists.
13. Is the "Car Index / Car Intelligence / Car Stories" pillar naming real or new? It is not found in any reviewed file.
14. Role of registration data and the Vehicle Registration Explorer in the product.

---

## 15. Success measures

No KPI framework or targets exist in any reviewed document. The measures below are categories to track. **Targets are [OPEN].**

| Area | Measure (definition only) |
|---|---|
| Trust / independence | Zero commercial inputs in the ranking path (binary, auditable); share of displayed values with source and date attached |
| Data integrity | Share of slice vehicles confirmed by more than one source; open price conflicts; data age |
| Product | Share of Find My Car sessions that reach recommendations; share that go on to Car Detail and Compare; return visits |
| Audience / brand | Follower growth and engagement per platform (not measured today); share of approved content actually published |
| Operations | Days from approval to publish (today's backlog is 26+ days as of 2026-09-20) |
| Monetization (later) | Revenue by stage, tracked separately from recommendation outcomes |
