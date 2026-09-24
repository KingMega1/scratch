# CarIndex — Strategic Roadmap

**Type:** Strategic control layer (living document). Not a backlog.
**Last updated:** 2026-09-24 (strategic resolutions R-1 to R-8 applied)
**Companion:** [`DECISION_LOG.md`](./DECISION_LOG.md)

**How to use this document**
- Every piece of work should trace to a buyer-journey stage, a workstream and a milestone in this document. If it doesn't, question it before funding it.
- **[OPEN]** marks an unresolved strategic question. It is not decided until it appears in the Decision Log as *Active*.
- **[CONFLICT]** marks a place where existing documents disagree. It is flagged here, not resolved.
- **[RESOLVED]** marks a former conflict closed by an owner resolution. The Decision Log entry is referenced.
- **[HISTORICAL]** marks a superseded assumption. It is kept for traceability and no longer governs. See §16.
- Sources reviewed:
  - `PRD.md` (2026-08-26)
  - `CarIndex_Roadmap_LIVE.md` (2026-09-20)
  - `CarIndex_Current_State_Implementation_Snapshot_2026-09-22.md`
  - `CarIndex_Source_of_Truth_Reconciliation_Report_2026-09-22.md`
  - Design-lab `BRIEF.md` and `00-design-plan.md` (2026-09-24)
  - The owner's strategy brief and strategic resolutions (2026-09-24)

---

## 1. North Star

**CarIndex is an independent automotive decision platform.** (D-15)

**Core user job:**
> "I have X budget and Y needs. Help me understand which cars I should consider — and why."

**Permanent independence rule** (D-01):
> "Nobody can pay to change what CarIndex believes is right for the buyer."

Commercial relationships, advertising, marketplace participation and transaction economics must never influence recommendation ranking or editorial conclusions.

**Content engagement is a growth and brand measure. It is not the North Star.** (D-15)

**[RESOLVED — D-15]** Earlier documents named content engagement as the north star. That definition is now **[HISTORICAL]** (S-01, §16).

---

## 2. Strategic principles

1. **Independence is permanent.** "Nobody can pay to change what CarIndex believes is right for the buyer." Recommendation Intelligence ≠ Commercial Ranking / Marketplace Offers. (D-01, D-02)
2. **Evidence first. Interpretation explained. Recommendation earned.** This is the strategic voice and editorial standard. (D-16)
3. **Data is the source of truth.** Every claim is sourced and dated, or explicitly flagged as unverified. (D-04)
4. **AI for understanding, software for reasoning, data for truth.** AI interprets intent. Deterministic software produces recommendations. (D-05)
5. **Model-first.** The model is the unit of decision. Trims are supporting observations. (D-06)
6. **Show conflicts and gaps.** Where sources disagree, show both values. Where data is missing, say so. (D-04)
7. **No "LIVE" claim without an operational refresh and change-detection system behind it.** (D-17)
8. **Arabic is first-class.** It is designed as its own layout, not mirrored. Numerals are Latin. (D-07)
9. **Independent and faceless.** Authority comes from evidence, not personality. (D-03)
10. **Same evidentiary standard for every brand.** This does not mean equal airtime. (D-12)
11. **Product development and brand/media building proceed in parallel.** (D-09)
12. **Commercial economics stay structurally separate from recommendation and editorial logic**, whatever the monetization model. (D-18)

---

## 3. Value proposition

For Egyptian car buyers facing a crowded, fast-changing market with many new entrants: CarIndex turns budget and needs into a short, explained list of models to consider. The list is built from sourced, dated, conflict-aware market data. No dealer or advertiser can buy a better recommendation.

**[OPEN]** The positioning line is not settled. "Every car, indexed." appears in the brand book (2026-07-15) and `PRD.md`. "Know the market. Know your car." appears in the Sep 10 homepage design. Neither is marked final.

---

## 4. Buyer journey

```
Discover → Understand the market → Find My Car → Recommended models
        → Understand why → Car Detail → Compare → Decide → Return
```

