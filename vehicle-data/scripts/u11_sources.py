#!/usr/bin/env python3
"""Map every U11 on-sale model to its market-source pages (deterministic; no fetching).

  u11_sources.py [--sitemaps snapshots/S6_2026-09-30/model_urls.csv] [--out inputs/u11/u11_source_urls.csv]

Identity keys come from the U11 universe (inputs/u11/p11_universe.json), the vehicle-identity registry match keys
(inputs/u11/model_registry.json) and P1 family merges (inputs/u11/families.csv). A page is mapped only when its
URL slug resolves to exactly one U11 model; S0 rows are mapped through master_row_map.csv. URLs that S0 attached
to more than one model (brand-level lineup pages) are dropped. Output rows: p1_id, site, url, basis.
"""
import argparse, collections, csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(ROOT, "inputs", "u11")
SITES = ("ContactCars", "Hatla2ee", "EgyCar")


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def keys():
    U = [m for m in json.load(open(os.path.join(IN, "p11_universe.json")))["models"] if m.get("in_universe")]
    uid = {m["id"] for m in U}
    fam = {}
    for r in csv.DictReader(open(os.path.join(IN, "families.csv"))):
        for m in r["member_model_ids"].split("|"):
            fam[m] = r["family_id"]
    k = collections.defaultdict(set)
    for mid, m in json.load(open(os.path.join(IN, "model_registry.json")))["models"].items():
        c = fam.get(mid, mid)
        if c in uid:
            for x in m["match_keys"] + [m["display"]]:
                k[(fold(m["brand_id"]), fold(x))].add(c)
    for m in U:
        k[(fold(m["brand_id"]), fold(m["model"]))].add(m["id"])
    return U, fam, k


def slug_candidates(site, url):
    p = url.rstrip("/").split("/")
    if site == "ContactCars":
        b, _, mo = p[-1].partition("-")
        return [(b, mo)]
    if site == "Hatla2ee":
        return [(p[-2], p[-1])]
    parts = p[-1].split("-")
    return [("-".join(parts[:i]), "-".join(parts[i:])) for i in range(1, len(parts))]


def build(sitemaps):
    U, fam, k = keys()
    uid = {m["id"] for m in U}
    rows = set()
    for path in sitemaps:
        for r in csv.DictReader(open(path)):
            if r["site"] not in SITES:
                continue
            for b, mo in slug_candidates(r["site"], r["url"]):
                v = k.get((fold(b), fold(mo)))
                if v and len(v) == 1:
                    rows.add((next(iter(v)), r["site"], r["url"], "sitemap_slug"))
                    break
    master = os.path.join(ROOT, "..", "raw", "carindex_master.csv")
    s0 = os.path.join(IN, "s0_urls.csv")
    if os.path.exists(master):  # S0 URLs via the reviewed row map (only where the S0 master is available locally)
        by_url = collections.defaultdict(set)
        for m, r in zip(csv.DictReader(open(master)), csv.DictReader(open(os.path.join(IN, "master_row_map.csv")))):
            c = fam.get(r["model_id"], r["model_id"])
            if c in uid and m["source"] in SITES and m["source_url"].startswith("http"):
                by_url[(m["source"], m["source_url"].strip())].add(c)
        with open(s0, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["p1_id", "site", "url"])
            w.writerows(sorted((next(iter(v)), s, u) for (s, u), v in by_url.items() if len(v) == 1))
    for r in csv.DictReader(open(s0)):
        rows.add((r["p1_id"], r["site"], r["url"], "s0_row_map"))
    best = {}
    for p, s, u, b in sorted(rows):  # one row per (model, url); sitemap basis kept when both agree
        best.setdefault((p, u), (p, s, u, b))
    owners = collections.defaultdict(set)
    for p, s, u, b in best.values():
        owners[u].add(p)
    return sorted(r for r in best.values() if len(owners[r[2]]) == 1), uid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sitemaps", default=os.path.join(ROOT, "snapshots", "S6_2026-09-30", "model_urls.csv"))
    ap.add_argument("--out", default=os.path.join(IN, "u11_source_urls.csv"))
    a = ap.parse_args()
    rows, uid = build(a.sitemaps.split(","))
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["p1_id", "site", "url", "basis"])
        w.writerows(rows)
    cov = collections.defaultdict(set)
    for p, s, _, _ in rows:
        cov[p].add(s)
    print(f"urls={len(rows)} models={len(cov)}/{len(uid)} >=2 sites={sum(len(v) >= 2 for v in cov.values())} "
          f"by site={dict(collections.Counter(s for _, s, _, _ in rows))} unmapped={sorted(uid - set(cov))}")


if __name__ == "__main__":
    main()
