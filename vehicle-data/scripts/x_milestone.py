#!/usr/bin/env python3
"""Claude Cloud extraction lane: milestone builder (candidates only, no acceptance).

  x_milestone.py build  --spec snapshots/X_M01_2026-10-14/facts.json
  x_milestone.py verify --spec snapshots/X_M01_2026-10-14/facts.json   # regression check only, writes nothing

facts.json lists every candidate with its source (an evidence snapshot already committed by an x1/x2 run), an exact
locator (PDF page or page line) and a verbatim quote. `verify` fails if any quote is not present in the stored source
text at that locator, so a candidate can never be emitted without the bytes that support it. Output CSVs keep the
batch-1 column order (P2-compatible) and append: source_tier, confidence, locator, sha256, note.
No network, no LLM.
"""
import argparse, csv, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC_COLS = ["p1_id", "model_year", "trim", "field", "value", "unit", "source_url", "issuer", "retrieved_at", "quote"]
WAR_COLS = ["p1_id", "years", "km", "scope", "source_url", "issuer", "retrieved_at", "quote"]
BRO_COLS = ["p1_id", "model_year", "url", "sha256", "bytes", "pages", "issuer", "retrieved_at"]
EXTRA = ["source_tier", "confidence", "locator", "sha256", "note"]


def squash(s):
    return re.sub(r"\s+", " ", s or "").strip()


def load_sources(snap):
    """url -> record (pages: list[str] for PDFs, lines joined for HTML)."""
    out = {}
    d = os.path.join(ROOT, snap)
    for name, kind in (("evidence.jsonl.gz", "page"), ("pdfs.jsonl.gz", "pdf")):
        p = os.path.join(d, name)
        if not os.path.exists(p):
            continue
        for l in gzip.open(p, "rt"):
            r = json.loads(l)
            r["_kind"] = kind
            for u in {r.get("url"), r.get("final_url")} - {None}:
                out[(snap, u)] = r
    return out


def locate(rec, locator):
    """'page N' (PDF, 1-based) or 'html' (whole page text) -> text."""
    if rec["_kind"] == "pdf":
        m = re.fullmatch(r"page (\d+)", locator)
        if not m:
            raise ValueError(f"PDF locator must be 'page N': {locator}")
        return rec["text"][int(m.group(1)) - 1]
    return "\n".join(rec["lines"])


def check(spec):
    cache, errors, n = {}, [], 0
    for kind in ("specs", "warranty", "brochure"):
        for f in spec.get(kind, []):
            snap = f["evidence_snapshot"]
            if snap not in cache:
                cache[snap] = load_sources(snap)
            rec = cache[snap].get((snap, f["source_url"]))
            if not rec:
                errors.append(f"{kind} {f['p1_id']} {f.get('field', '')}: source not in {snap}: {f['source_url']}")
                continue
            if f.get("sha256") and f["sha256"] != rec.get("sha256"):
                errors.append(f"{kind} {f['p1_id']}: sha256 mismatch for {f['source_url']}")
            if kind == "brochure":
                n += 1
                continue
            text = squash(locate(rec, f["locator"]))
            for q in f["quote"].split(" … "):
                if squash(q) not in text:
                    errors.append(f"{kind} {f['p1_id']} {f.get('field', '')}: quote not at {f['locator']}: {q!r}")
            n += 1
    return n, errors, cache


def build(spec_path):
    spec = json.load(open(spec_path))
    n, errors, cache = check(spec)
    if errors:
        print("\n".join(errors))
        sys.exit(f"verify FAILED: {len(errors)} of {n} candidates")
    out = os.path.dirname(spec_path)
    meta = spec["sources"]

    def common(f):
        rec = cache[f["evidence_snapshot"]][(f["evidence_snapshot"], f["source_url"])]
        m = meta[f["source_url"]]
        return rec, dict(issuer=m["issuer"], retrieved_at=rec["retrieved_at"], source_tier=m["tier"],
                         confidence=f["confidence"], locator=f"{f['evidence_snapshot']} :: {f['locator']}" if "locator" in f else f["evidence_snapshot"],
                         sha256=rec["sha256"], note=f.get("note", ""))

    rows = {"specs": [], "warranty": [], "brochure": []}
    for f in spec.get("specs", []):
        rec, c = common(f)
        rows["specs"].append(dict(c, p1_id=f["p1_id"], model_year=f.get("model_year", ""), trim=f["trim"], field=f["field"],
                                  value=f["value"], unit=f.get("unit", ""), source_url=f["source_url"], quote=f["quote"]))
    for f in spec.get("warranty", []):
        rec, c = common(f)
        rows["warranty"].append(dict(c, p1_id=f["p1_id"], years=f["years"], km=f.get("km", ""), scope=f["scope"],
                                     source_url=f["source_url"], quote=f["quote"]))
    for f in spec.get("brochure", []):
        rec, c = common(f)
        rows["brochure"].append(dict(c, p1_id=f["p1_id"], model_year=f.get("model_year", ""), url=f["source_url"],
                                     bytes=rec.get("bytes"), pages=rec.get("pages")))
    for kind, cols, fn in (("specs", SPEC_COLS, "specs_candidates.csv"), ("warranty", WAR_COLS, "warranty_candidates.csv"),
                           ("brochure", BRO_COLS, "brochure_candidates.csv")):
        seen, uniq = set(), []
        for r in rows[kind]:  # dedupe by model, trim, fact, source
            k = (r["p1_id"], r.get("trim"), r.get("field"), r.get("years"), r.get("url") or r.get("source_url"), r.get("value"))
            if k not in seen:
                seen.add(k)
                uniq.append(r)
        with open(os.path.join(out, fn), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols + EXTRA, extrasaction="ignore")
            w.writeheader()
            w.writerows(uniq)
        print(f"{fn}: {len(uniq)} rows")
    print(f"verify OK: {n} candidates, every quote found at its locator")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "verify"])
    ap.add_argument("--spec", required=True)
    a = ap.parse_args()
    if a.cmd == "verify":
        n, errors, _ = check(json.load(open(a.spec)))
        print("\n".join(errors) if errors else f"verify OK: {n} candidates")
        sys.exit(1 if errors else 0)
    build(a.spec)


if __name__ == "__main__":
    main()
