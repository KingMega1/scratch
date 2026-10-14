# X_2026-10-14_38522002564 — official Egypt OEM harvest, batch 1 (CANDIDATES ONLY)

Produced by `scripts/extract_official.py harvest` (GitHub Actions run 38522002564, mode `x1`) and
`scripts/extract_official.py extract` (offline, deterministic, rules in `scripts/extract_rules.py`). No LLM calls.
Nothing here is accepted; P2 verifies and accepts into `registry/`.

## Run
- Requests 934, HTTP 200 874 (PDFs 159), skipped 39 (robots.txt disallow/unreachable or blocked source), 763 MB, 1412s.
- Raw bytes: CI artifact `raw-pages-38522002564` (90 days). Committed evidence: `evidence.jsonl.gz` (page text, tables, links), `pdfs.jsonl.gz` (PDF text, sha256, bytes, pages), `fetch_manifest.json`, `robots_status.json`.

## Output rows
| File | Rows | Models |
|---|---|---|
| specs_candidates.csv | 62 | 3 |
| warranty_candidates.csv | 21 | 17 |
| brochure_candidates.csv | 50 | 47 |
| brochure_sources.csv (page + anchor each brochure was linked from) | 50 | |
| brand_statements.csv (brand-wide warranty text; NOT fanned out to models) | 17 | 7 brands |

## Models covered (53 of 272 allocated)

- nissan/sunny (18124): brochure (allocated: warranty+brochure)
- mg/zs (6861): brochure (allocated: warranty+brochure)
- chevrolet/optra (6427): warranty (allocated: warranty+brochure)
- mg/5 (4472): brochure (allocated: warranty+brochure)
- chery/arrizo-5 (4438): brochure (allocated: warranty+brochure)
- changan/cs55-plus (4263): brochure (allocated: brochure)
- chery/tiggo-4-pro (3784): brochure (allocated: warranty+brochure)
- jetour/t2 (3720): brochure (allocated: brochure)
- nissan/sentra (3687): brochure (allocated: warranty+brochure)
- jetour/dashing (2997): brochure (allocated: brochure)
- jetour/x70 (2856): brochure (allocated: brochure)
- mg/one (2464): brochure, warranty (allocated: warranty+brochure)
- mitsubishi/eclipse-cross (2269): brochure, specs (allocated: specs+warranty+brochure)
- chery/tiggo-7-pro (2074): brochure (allocated: brochure)
- chery/tiggo-8 (1789): brochure (allocated: warranty+brochure)
- renault/duster (1721): brochure (allocated: warranty+brochure)
- nissan/qashqai (1694): brochure, specs (allocated: specs+warranty+brochure)
- mg/gt (1665): brochure, warranty (allocated: warranty+brochure)
- jetour/t1 (1553): brochure (allocated: warranty+brochure)
- renault/taliant (1380): brochure, specs (allocated: specs+warranty+brochure)
- mg/hs (1338): brochure, warranty (allocated: warranty+brochure)
- forthing/t5-evo (1172): brochure, warranty (allocated: specs+warranty+brochure)
- jetour/x90-plus (1172): brochure (allocated: brochure)
- mg/7 (1147): brochure, warranty (allocated: warranty+brochure)
- renault/kardian (1023): brochure (allocated: warranty+brochure)
- chery/tiggo-8-pro-max (1009): brochure (allocated: brochure)
- renault/megane (978): brochure (allocated: brochure)
- renault/austral (964): brochure (allocated: warranty+brochure)
- changan/eado-plus (693): brochure (allocated: brochure)
- chevrolet/captiva (686): brochure (allocated: warranty+brochure)
- chery/arrizo-6-gt (640): brochure (allocated: brochure)
- deepal/s-05 (600): brochure (allocated: brochure)
- nissan/magnite (524): brochure (allocated: brochure)
- kia/k4 (445): warranty (allocated: warranty+brochure)
- nissan/x-trail (409): brochure (allocated: brochure)
- changan/uni-v (323): brochure (allocated: warranty+brochure)
- changan/cs75-plus (299): brochure (allocated: brochure)
- byd/sealion-5 (203): warranty (allocated: warranty+brochure)
- deepal/s-07 (179): brochure (allocated: brochure)
- forthing/s7 (151): brochure (allocated: brochure)
- chery/arrizo-8 (132): brochure, warranty (allocated: warranty+brochure)
- changan/uni-t (131): brochure (allocated: brochure)
- changan/eado (127): brochure (allocated: brochure)
- dongfeng/008 (114): warranty (allocated: warranty+brochure)
- dongfeng/007 (93): warranty (allocated: warranty+brochure)
- nissan/patrol (71): brochure (allocated: warranty+brochure)
- byd/atto-8 (38): warranty (allocated: warranty)
- kia/ev3 (23): brochure, warranty (allocated: specs+warranty+brochure)
- kia/ev5 (20): brochure, warranty (allocated: warranty+brochure)
- kia/ev6 (11): brochure, warranty (allocated: warranty+brochure)
- chery/eq7 (10): brochure (allocated: warranty+brochure)
- kia/ev9 (3): brochure, warranty (allocated: warranty+brochure)
- chery/tiggo-9 (0): brochure, warranty (allocated: warranty+brochure)

