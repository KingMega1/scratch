# CarIndex — Decision Log

**Purpose:** Record major, durable strategic decisions. It does not record task-level or technical choices.
**Last updated:** 2026-09-24
**Companion:** [`CARINDEX_ROADMAP.md`](./CARINDEX_ROADMAP.md)

**Status values**
- **Active:** decided and in force
- **Hypothesis:** direction under test; not a decision
- **Under review:** a conflict exists; needs an owner decision
- **Superseded:** replaced by a later decision (the replacement is named)
- **Rejected:** explicitly discarded

**About the date column**
- Where a decision's origin date is documented, that date is used and its source is named.
- Where no dated source was found, the entry reads "Recorded 2026-09-24 (origin undated)". It was confirmed in the owner's brief of that date.

---

## Active decisions

### D-01 — Permanent independence
- **Date:** First documented 2026-07-15 (brand book values). Restated 2026-09-24.
- **Decision:** "Nobody can pay to change what CarIndex believes is right for the buyer." Commercial relationships, advertising, marketplace participation and transaction economics never influence recommendation ranking or editorial conclusions.
- **Why:** Trust is the product. Every monetization stage depends on it.
- **Implications:**
  - No paid placement in rankings.
  - Every monetization hypothesis must pass this test.
  - The Sep 8–10 designs already carry "No paid rankings · No dealer influence".
- **Status:** Active

### D-02 — Recommendation Intelligence ≠ Commercial Ranking
- **Date:** Recorded 2026-09-24 (origin undated)
- **Decision:** Recommendation logic and any commercial ranking or marketplace offers are permanently separate systems. A partner can never buy a better recommendation.
- **Why:** This puts D-01 into practice, so that later commerce (Stage 3) can't erode trust.
- **Implications:**
  - Separate data paths and presentation for offers.
  - Commercial data is never an input to ranking.
- **Status:** Active

### D-03 — Independent and faceless brand
- **Date:** First documented 2026-07-15 (brand book). Restated in `PRD.md` 2026-08-26.
- **Decision:** CarIndex has no on-camera personality. Its authority comes from evidence.
- **Why:** Credibility rests on data and sourcing, not on a person or dealer relationships.
- **Implications:** Media formats, voice and video production are designed without a presenter.
- **Status:** Active

### D-04 — Data is the source of truth
- **Date:** Recorded 2026-09-24. The principle is quoted in the 2026-09-22 Reconciliation Report ("Data for truth"). The sourcing rules date from `PRD.md` 2026-08-26.
- **Decision:** Every claim traces to sourced, dated data or is explicitly flagged `[UNVERIFIED]`. Where sources disagree, both values are shown. Missing data is shown as missing, never filled in.
- **Why:** This is the basis of independence and of the moat.
- **Implications:**
  - Vehicle Truth (WS-A) is the foundation for product and content.
  - Content is audited against the same standard.
- **Status:** Active

### D-05 — AI understands intent; deterministic software performs recommendation reasoning
- **Date:** Recorded 2026-09-24. The principle "AI for understanding. Software for reasoning. Data for truth." is quoted in the 2026-09-22 Reconciliation Report.
- **Decision:** AI interprets what the user wants and produces a structured preference profile. Ranking is done by deterministic, auditable software over Vehicle Truth and Intelligence.
- **Why:** Rankings must be explainable, reproducible and auditable against D-01.
- **Implications:**
  - No model-generated rankings.
  - Explanations are built from the deterministic scoring.
- **Status:** Active

### D-06 — Model-first, not trim-first; trims are supporting observations
- **Date:** First documented 2026-09-24 (design-lab `BRIEF.md`, "given by the owner")
- **Decision:** The model is the unit of recommendation and the Car Detail page. Trims and variants are observations within the model. There is no page per trim.
- **Why:** Buyers decide between models first. Trim-level data is noisier and more conflicted.
- **Implications:**
  - Canonical model identity is central to WS-A.
  - The data's reconciled layer is currently keyed per variant, so trims have to be rolled up to models (see the Roadmap, §8).
- **Status:** Active

### D-07 — Arabic is first-class
- **Date:**
  - 2026-08-06: Arabic-primary with inline English, for social content (`PRD.md`)
  - 2026-09-24: first-class RTL for product (design-lab `BRIEF.md`)
- **Decision:** Arabic is designed as its own layout, not mirrored from English at the end. All numerals are Latin (Western).
- **Why:** The primary audience is Egyptian.
- **Implications:** Every product surface and content format ships Arabic from day one. The Find My Car mock (English only) does not yet meet this.
- **Status:** Active. The register (Egyptian colloquial vs. MSA) is unresolved; see the Roadmap, §14.

### D-08 — Figma is a design system/workspace, not the source of design intelligence
- **Date:** Recorded 2026-09-24 (origin undated; no reviewed document mentions Figma)
- **Decision:** Figma holds and operates the design system. Design reasoning and identity rules live in CarIndex's own identity/playbook and design skill.
- **Why:** Design intelligence should sit with CarIndex, not with one tool.
- **Implications:** The Visual Identity Playbook v2 and the proprietary design skill come before the Figma DS.
- **Status:** Active

### D-09 — Brand building happens alongside product development
- **Date:** Recorded 2026-09-24 (origin undated)
- **Decision:** Media, brand and audience growth run in parallel with product, not after it.
- **Why:** Audience and trust take time. Every monetization stage needs them.
- **Implications:** WS-E and WS-F keep running while the Vertical Slice is built.
- **Status:** Active. It conflicts with an earlier statement; see C-01.