| Stage | Owning surface | Status (as of 2026-09-24) |
|---|---|---|
| Discover | Social / media, homepage | Social live on 6 platforms, published manually. No site deployed. |
| Understand the market | "What's happening", Stories | Homepage module design only |
| Find My Car | Guided flow (+ natural-language mode, intended) | Guided flow design-only, English-only. Natural-language mode not designed. |
| Recommended models | Recommendation engine | Not built. No recommendation attributes in the data. |
| Understand why | Explanation layer | One static mock screen |
| Car Detail | Model page | Design benchmark in progress (Corolla, 2026-09-24) |
| Compare | Compare | No design |
| Decide | Results / Detail / Compare | Not defined |
| Return | Retention loop | **[OPEN]** Not defined in any artifact |

---

## 5. Competitive moat

Moat hypotheses (not validated):
- **Trust / independence.** No one can pay for a recommendation. This is enforced by structural separation, not by policy alone (D-02, D-18).
- **Vehicle Truth.** Multi-source, reconciled, provenance-tracked Egyptian market data: 539 brand-model combinations as of 2026-09-17, with a cross-source status per vehicle.
- **Vehicle Intelligence.** Derived attributes and confidence that competitors don't publish.
- **Registration intelligence.** Strategically relevant (D-19). **[OPEN]** Its exact role in the moat and product is not decided.
- **Arabic-first decision experience.**
- **Brand and audience** built through independent media.

**[OPEN]** No competitive landscape is documented anywhere. `PRD.md` says so explicitly. The moat has not been tested against named competitors.

**[OPEN]** Should data licensing / API access be pulled forward as a moat play? `PRD.md` records this as a consideration, not a decision.

---

## 6. Brand strategy

- **Identity:** independent, faceless, evidence-led, skeptical, buyer-first. The brand book's values are Independence, Data Precision, Unbiased Objectivity and Transparency.
- **Strategic voice and editorial standard:** **"Evidence first. Interpretation explained. Recommendation earned."** (D-16)
  - *Evidence first:* sourcing discipline is unchanged (D-04).
  - *Interpretation explained:* CarIndex may interpret. It must show its reasoning.
  - *Recommendation earned:* a recommendation is made only when the evidence and the stated logic support it.
- **Brand is built in parallel with product, not after it** (D-09). Media builds trust and audience ahead of product traffic.

**[RESOLVED — D-16]** "Numbers first, opinions last" as a strategic interpretation is now **[HISTORICAL]** (S-03). The *operational* status of the removed "AI Recommendation" content pillar is still **[OPEN]** (D-13).

**[CONFLICT] Visual identity authority.** It is unclear which of these is binding:
- the Pomelli brand book (2026-07-15), ranked highest in the design lab
- the Sep 10 design direction
- the planned Visual Identity Playbook v2 (not found in the Drive files reviewed)

---

## 7. Product strategy