## Sources (issuer: rows)
- Nissan Egypt official site (en.nissan.com.eg): 57
- Chery Egypt official site (www.chery-eg.com): 13
- Renault Egypt official site (renault.com.eg): 11
- MG Egypt official site (www.mgmotor.com.eg): 10
- Kia Egypt official site (kia.com.eg): 9
- Mitsubishi Egypt official site (www.mitsubishimotors-eg.com): 6
- Changan Egypt official site (changan.com.eg): 6
- Jetour Egypt official site (jetouregypt.com): 6
- BYD Egypt official site (byd-egypt.com): 4
- Deepal Egypt official site (www.deepal-eg.com): 4
- Forthing Egypt official site (forthing-egypt.com): 3
- Chevrolet Egypt official site (www.chevroletarabia.com): 2
- Dongfeng Egypt official site (dongfeng-egypt.com): 2

## Rules applied (what P2 should know)
- Attribution: a page/PDF counts for a p1_id only when its URL path / file name carries exactly that model token (the longest token wins, ties dropped), or the PDF is linked from that model's own page and its file name names no other powertrain variant (REEV/PHEV/EV/DM...). Hashed PDF names: attributed only if exactly one model name of the brand appears in the text (≥3 times).
- Market: only Egypt locales (`/eg-ar`, `/eg-en`, `/eg`) on multi-market hosts (chevroletarabia, gmcarabia, cadillacarabia, xpeng, volvocars, genesis). Lebanon/Iraq/UAE/AU/NZ pages are excluded.
- Brochures: warranty booklets, maintenance schedules, spec sheets and drafts are not brochures. A brochure linked only from a brochure index page is dropped when the same model has a brochure on its own model page, because index pages keep superseded generations (e.g. renault.com.eg 2022 Duster).
- `model_year` is filled only when the document states it (`MY2026`, `27MY_`, Nissan price-JSON key `2026-<model>`). WordPress upload folders (`/2026/02/`) are upload dates, not model years. In this batch every model_year is blank, meaning it is not stated.
- Warranty: years+km from one statement (English/Arabic, Arabic digits, `ألف`). Statements may span up to 3 rendered lines. Extended/paid warranties and service packages are excluded. `scope` = page|brochure + component (vehicle/battery/engine). A years-only row (km blank) means the source states no km.
- Specs: exact grade blocks on en.nissan.com.eg; a field with two different values inside one grade block is omitted (Qashqai N-connecta Plus kerb weight). For renault.com.eg, the dimension table has no trim split, so rows carry trim `ALL (source table has no trim split)`. For PDF single-line spec rows under a multi-grade header, trim is `ALL listed grades (...); single value printed`. Multi-value rows, and column-layout PDF tables (Forthing, Renault engine table), are omitted.

## Not covered in this batch
- Hosts unreachable or 403 from GitHub runners: https://baicegypt.com, https://dfsk-egypt.com, https://forthing.com.eg, https://gac-egypt.com, https://gacmotor-eg.com, https://geely-egypt.com, https://jac-egypt.com, https://jac.com.eg, https://kaiyi-egypt.com, https://kaiyiegypt.com, https://proton-egypt.com, https://suzuki-egypt.com, https://suzuki.com.eg, https://www-europe.nissan-cdn.net, https://www.alfaromeo-eg.com, https://www.alfaromeoegypt.com, https://www.audi-egypt.com, https://www.audi.com.eg, https://www.baic-egypt.com, https://www.bmw-egypt.com, https://www.chevrolet.com.eg, https://www.citroen-eg.com, https://www.cupra-egypt.com, https://www.cupraofficial.com.eg, https://www.fiat-egypt.com, https://www.fiategypt.com, https://www.forthingegypt.com, https://www.gacegypt.com, https://www.greatwall.eg, https://www.jacegypt.com, https://www.jeep-egypt.com, https://www.jeepegypt.com, https://www.lynkco-egypt.com, https://www.mercedes-benz.com.eg, https://www.opelegypt.net, https://www.peugeot-eg.com, https://www.protonegypt.com, https://www.renault-egypt.com, https://www.renaultegypt.com, https://www.seat-egypt.com, https://www.seategypt.com, https://www.skoda-eg.com, https://www.suzukiegypt.com, https://www.volkswagen-egypt.com, https://www.vw-egypt.com, https://www.vw.com.eg.
- Soueast (robots disallow) and changanegypt.com (not official) were not fetched.
- PROBE hosts that failed DNS/TLS were guesses, not confirmed official domains.
- PDF cap (160) was reached, so some linked PDFs were not downloaded.