### D-10 — Original homepage mockup rejected as a starting point
- **Date:** 2026-08-26 (`PRD.md`, owner review)
- **Decision:** `Website/index.html` (2026-07-28, dark "Every car, indexed." concept) is not carried forward in layout, tone or visual direction.
- **Why:** The owner judged that it does not represent what CarIndex should be.
- **Implications:** The latest design direction is Sep 8–10. It has not been formally approved.
- **Status:** Active

### D-11 — Human approval gate on all published content
- **Date:** 2026-08-26 (`PRD.md`)
- **Decision:** No content publishes without human approval. The owner wants the steps after approval (publishing) automated. The gate itself stays.
- **Why:** The AI audit layer has no track record yet. Quality and sourcing protect the brand.
- **Implications:** Automation (WS-F) targets the publish and performance steps, not the removal of approval.
- **Status:** Active

### D-12 — "Unbiased" means the same evidentiary standard for every brand
- **Date:** Documented in `PRD.md` 2026-08-26 (origin earlier, in `CLAUDE.md`)
- **Decision:** Every brand is held to the same standard of evidence. Brands don't get equal airtime regardless of relevance.
- **Why:** Buyer relevance decides coverage, and fairness decides treatment.
- **Implications:** Applies to both content selection and recommendation coverage.
- **Status:** Active

---

## Hypotheses

### H-01 — Staged monetization
- **Date:** 2026-09-24
- **Hypothesis:**
  - Stage 1: social/video platform revenue and programmatic website ads.
  - Stage 2: value-added ownership services (finance, insurance, charging, maintenance, warranty).
  - Stage 3: automotive e-commerce / marketplace / transactions, once Find My Car has trust, traffic and brand recognition.
  - Later: B2B market/data intelligence.
- **Why:** Revenue follows audience, and then trust.
- **Implications:** Each stage is gated by D-01 and D-02.
- **Status:** Hypothesis. It conflicts with an earlier sequence; see C-02.

---

## Under review

### D-13 — "AI Recommendation" content pillar removed
- **Date:** On or before 2026-08-14 (`PRD.md`: the 9-pillar list confirmed live from that date)
- **Decision (as recorded):** The pillar was removed because "a recommendation is an opinion, in tension with 'numbers first, opinions last'", and because it is a large trust ask for a new anonymous account.
- **Why it's under review:** The North Star is now a recommendation-and-explanation platform. See C-03.
- **Status:** Under review

### D-14 — PRD monetization sequence
- **Date:** Stated in `PRD.md` 2026-08-26 (earlier origin in `CLAUDE.md`)
- **Decision (as recorded):**
  - Phases 1–2: zero monetization.
  - Phase 3: affiliate.
  - Phase 4: ads.
  - Phase 5: e-commerce / VAS.
  - Phase 6: subscriptions / data API.
  - Also recorded: a consideration (not a decision) to pull data/API forward.
- **Why it's under review:** It differs from H-01. See C-02.
- **Status:** Under review

---

## Conflicts register

| ID | Conflict | Sources | Status |
|---|---|---|---|
| C-01 | **Product sequencing.** `PRD.md` sequences the website *after* the social pipeline is proven and wants it scoped "from a blank page". D-09 runs brand and product in parallel, and design work has run since Sep 6. | `PRD.md` 2026-08-26 vs. brief 2026-09-24 | Open. The owner should mark the PRD statement Superseded. |
| C-02 | **Monetization sequence.** The PRD has zero early monetization, an affiliate phase, and subscriptions. H-01 has early platform/ad revenue, no affiliate phase, no subscriptions, and commerce last. Affiliate income is also transaction-linked, which bears on D-01. | `PRD.md` vs. H-01 | Open |
| C-03 | **Voice rule vs. recommendation product.** "Numbers first, opinions last" and the D-13 rationale vs. a North Star built on recommending models and explaining why. | `PRD.md` vs. North Star | Open |
| C-04 | **North Star definition.** "Produce content the audience engages with, to grow the brand" vs. "independent automotive decision platform". | `PRD.md`, `CarIndex_Roadmap_LIVE.md` vs. brief 2026-09-24 | Open. The older statement is still active in the n8n docs. |
| C-05 | **Visual identity authority.** The brand book (2026-07-15) is ranked highest in the design lab. The Sep 10 designs are the newest. Visual Identity Playbook v2 is planned but not located. No document marks any of them binding. | Brand book, Sep 10 PDFs, brief | Open |
| C-06 | **Positioning line.** "Every car, indexed." (brand book, PRD) vs. "Know the market. Know your car." (Sep 10). | Brand book / PRD vs. Sep 10 homepage | Open |
| C-07 | **Arabic register.** One review reads the Sep 10 Arabic as MSA-leaning; another reads it as Egyptian colloquial. | Reconciliation Report 2026-09-22 vs. `00-design-plan.md` 2026-09-24 | Open. Needs a native-speaker decision. |
| C-08 | **"Live" claim vs. snapshot data.** The designs promise a "LIVE INDEX". The data is one collection (2026-09-10). | Sep 8–10 designs vs. dataset | Open |
| C-09 | **Find My Car question set.** 4 → 5 → adaptive → 9 steps (Step 7 missing) across the Sep 8–10 artifacts. Natural-language mode is intended but has no design. | Sep 8–10 designs | Open |
| C-10 | **Market scope.** The documents say "Egypt/MENA". Data, content and designs are Egypt only. | `PRD.md`, brand book vs. data | Open |
