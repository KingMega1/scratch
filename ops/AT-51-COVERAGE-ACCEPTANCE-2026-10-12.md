# AT-51 — Egypt Market Catalogue Coverage / verified return, 12 October 2026

State: VERIFYING. Engineering and protected-preview acceptance PASS. Overall scope PARTIAL until P2 canonical serving/identity acceptance and recurring n8n routing are completed.

## Verified result
| Measure | Previous S6 website source | Tested protected preview |
|---|---:|---:|
| Total served models | 24 | 283 |
| Exact U11 on-sale identities covered | 21/283 (7.42%) | 283/283 (100%) |
| Missing on-sale detail routes | 262 | 0 |
| Models retaining P2 S6 evidence | 21 on-sale + 3 off-sale retained upstream | 21 on-sale |
| Identity-only rows with unknown prices/specs | — | 262 |

Price states: 18 RESOLVED, 2 RESOLVED_RANGE, 1 CONFLICT, 262 UNKNOWN.
Tucson's six upstream conflict records survive; no averaging. MG HS freshness still differs between P1/P2 snapshots.
Coverage means pinned U11 identities and functioning pages; it does not mean 283 completely enriched or newly official-verified market records.
P2 IDs remain provisional for existing rows and null for the 262 added rows. No canonical approval or new IDs were fabricated.

## Exact cause of the 24-model limit
The website's sync uses vehicle-data/views/p1_suv_2m.json at 6f3df7dc12bd389d924ad9a74cad1c0533913cf7.
That slice was built for SUVs/crossovers with an S0 trim price in EGP 1.6–2.4M and at least 500 passenger first registrations through an accepted registration alias.
Twenty-one qualify; three extra evidence rows fail slice/registration rules. The subset became the whole catalogue.
P1 separately uses 393 U11 identities / 283 on sale. AT-51 corrected nine bad prior IDs, including three falsely classified as missing.
The fix uses exact audited U11 identity mappings, not name-derived P1 IDs.

## Changes
- Versioned generated serving release P2-CATALOGUE-U11-S6-2026-10-12-RC1 inside the existing website read-model.
- All 283 on-sale U11 identities connected to browse, detail, filter and recommendation-link surfaces.
- Existing P2 price/spec/provenance retained; 262 new rows have unknown price/specs, no guessed trims/images.
- Three U11 off-sale rows excluded from serving: byd/song-plus, citroen/c5-aircross, byd/song-l-dm-i. Upstream evidence remains.
- No changes to P1 datasets, release files, parser, ranking or scoring.
- Corrected broad-catalogue copy, PHEV filter exposure and generic unknown-image rendering.
- Existing P2 refresh worker extended with official discovery, hash change detection, source-health guards, exact crosswalk checks, bounded model-page evidence capture and stage-only review queue.
- No competing database or new scheduler.

## Acceptance evidence
Code/deployment SHA: 0653a9db319185d09ed1ea4a02a692338873079b.
CI 38292764736: SUCCESS — 59/59 unit, 154 preview browser checks, 15/15 P1 integration, 6/6 production-boundary fixtures.
Deployed 38293345906: SUCCESS — 154 desktop/mobile browser checks plus 15/15 P1 integration.
All 566 English/Arabic detail routes tested on both desktop/mobile; 283 catalogue rows per locale; filters/pagination, uncertainty, exclusions, overflow, WCAG and recommendation links passed.
Unauthenticated preview request: 302 to Vercel SSO; protection retained.
Deployment dpl_Bxky3Le4wbRQYrJf18kPCzeBkx3c: READY, preview target, public=false.
CI artifact 11766702684 SHA256 3e01a85d704cc33fc95ee1c6c06c4f34b5b29dafc78d2ce979560c40aee8e3e3.
Deployed artifact 11766409655 SHA256 7262dbf1a0677ce4359f5da19d7aa90a16288e45e6844ba678fbc682a4ad1220.
First browser failures were an ambiguous selector and obsolete subset test assertions; corrected-head tests passed. No unresolved test failure is hidden.

## Discovery and enrichment evidence
Existing P2 worker run 38293302209: SUCCESS; five deterministic regressions passed.
Snapshot observed_at: 2026-10-12T18:47:56Z.
Nissan: 9 lineup entries (7 passenger identities already in U11 + 2 Navara commercial variants for scope review).
smart: 3 official lineup entries; smart/1, smart/3, smart/5 conflict with U11 off-sale status. Duplicate hashtag IDs require P2 identity review.
Toyota: EMPTY_EXTRACTION; no delisting, current availability or price inference.
Eight exact source pages captured with content hashes and compressed evidence for P2 review. Prices/specifications remain UNKNOWN until extraction and acceptance.
Twelve current-entry review items persist, including three smart availability conflicts. Captured pages are not accepted normalized vehicle facts.
Toyota Camry/RAV4/Prado are official-index discovery candidates absent from U11; live lineup verification remains incomplete. No launch or availability claim promoted.
Automated worker/request path is proven; recurring n8n routing is not activated or asserted.

## Source evidence
- P2 S6: https://github.com/KingMega1/scratch/blob/6f3df7dc12bd389d924ad9a74cad1c0533913cf7/vehicle-data/README.md
- U11 file SHA256: 148c28900733fd972c325c43b3959ac5c4c8b646d8287f057f792dbf9ced1209 (checked by P1 verifier and official worker).
- Nissan official lineup: https://en.nissan.com.eg/vehicles/new.html
- smart official importer lineup: https://smart.ezzelarabstar.com/product-category/smart-5/
- Toyota official discovery source: https://toyota.com.eg/ar/brochures (live extraction empty).
- Source hashes, captured-page refs and review queue: vehicle-data/snapshots/official-lineups/latest.json on PR #7.
- AT-51 authoritative task: https://app.notion.com/p/3f36811407bc819c8faaeaf0bfe57cbb
- AT-39 factory: https://app.notion.com/p/3ec6811407bc81e4ba5edf713b70b481

## Remaining risk / next autonomous edge
1. P2 accountable review must accept/rework RC1 and resolve canonical ID status; P5 integrates the accepted release.
2. Enrich 262 rows against existing evidence and official sources; source absence elsewhere has not been asserted.
3. Expand official lineup source mapping beyond this bounded batch; resolve Toyota rendering and smart/JAC availability discrepancies without altering P1 semantics.
4. Connect the proven existing worker to n8n event/cadence routing. No recurring scan currently claimed.
5. Commercial vehicle inclusion is a material launch-scope decision only if proposed for inclusion; currently staged.

No external blocker requiring CEO intervention was established. Remaining owner acceptance and routing are internal dependencies.
Completed jobs are not ongoing workers; no later autonomous continuation is promised.
Tokens and actual provider costs are not exposed. No paid tier or credits were purchased.

## Review links
- Protected preview: https://carindex-4ely9gsdm-car-index.vercel.app/en/market/catalog
- Website PR: https://github.com/KingMega1/scratch/pull/6
- P2 discovery PR: https://github.com/KingMega1/scratch/pull/7
- Deployed QA: https://github.com/KingMega1/scratch/actions/runs/38293345906
