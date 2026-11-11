# AT-51 enrichment and acceptance checkpoint — 2026-10-12
Status: PARTIAL / VERIFYING. Preview verified; full enrichment and canonical acceptance incomplete. No worker is currently running.

## Coverage
Original website: 24 models = 21 records from the P2 S6 SUV/crossover EGP1.6–2.4M slice (registration threshold >=500 through accepted aliases) plus 3 website extras. That recommendation-oriented slice was incorrectly used as the entire catalogue.
Versioned P2-CATALOGUE-U11-S6-2026-10-12-RC1 preview: all 283 exact U11 on-sale identities. 21 have S6 evidence; 262 remain identity-only. Three off-sale extras excluded from serving, retained upstream. No P1 ranking/parser or recommendation semantics changed.
Canonical P2 ID acceptance remains 0: 21 provisional IDs, 262 unassigned. No new canonical database.

## Served fields
20 models have resolved price/range; 1 price conflict; 262 unknown. Only 5 models have price source effective dates. 21 have trim/spec records; 14 warranty records. Zero exact accepted heroes/logos/galleries.
Six official Egypt Nissan PDF documents are now bound to EN/AR detail pages: Magnite, Sunny, Sentra, Qashqai, X-Trail, Patrol. Release P2-BROCHURES-2026-10-12-RC1: hashes, byte/page counts, issuer and official parent URLs retained. Effective dates remain null. Trim/version applicability must be verified before factual promotion. Six preview links do not mean six canonically accepted brochure-fact records.
The baseline CSV predates these bindings. Delta CSV source_verified_brochure_candidate identifies the six bound candidates; official_egypt_brochure_integrated in that CSV retains the original accepted-baseline value.

## Fresh source capture
Existing P2 official factory reused: 70 pages, 69 successful captures, 339 observations, 21 exceptions, zero LLM extraction. Official observations cover 51 active U11 models; HIGH price observations cover 33 models and HIGH specifications 31. All staged, not served. Snapshot: vehicle-data/snapshots/official/O4_2026-10-12_38297639900. Raw artifact 11769825381 SHA256 70d55aa61399a749c71215b1160ce31942fef0907b3dbe2558a89789454cd375.
Eight PDF files captured and extracted, six reviewed and linked. MG5/MG7 documents held for insufficient exact model/region/version markers. 2,801 raw asset URLs are candidates, not accepted usable imagery. Existing Drive inventory: 36 mixed PDF files (duplicates, brochures and price lists), not 36 models.
MG HS original source URL returned 404. Official replacement https://www.mgmotor.com.eg/model/new-hs/ independently read; config corrected in f85481ffe89c29c544fb0cd3c9751148b6d4fba9. Hybrid power conflicts within the page: prose 221hp vs table 200hp. Petrol 170hp is a distinct variant. No conflicting value promoted. Corrected config has not yet been recaptured by the worker.

## Discovery
Official-source candidates absent from all 393 U11 identities: MG Cyberster, Toyota RAV4/Prado/Camry, Kia Carnival, Skoda Scala. Staged candidates only: registration/current availability/canonical mapping still require review. Smart #1/#3/#5 official listings conflict with U11 off-sale state; preserve conflicts. Toyota generic lineup extractor returned EMPTY_EXTRACTION, never inferred delisting.

## Acceptance
Code 1bcff13fd5f3c9eec4a2790353d09ed9e8d276ee. Protected preview https://carindex-gbbg274y4-car-index.vercel.app.
CI 38298475603: 60 unit, 158 browser, 15 P1 integration and 6 production-boundary checks passed.
Independent deployed run 38299249828 passed: 158 browser + 15 integration checks; all 566 EN/AR model routes, filters/pagination, detail/recommendation links, desktop/mobile, and six bilingual brochure bindings. Unauthenticated preview returns Vercel SSO 302.
Official worker 38297639900 passed 7 discovery/asset regressions. Raw data readback verified before reports.

## Remaining execution
P2 canonical ID acceptance; price/date/trim conflict resolution and promotion; exact HQ hero/logo/gallery QA; broader Egypt brochure acquisition and fact extraction; missing candidate registration/availability; expand primary-source coverage beyond nine brands.
Existing worker now includes deterministic discovery, content hashing, exception-safe change detection, staging enrichment and regression tests. Scheduled cadence remains OFF. AT-46 n8n dispatcher is recovered but its allowlist includes only synthetic AT46-SYN01; real P2 routing remains unactivated. Reuse that dispatcher; do not create a competing scheduler. No production deployment or PR merge performed.
