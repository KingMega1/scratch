# CarIndex — Decision Log

**Purpose:** Records major, durable strategic decisions. Task-level and technical choices do not belong here.

**Last updated:** 2026-09-24. Strategic resolutions R-1 to R-8 applied.

**Companion:** [`CARINDEX_ROADMAP.md`](./CARINDEX_ROADMAP.md)

**Status values:**
- **Active:** decided and in force.
- **Hypothesis:** a direction under test, not a decision.
- **Under review:** a conflict exists and needs an owner decision.
- **Superseded / Historical:** replaced by a later decision (named in the entry). Kept for traceability.
- **Rejected:** explicitly discarded.

**Dates:**
- Where a decision's origin is documented, that date and source are used.
- Where no dated source was found, the entry says "Recorded 2026-09-24 (origin undated)", meaning it was confirmed in the owner's brief of that date.
- "R-n" refers to the owner's strategic resolutions of 2026-09-24.

---

## Active decisions

### D-01 — Permanent independence rule
- **Date:** First documented 2026-07-15 in the brand book values. Restated 2026-09-24 in the brief and confirmed by R-3.
- **Decision:** "Nobody can pay to change what CarIndex believes is right for the buyer." Commercial relationships, advertising, marketplace participation and transaction economics never influence recommendation ranking or editorial conclusions.
- **Why:** Trust is the product, and every monetization stage depends on it.
- **Implications:**
  - No paid placement in rankings.
  - Every monetization hypothesis must pass this test and D-18.
  - The Sep 8–10 designs already carry "No paid rankings · No dealer influence".
- **Status:** Active (permanent).

### D-02 — Recommendation Intelligence ≠ Commercial Ranking
- **Date:** Recorded 2026-09-24 (origin undated).
- **Decision:** Recommendation logic and any commercial ranking or marketplace offers are permanently separate systems. A partner can never buy a better recommendation.
- **Why:** This puts D-01 into practice, so that later commerce (Stage 3) cannot erode trust.
- **Implications:**
  - Offers use separate data paths and separate presentation.
  - Commercial data is never an input to ranking.
- **Status:** Active.

### D-03 — Independent and faceless brand
- **Date:** First documented 2026-07-15 in the brand book. Restated in `PRD.md` 2026-08-26.
- **Decision:** No on-camera personality. Authority comes from evidence.
- **Why:** Credibility rests on data and sourcing, not on a person or on dealer relationships.
- **Implications:** Media formats, voice and video production are designed without a presenter.
- **Status:** Active.

### D-04 — Data is the source of truth
- **Date:** Recorded 2026-09-24. The principle is quoted in the 2026-09-22 Reconciliation Report ("Data for truth"). The sourcing rules come from `PRD.md` 2026-08-26.
- **Decision:**
  - Every claim traces to sourced, dated data, or is explicitly flagged `[UNVERIFIED]`.
  - Where sources disagree, both values are shown.
  - Missing data is shown as missing, never filled in.
- **Why:** It is the basis of independence and of the moat.
- **Implications:** Vehicle Truth (WS-A) is the foundation for product and content. Content is audited to the same standard.
- **Status:** Active.

### D-05 — AI understands intent; deterministic software performs recommendation reasoning
- **Date:** Recorded 2026-09-24. The principle "AI for understanding. Software for reasoning. Data for truth." is quoted in the 2026-09-22 Reconciliation Report.
- **Decision:** AI interprets user intent into a structured preference profile. Ranking is done by deterministic, auditable software over Vehicle Truth and Vehicle Intelligence.
- **Why:** Rankings must be explainable, reproducible and auditable against D-01.
- **Implications:** No model-generated rankings. Explanations are derived from the deterministic scoring.
- **Status:** Active.

### D-06 — Model-first, not trim-first; trims are supporting observations
- **Date:** First documented 2026-09-24 in the design-lab `BRIEF.md` ("given by the owner").
- **Decision:** The model is the unit of recommendation and of Car Detail. Trims and variants are observations within the model. There is no page per trim.
- **Why:** Buyers decide between models first. Trim-level data is noisier and more conflicted.
- **Implications:** Canonical model identity is central to WS-A. The reconciled data layer is currently keyed per variant, so it must roll up to model level.
- **Status:** Active.

