# AT-51 full vehicle enrichment acceptance baseline — 12 Oct 2026
This audit separates route coverage from complete vehicle enrichment, as required by the latest CEO clarification.

Denominator: 283 pinned U11 on-sale identities. Website code is still the previously tested protected preview.
| Field | Existing record numerator | Denominator | Acceptance qualification |
|---|---:|---:|---|
| Bilingual detail routes | 283 | 283 | Deployed QA run 38293345906 PASS |
| Canonical accepted P2 IDs | 0 | 283 | 21 IDs PROVISIONAL; 262 unassigned |
| Resolved price/range records | 20 | 283 | P2 S6 record presence; 1 conflict; 262 unknown |
| Source effective date present | 5 | 283 | Date not inferred from observation/HTTP date |
| Trim records | 21 | 283 | Existing S6 only |
| Any specification records | 21 | 283 | Presence is not complete per-variant official verification |
| Warranty record | 14 | 283 | Existing S6 record; current terms review remains |
| Official logo accepted for serving | 0 | 283 | Not recorded in this serving release |
| Exact-model hero accepted | 0 | 283 | 14 temporary image candidates, none exact-accepted |
| Verified gallery integrated | 0 | 283 | No accepted gallery binding in serving release |
| Official Egypt brochure integrated | 0 | 283 | Drive inventory and source captures are separate candidates |
| Accepted extracted brochure facts integrated | 0 | 283 | Magnite source facts now staged; no canonical promotion |

Evidence scope: web/data/registry/catalogue-serving.release.json + source P2 S6 snapshot + display-crosswalk.TEMP.json at c398a3456558bd8a86fed1f71be046da077d29b3.
Zero media numerators refer to accepted serving integration, not absence of assets anywhere in Drive.
Drive Automotive Updates inventory: 36 PDF metadata records, including brochures, duplicates and price lists; file count is not model coverage.
Nissan Magnite Egypt brochure was read: engine displacement 999cc, power 100hp, torque 152Nm, ground clearance 205mm, combined consumption 6.3L/100km and 5-year/150,000km warranty are staged with page/table references.
Brochure effective date is unknown; no price inferred; variant applicability and current warranty terms remain review items.
Chery Tiggo 7 Pro brochure was read and remains staged; marketing copy was not converted to missing technical facts.

A new real worker was started at commit 60e38e7a2db0de678104f3d572785f47740b72c7 to reuse the existing 70-page/54-model official P2 registry.
It performs fresh official fact extraction, asset candidate discovery, bounded PDF capture/extraction, provenance hashing and regression checks.
Its actual outcome must be read from run 38297639900, not assumed from this audit.
No new database, no P1 semantic change, no production promotion, no fabricated enrichment acceptance.