- **Core product:** Find My Car → recommended models with explanation → Car Detail → Compare.
- **Recommendation architecture (intended):** user intent (guided and/or natural language) → AI interpretation → structured preference profile → deterministic matching over Vehicle Truth + Intelligence → ranked models → explanation. The explanation covers why it fits, what to consider, why it didn't score higher, and why an obvious car wasn't recommended.
- **Unit of decision:** the model. Trims sit inside the model.
- **Proof strategy:** a deliberately limited, well-covered vehicle set (Vertical Slice #1, §12) before broad catalogue coverage.

**[OPEN]** Find My Car question design:

| Artifact | Question count |
|---|---|
| Sep 8 v1 | 4 |
| Sep 8 v2 | 5 |
| Sep 10 homepage | Adaptive |
| Sep 10 R3 mock | 9 steps (Step 7 missing) |

Natural-language entry is intended but has no design anywhere.

**[OPEN]** Scope: new cars only, or used as well? The R3 mock asks "new or used", but the data is new-market only.

---

## 8. Data & intelligence strategy

- **Vehicle Truth** (identity, normalization, provenance, price integrity) is the foundation. Nothing ranks on untraceable data.
- **Vehicle Intelligence** (derived attributes, confidence, editorial interpretation, recommendation signals) sits on top of Truth and is versioned separately.
- **Current state:** one snapshot (collected 2026-09-10, files dated 2026-09-17).
  - Official price covers 94% of rows.
  - Market price covers 41% of rows.
  - About a quarter of candidate vehicles are single-source.
  - Recommendation attributes (usage fit, running cost, reliability, safety, resale) are absent.
- **Freshness claims (D-17):** CarIndex data must not be described as "LIVE" until an operational refresh and change-detection system supports the claim. The snapshot is dated and should be presented as dated.
- **Registration intelligence (D-19):** strategically relevant. A separate Vehicle Registration Explorer exists, and registration data is not in the vehicle dataset.

**[RESOLVED — D-17]** The "LIVE INDEX" wording in the Sep 8–10 designs is now **[HISTORICAL]** (S-04). It must not carry into build or copy.

**[OPEN]** Refresh cadence, and the operational system that would support any future "live" claim.

**[OPEN]** The exact product role of registration intelligence: which surfaces, which buyer-journey stage, and whether it feeds recommendation signals.

---

## 9. Content / media & distribution strategy

- **Role of media:** build authority, trust and audience ahead of product traffic. Media feeds the "Discover" and "Understand the market" stages.
- **Content engagement is a growth and brand measure, not the North Star (D-15).** It is tracked in §15.
- **Current engine:** the n8n pipeline has two RSS lanes (local Arabic, global English) and 9 content pillars. Every post passes a Telegram human-approval gate and is then published manually to Facebook, Instagram, Threads, X, TikTok and YouTube.
- **Standing rules:**
  - Arabic-primary with inline English.
  - Latin numerals.
  - Every claim sourced or tagged `[UNVERIFIED]`.
  - Source conflicts are stated, not silently picked.
  - Content follows the D-16 voice standard.

**[OPEN]** Editorial franchises beyond the 9 pillars are not defined. Only "New Model Launch" has a documented process.

**[OPEN] Distribution:**
- Publishing after approval is manual.
- No performance measurement exists.
- No handle or domain is registered. The pipeline uses placeholders `@CarIndexEG` / `carindex.eg`.

**[OPEN]** Arabic register: Egyptian colloquial or MSA? The two Sep 22–24 reviews read the Sep 10 Arabic differently.

---

## 10. Monetization hypotheses

**Every monetization model is a hypothesis, not a decision.**

**Binding constraint (D-18):** any model must keep commercial economics structurally separate from recommendation and editorial logic. Commercial data, partner status or transaction value must never be an input to ranking or editorial conclusions.

| Stage | Hypothesis | Precondition |
|---|---|---|
| 1 | Social/video platform revenue; programmatic website advertising | Audience scale; a live site |
| 2 | Value-added automotive services: finance, insurance, charging, maintenance, warranty, related ownership services | Trust and traffic on the decision journey |
| 3 | Automotive e-commerce / marketplace / transaction revenue | Find My Car has strong trust, traffic and brand recognition |
| Later | B2B automotive market/data intelligence | Mature Vehicle Truth and Intelligence |

**Permanent separation:** Recommendation Intelligence ≠ Commercial Ranking / Marketplace Offers. A commercial partner must never be able to buy a better recommendation.

**[CONFLICT] Two monetization sequences exist.** Both are hypotheses under D-18. The ordering conflict is not resolved.

| | `PRD.md` (2026-08-26) | 2026-09-24 hypotheses |
|---|---|---|
| Early revenue | None (Phases 1–2) | Platform and ad revenue (Stage 1) |
| Affiliate links | Phase 3 | Not included |
| Advertising | Phase 4 | Stage 1 |
| E-commerce | Phase 5, with VAS | Stage 3, after VAS |
| Subscriptions | Phase 6, with data API | Not included |

Affiliate income is transaction-linked. Whether it can satisfy D-18 is **[OPEN]**.

---

## 11. Current workstreams

| WS | Workstream | Scope | North Star link | Current state (evidence) |
|---|---|---|---|---|
| A | **Vehicle Truth** | Canonical model identity, normalization, provenance, price/data integrity | "Data is the source of truth" | Raw → normalized → reconciled CSV layers exist (Sep 17). Not connected to any product surface or to content. |
| B | **Vehicle Intelligence** | Intelligence data contract, derived attributes, confidence, editorial interpretation, future recommendation signals | Powers "Recommended models" and "Understand why" | No contract or attributes in the data yet |
| C | **Product** | Find My Car, Car Detail, Compare, recommendation engine, buyer journey | The core user job | Design-only (homepage, R3 mock). Car Detail benchmark in progress. No production code. |
| D | **Brand & Design** | Design skill bake-off, Visual Identity Playbook v2, proprietary CarIndex design skill, Figma design system | Trust and consistency across surfaces | Bake-off running (Corolla Car Detail, 2 candidates, 2026-09-24). Playbook v2 / Figma DS not located. |
| E | **Media & Brand Building** | Editorial franchises, social content, authority/trust, audience growth | Discover / Understand the market. Engagement is a growth/brand measure (D-15). | Live on 6 platforms. 10 approvals pending since 2026-08-25 (per the 2026-09-20 log). |
| F | **Automation** | n8n Golden Path, content production, QA, approval, eventual publishing/performance loop | Scales E without breaking sourcing discipline | Production, QA and approval are live (132-node workflow). Publishing and performance loop absent. |
| G | **Monetization** | Audience monetization, advertising, VAS, commerce, future B2B | Business model. Structurally separate from ranking (D-18). | Hypotheses only (§10) |

---

## 12. Current major milestone — CARINDEX VERTICAL SLICE #1

**Definition:** a usable end-to-end buyer journey on a deliberately limited set of well-covered vehicles.

**Example journey:**
```
Budget + needs → Find My Car → 2–3 model recommendations → explain why
             → Car Detail → Compare → informed decision
```

**Exit criteria (principle-level):**
- Every recommended model traces to sourced Vehicle Truth data, with conflicts and gaps shown.
- Ranking comes from deterministic logic. Explanations state why each model fits and what to consider. The recommendation is *earned* (D-16).
- Arabic and English are both first-class across the slice.
- There is no commercial input anywhere in the ranking path (D-18).
- Data is shown as dated. There is no "LIVE" claim (D-17).

**[OPEN] Requires strategic approval before scoping:**
- Exact vehicle count and which models or segment
- Budget band(s) covered
- New-only or including used cars
- Which visual-identity authority the slice is built against (§6)
- Find My Car question set and input modes in scope (§7)
- Whether registration intelligence appears in the slice (D-19)
- Public or internal

**Existing inputs that fit the slice:** the Toyota Corolla Car Detail benchmark (2026-09-24), which is model-first, surfaces conflicts and is bilingual. Corolla data has 5 trims confirmed across 4 sources.

---

## 13. Now / Next / Later / Parked

Placement below follows the dependencies documented in the sources. Order within Next and Later is **not** owner-approved.

**Now** (in flight)
- Strategic control layer: this roadmap and the Decision Log
- Design skill bake-off (WS-D) on the Corolla Car Detail
- Vehicle Truth for well-covered models (WS-A)
- Content pipeline operating under the human approval gate (WS-E/F), in parallel with product (D-09)

**Next** (needs strategic decisions first)
- Approve Vertical Slice #1 scope (§12)
- Resolve the visual-identity authority (brand book vs. Playbook v2) and Figma's role (WS-D)
- Define the Vehicle Intelligence data contract for slice vehicles (WS-B)
- Settle the Find My Car input design for the slice (WS-C)
- Close the approval → publish → performance loop (WS-F). PRD 2026-08-26 names this as the next priority.

**Later**
- Build Vertical Slice #1 end-to-end (WS-C)
- Expand coverage beyond the slice
- Retention / "Return" loop, saving and sharing
- Operational refresh / change-detection system, the precondition for any "live" claim (D-17)
- Stage 1 monetization (WS-G), under D-18

**Parked**
- Removing the human approval gate on content. Explicitly out of scope in `PRD.md`.
- Anthropic fallback tier in the pipeline. Parked by the owner since 2026-08-15.
- Stage 2 / Stage 3 / B2B monetization. Hypotheses only.
- `Website/index.html` (2026-07-28) as a starting point. Rejected by the owner, 2026-08-26.

---

## 14. Key strategic questions still unresolved

1. Vertical Slice #1 scope: vehicle count, models or segment, budget bands, public or internal.
2. Market scope: Egypt only, or Egypt + MENA? The documents say "Egypt/MENA"; the data is Egypt only.
3. New cars only, or used cars as well?
4. Positioning line: "Every car, indexed." or "Know the market. Know your car."?
5. Which visual authority is binding: the brand book (Jul 15), the Sep 10 direction, or Visual Identity Playbook v2?
6. Is the "AI Recommendation" content pillar reinstated, reframed or kept removed under D-16? (D-13)
7. Monetization:
   - Which sequence governs (§10)?
   - Can affiliate income satisfy D-18?
   - Should data/API be pulled forward?
   - Do subscriptions stay?
8. Arabic register for product and media: Egyptian colloquial or MSA?
9. Refresh cadence and the operational system that would allow a "live" claim (D-17).
10. Image rights basis for production content. Flagged open in `PRD.md`; the OEM scraper applies no rights filtering.
11. Governance of the independence rule: who can change recommendation logic, how D-18 separation is audited, and what is disclosed about commercial relationships.
12. Success measures and targets (§15). No KPI framework exists.
13. "Car Index / Car Intelligence / Car Stories" pillar naming: is it real or new? It was not found in any reviewed file.
14. The exact product role of registration intelligence (D-19).

---

## 15. Success measures

No KPI framework or targets exist in any reviewed document. The measures below are categories only. **[OPEN]** Targets are not set.

| Area | Measure (definition only) |
|---|---|
| **North Star: decision platform** | Share of Find My Car sessions that reach recommendations; share continuing to Car Detail and Compare; return visits |
| Trust / independence | Zero commercial inputs in the ranking path (binary, auditable); share of displayed values with source and date |
| Data integrity | Share of slice vehicles confirmed by more than one source; open price conflicts; data age as displayed |
| Growth / brand (not the North Star) | Follower growth and content engagement per platform (not measured today); share of approved content actually published |
| Operations | Approval-to-publish time (backlog of 26+ days as of 2026-09-20) |
| Monetization (later) | Revenue by stage, tracked separately from recommendation outcomes (D-18) |

---

## 16. Historical / superseded assumptions

These are kept for traceability. They **no longer govern** CarIndex strategy. Source documents are unchanged. Where a source (for example `PRD.md` or `CLAUDE.md` in the n8n project) still states one of these, this roadmap takes precedence.

| ID | Historical assumption | Source | Superseded by |
|---|---|---|---|
| S-01 | North star: "produce content the audience engages with, in order to grow the brand" | `PRD.md` (2026-08-26); `CarIndex_Roadmap_LIVE.md` "Original objectives" | D-15: the decision platform is the North Star. Engagement is a growth/brand measure. |
| S-02 | The website is sequenced *after* the social pipeline is proven, and scoped "from a blank page" | `PRD.md` (2026-08-26) | D-09: product and brand/media proceed in parallel |
| S-03 | "Numbers first, opinions last" as the strategic interpretation of voice, including its use to treat recommendations as opinion | `PRD.md` (2026-08-26) | D-16: "Evidence first. Interpretation explained. Recommendation earned." |
| S-04 | "LIVE INDEX" / live-data framing | Sep 6–10 homepage designs; `Website/index.html` (2026-07-28) | D-17: no "LIVE" claim until an operational refresh/change-detection system supports it |