### D-07 — Arabic is first-class
- **Date:** 2026-08-06 for social content: Arabic-primary with inline English (`PRD.md`). 2026-09-24 for product: first-class RTL (design-lab `BRIEF.md`).
- **Decision:** Arabic is designed as its own layout, not mirrored from English at the end. All numerals are Latin (Western).
- **Why:** The primary audience is Egyptian.
- **Implications:** Every product surface and content format ships Arabic from day one. The Find My Car mock is English-only and does not yet meet this.
- **Status:** Active. The register (Egyptian colloquial or MSA) is still open.

### D-08 — Figma is a design system/workspace, not the source of design intelligence
- **Date:** Recorded 2026-09-24 (origin undated; no reviewed document mentions Figma).
- **Decision:** Figma holds and operates the design system. Design reasoning and identity rules live in CarIndex's own identity/playbook and its design skill.
- **Why:** Design intelligence stays with CarIndex, not with a tool.
- **Implications:** The Visual Identity Playbook v2 and the proprietary design skill come before the Figma DS.
- **Status:** Active.

### D-09 — Product development and brand/media building proceed in parallel
- **Date:** Recorded 2026-09-24 in the brief. Confirmed by R-2 the same day.
- **Decision:** Media, brand and audience growth run in parallel with product, not after it.
- **Why:** Audience and trust take time, and every monetization stage needs them.
- **Implications:**
  - WS-E and WS-F keep running while the Vertical Slice is built.
  - The `PRD.md` sequencing ("website after social pipeline is proven") is Historical. See S-02.
- **Status:** Active. C-01 is resolved.

### D-10 — Original homepage mockup rejected as a starting point
- **Date:** 2026-08-26 (`PRD.md`, owner review).
- **Decision:** `Website/index.html` (2026-07-28, the dark "Every car, indexed." concept) is not carried forward in layout, tone or visual direction.
- **Why:** The owner judged it not representative of CarIndex.
- **Implications:** The latest design direction is Sep 8–10. It is not formally approved.
- **Status:** Active.

### D-11 — Human approval gate on all published content
- **Date:** 2026-08-26 (`PRD.md`).
- **Decision:** No content publishes without human approval. The owner wants the steps after approval (publishing) automated. The gate itself stays.
- **Why:** The AI audit layer has no track record yet. Quality and sourcing protect the brand.
- **Implications:** Automation (WS-F) targets the publish and performance steps, not removal of approval.
- **Status:** Active.

### D-12 — "Unbiased" means the same evidentiary standard for every brand
- **Date:** Documented in `PRD.md` 2026-08-26. It originated earlier in `CLAUDE.md`.
- **Decision:** Every brand is held to the same standard of evidence. Equal airtime regardless of relevance is not the goal.
- **Why:** Buyer relevance decides coverage. Fairness decides treatment.
- **Implications:** Applies to both content selection and recommendation coverage.
- **Status:** Active.

### D-15 — North Star: independent automotive decision platform
- **Date:** 2026-09-24 (R-1).
- **Decision:** The North Star is the independent automotive decision platform. Content engagement is a growth and brand measure, not the North Star.
- **Why:** The core user job is a buying decision ("which cars should I consider — and why"). Engagement serves that job; it does not replace it.
- **Implications:**
  - Success measures lead with decision-journey outcomes. Engagement is tracked under growth/brand.
  - The earlier content-engagement north star is Historical. See S-01.
- **Status:** Active. C-04 is resolved.

### D-16 — "Evidence first. Interpretation explained. Recommendation earned."
- **Date:** 2026-09-24 (R-4).
- **Decision:** This replaces the strategic interpretation of "Numbers first, opinions last" as CarIndex's voice and editorial standard.
- **Why:** A decision platform must interpret and recommend. This standard allows that while keeping the evidence discipline and requiring the reasoning to be shown.
- **Implications:**
  - Sourcing rules under D-04 are unchanged.
  - Interpretation must be explained.
  - A recommendation is made only when the evidence and the stated logic support it.
  - "Numbers first, opinions last" as a strategic interpretation is Historical. See S-03.
  - Whether the removed "AI Recommendation" content pillar comes back is not decided here (D-13).
