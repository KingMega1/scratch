#!/usr/bin/env python3
"""Write <snap>/SUMMARY.md for an X_* candidate snapshot (models covered, rows per file, sources).
Usage: extract_summary.py <snap> [--note "free text"]"""
import csv, json, collections, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


RULES = """## Rules applied (what P2 should know)
- Attribution: a page/PDF counts for a p1_id only when its URL path / file name carries exactly that model token
  (longest token wins, ties dropped; `the-`/`new-` prefixes and `-CKD`/`-CBU`, `Brochure...` suffixes ignored, a `*-ckd`
  p1_id still wins), or the PDF is linked from that model's own page and its file name names no other powertrain
  variant (REEV/PHEV/EV/DM...). Hashed PDF names: attributed only if exactly one model name of the brand occurs in the
  text (>=3 times, or in the first-page title).
- Market: only Egypt locales (`/eg-ar`, `/eg-en`, `/eg`) on multi-market hosts (chevroletarabia, gmcarabia,
  cadillacarabia, xpeng, volvocars, genesis); Lebanon/Iraq/UAE/AU/NZ pages are excluded.
- Brochures: warranty booklets, maintenance schedules, spec sheets and drafts are not brochures. A brochure linked
  only from a brochure index page is dropped when the same model has a brochure on its own model page (index pages
  keep superseded generations, e.g. renault.com.eg 2022 Duster). `brochure_sources.csv` gives page + anchor.
- `model_year` only when the document states it (`MY2026`, `27MY_`, Nissan price-JSON key `2026-<model>`); WordPress
  upload folders (`/2026/02/`) are upload dates, not model years. Blank = not stated by the source.
- Warranty: years+km from one statement (English/Arabic, Arabic digits, tatweel, `ألف`, months divisible by 12), up
  to 3 rendered lines; extended/paid warranties and service packages excluded. `scope` = page|brochure|warranty
  booklet + component (vehicle / battery / engine / transmission / paint / commercial use / other). Booklet
  "battery" rows may be the 12 V battery: read the quote. km blank = the source states no km.
- Specs: exact grade blocks on en.nissan.com.eg (a field with two values inside one grade block is omitted);
  renault.com.eg dimension tables have no trim split -> trim `ALL (source table has no trim split)`; PDF single-line
  rows under a multi-grade header -> trim `ALL listed grades (...); single value printed`. Multi-value rows and
  column-layout PDF tables are omitted."""


def main(S, note=""):
    rd = lambda f: list(csv.DictReader(open(os.path.join(S, f)))) if os.path.exists(os.path.join(S, f)) else []
    sp, wa, br, bs = rd("specs_candidates.csv"), rd("warranty_candidates.csv"), rd("brochure_candidates.csv"), rd("brand_statements.csv")
    rep = json.load(open(os.path.join(S, "run_report.json")))
    rob = json.load(open(os.path.join(S, "robots_status.json")))
    alloc = [r for r in csv.DictReader(open(os.path.join(ROOT, "handoff", "parallel-allocation-20261014.csv"))) if r["claude_cloud_extraction"]]
    cov = collections.defaultdict(set)
    for name, rows in (("specs", sp), ("warranty", wa), ("brochure", br)):
        for r in rows:
            cov[r["p1_id"]].add(name)
    name = os.path.basename(os.path.normpath(S))
    run_id = name.rsplit("_", 1)[-1]
    o = [f"# {name}: official Egypt OEM harvest (CANDIDATES ONLY)", "",
         f"Produced by `scripts/extract_official.py harvest` (GitHub Actions run {run_id}, mode `x1`) and "
         "`scripts/extract_official.py extract` (offline, deterministic, rules in `scripts/extract_rules.py`). "
         "No LLM calls. Nothing here is accepted; P2 verifies and accepts into `registry/`.", ""]
    if note:
        o += [note, ""]
    o += ["## Run",
          f"- Requests {rep['requests']}, HTTP 200 {rep['ok']} (PDFs {rep['pdfs_ok']}), skipped {rep['skipped']} "
          f"(robots.txt disallow/unreachable or blocked source), {rep['bytes'] / 1e6:.0f} MB, {rep['seconds']}s.",
          f"- Raw bytes: CI artifact `raw-pages-{run_id}` (90 days). Committed evidence: `evidence.jsonl.gz` (page text, "
          "tables, links), `pdfs.jsonl.gz` (PDF text, sha256, bytes, pages), `fetch_manifest.json`, `robots_status.json`.", "",
          "## Output rows", "| File | Rows | Models |", "|---|---|---|",
          f"| specs_candidates.csv | {len(sp)} | {len({r['p1_id'] for r in sp})} |",
          f"| warranty_candidates.csv | {len(wa)} | {len({r['p1_id'] for r in wa})} |",
          f"| brochure_candidates.csv | {len(br)} | {len({r['p1_id'] for r in br})} |",
          f"| brochure_sources.csv (page + anchor each brochure was linked from) | {len(br)} | |",
          f"| brand_statements.csv (brand-wide warranty text; NOT fanned out to models) | {len(bs)} | {len({r['brand'] for r in bs})} brands |",
          "", f"## Models covered ({len(cov)} of {len(alloc)} allocated)"]
    for r in sorted(alloc, key=lambda r: -int(r["registrations_last12"] or 0)):
        if r["p1_id"] in cov:
            o.append(f"- {r['p1_id']} ({r['registrations_last12']}): {', '.join(sorted(cov[r['p1_id']]))} (allocated: {r['claude_cloud_extraction']})")
    o += ["", "## Sources (issuer: rows)"]
    for k, v in collections.Counter(r["issuer"] for rows in (sp, wa, br) for r in rows).most_common():
        o.append(f"- {k}: {v}")
    o += ["", RULES, "",
          "## Not covered by this run",
          "- Hosts unreachable from GitHub runners (DNS/TLS/timeout on robots.txt, so nothing fetched): "
          + ", ".join(sorted(k for k, v in rob.items() if str(v).startswith("error"))) + ".",
          "- Hosts whose pages answered HTTP 403 (bot protection; no content): "
          + (", ".join(sorted({m["url"].split("/")[2] for m in json.load(open(os.path.join(S, "fetch_manifest.json")))
                                if m.get("status") == 403 and m.get("kind") == "page"})) or "none") + ".",
          "- Soueast (robots disallow) and changanegypt.com (not official) are never fetched.",
          "- PROBE hosts that failed DNS/TLS were guessed domains, not confirmed official sites."]
    open(os.path.join(S, "SUMMARY.md"), "w").write("\n".join(o) + "\n")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[2] if len(a) > 2 and a[1] == "--note" else "")