- **Status:** Active. C-03 is resolved.

### D-17 — No "LIVE" data claims without operational support
- **Date:** 2026-09-24 (R-5).
- **Decision:** CarIndex data is not described as "LIVE" until an operational refresh and change-detection system supports the claim.
- **Why:** The current data is a single dated snapshot (collected 2026-09-10). An unsupported "live" claim contradicts D-04 and puts trust at risk.
- **Implications:**
  - Show data as dated.
  - The "LIVE INDEX" wording in the Sep 6–10 designs and the old homepage is Historical. See S-04.
  - Refresh cadence remains open.
- **Status:** Active. C-08 is resolved for the claim rule; cadence is still open.

### D-18 — Structural separation of commercial economics from recommendation/editorial logic
- **Date:** 2026-09-24 (R-6).
- **Decision:** Monetization models remain hypotheses. Any model adopted must keep commercial economics structurally separate from recommendation and editorial logic.
- **Why:** This extends D-01 and D-02 to every revenue model, not only marketplace offers.
- **Implications:**
  - Every monetization hypothesis (H-01, D-14) is tested against this constraint.
  - Commercial data, partner status and transaction value are never inputs to ranking or editorial conclusions.
  - It does not decide which model or sequence is adopted.
- **Status:** Active.

### D-19 — Registration intelligence is strategically relevant; product role open
- **Date:** 2026-09-24 (R-7).
- **Decision:** Registration intelligence is strategically relevant to CarIndex. Its exact product role is **OPEN**.
- **Why:** Recorded as relevant by the owner. No role has been decided.
- **Implications:**
  - It stays on the strategic agenda.
  - No surface, buyer-journey stage or recommendation signal is assigned yet.
  - The Vehicle Registration Explorer is not yet placed in the roadmap.
- **Status:** Active (relevance). Role is open.

---

## Hypotheses

### H-01 — Staged monetization
- **Date:** 2026-09-24.
- **Hypothesis:**
  - Stage 1: social/video platform revenue and programmatic website ads.
  - Stage 2: value-added ownership services (finance, insurance, charging, maintenance, warranty).
  - Stage 3: automotive e-commerce, marketplace and transactions, once Find My Car has trust, traffic and brand recognition.
  - Later: B2B market/data intelligence.
- **Why:** Revenue follows audience, and then trust.
- **Implications:** Each stage is gated by D-01, D-02 and D-18.
- **Status:** Hypothesis. Its sequence conflicts with D-14; see C-02.

---

## Under review

### D-13 — "AI Recommendation" content pillar removed
- **Date:** On or before 2026-08-14. `PRD.md` confirms the 9-pillar list live from that date.
- **Decision (as recorded):** The pillar was removed because "a recommendation is an opinion, in tension with 'numbers first, opinions last'", and because it was a large trust ask for a new anonymous account.
- **Why under review:**
  - The first reason rests on S-03, which is now Historical under D-16.
  - The second reason (trust ask for a new account) was not addressed by the resolutions.
  - Whether the pillar is reinstated, reframed or kept removed is not decided.
- **Status:** Under review. The rationale is partly historical; the pillar decision is open.

### D-14 — PRD monetization sequence
- **Date:** Stated in `PRD.md` 2026-08-26. It originated earlier in `CLAUDE.md`.
- **Decision (as recorded):**
  - Phases 1–2: zero monetization.
  - Phase 3: affiliate.
  - Phase 4: ads.
  - Phase 5: e-commerce/VAS.
  - Phase 6: subscriptions/data API.
  - Separately, pulling data/API forward was recorded as a consideration, not a decision.
- **Why under review:**
  - Under D-18 this is a hypothesis, not a plan.
  - Its sequence still conflicts with H-01; see C-02.
- **Status:** Under review (hypothesis).

---

## Superseded / Historical

These are kept for traceability and no longer govern. The source documents were not edited. Where they still state these assumptions, the strategy files take precedence.

### S-01 — Content-engagement north star
- **Original:** "The goal is not 'produce content' — it's produce content the audience engages with, in order to grow the brand."
- **Source:** `PRD.md` (2026-08-26). `CarIndex_Roadmap_LIVE.md`, "Original objectives" #7.
- **Superseded by:** D-15 (2026-09-24).
- **Status:** Historical.

### S-02 — Website sequenced after the social pipeline
- **Original:** The website is "sequenced *after* the social pipeline is proven, not before"; the real build needs its own scoping "starting from a blank page".
- **Source:** `PRD.md` (2026-08-26).
- **Superseded by:** D-09 (2026-09-24).
- **Status:** Historical.

### S-03 — "Numbers first, opinions last" as strategic interpretation
- **Original:** The brand voice "Numbers first, opinions last", including its use to classify recommendations as opinion.
- **Source:** `PRD.md` (2026-08-26); `CLAUDE.md`.
- **Superseded by:** D-16 (2026-09-24). The sourcing discipline it carried continues under D-04.
- **Status:** Historical.

### S-04 — "LIVE INDEX" / live-data framing
- **Original:** "LIVE INDEX" and live market data framing.
- **Source:** Sep 6–10 homepage designs; `Website/index.html` (2026-07-28).
- **Superseded by:** D-17 (2026-09-24).
- **Status:** Historical.

---

## Conflicts register

| ID | Conflict | Sources | Status |
|---|---|---|---|
| C-01 | Product sequencing: `PRD.md` puts the website after the social pipeline; the brief runs brand and product in parallel | `PRD.md` 2026-08-26 vs. brief 2026-09-24 | **Resolved** by D-09 (R-2). PRD statement is Historical (S-02). |
| C-02 | Monetization sequence. The PRD has zero early monetization, an affiliate phase and subscriptions. H-01 has early platform/ad revenue, no affiliate phase and puts commerce last. Affiliate is transaction-linked; compatibility with D-18 is unassessed. | `PRD.md` vs. H-01 | **Open.** Both are hypotheses under D-18; the ordering is not resolved. |
| C-03 | Voice rule vs. recommendation product: "Numbers first, opinions last" and the D-13 rationale vs. a North Star built on recommending and explaining | `PRD.md` vs. North Star | **Resolved** by D-16 (R-4). Voice interpretation is Historical (S-03). The D-13 pillar question remains open. |
| C-04 | North Star definition: content engagement vs. independent decision platform | `PRD.md`, `CarIndex_Roadmap_LIVE.md` vs. brief | **Resolved** by D-15 (R-1). Old north star is Historical (S-01). |
| C-05 | Visual identity authority: brand book (2026-07-15) vs. Sep 10 designs vs. Visual Identity Playbook v2 (planned, not located). None is marked binding. | Brand book, Sep 10 PDFs, brief | **Open** |
| C-06 | Positioning line: "Every car, indexed." vs. "Know the market. Know your car." | Brand book / PRD vs. Sep 10 homepage | **Open** |
| C-07 | Arabic register: one review reads the Sep 10 Arabic as MSA-leaning, the other as Egyptian colloquial | Reconciliation Report 2026-09-22 vs. `00-design-plan.md` 2026-09-24 | **Open** |
| C-08 | "Live" claim vs. snapshot data | Sep 8–10 designs vs. dataset | **Resolved for the claim** by D-17 (R-5). "LIVE" framing is Historical (S-04). Refresh cadence remains open. |
| C-09 | Find My Car question set: 4 → 5 → adaptive → 9 steps (Step 7 missing). Natural-language mode intended but not designed. | Sep 8–10 designs | **Open** |
| C-10 | Market scope: documents say "Egypt/MENA"; data, content and designs are Egypt-only | `PRD.md`, brand book vs. data | **Open** |
