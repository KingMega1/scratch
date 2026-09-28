#!/usr/bin/env python3
"""Reality audit of the model universe P1 consumes (deterministic; re-runnable; seed of the daily DQ snapshot).

  audit_universe.py --universe p11_universe.json --reg reg_payload.json --sitemaps snapshots/S*/model_urls.csv
                    [--out audit/]

Outputs:
  audit/model_audit.csv       one row per universe model: evidence present/missing per field, tier of each signal
  audit/missing_candidates.csv  models seen in registrations or source sitemaps but absent from the universe
  audit/summary.json          coverage / gap counts (the numbers quoted in the checkpoint)
No market status is assigned here: this measures evidence, it does not decide.
"""
import argparse, collections, csv, json, os, re

CRIT = ["official_price", "second_price_source", "seats", "hp", "warranty", "distributor", "powertrain_resolved",
        "registrations_last12", "current_model_year"]


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("ë", "e"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe", required=True)
    ap.add_argument("--reg", required=True)
    ap.add_argument("--sitemaps", required=True)
    ap.add_argument("--out", default="audit")
    ap.add_argument("--as-of", default="2026-09-28")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    U = json.load(open(a.universe))["models"]
    reg = json.load(open(a.reg))
    months = sorted(reg["meta"]["months"])
    last12 = [m for m in months if m >= "2025-09"]
    prev12 = [m for m in months if "2024-09" <= m < "2025-09"]
    regv = collections.defaultdict(lambda: collections.Counter())
    reg_eng = collections.defaultdict(collections.Counter)
    for mo, ct, sg, en, b, mdl, v in reg["core"]:
        if ct == "Passenger":
            regv[f"{b}|{mdl}"][mo] += v
            if mo in last12:
                reg_eng[f"{b}|{mdl}"][en] += v

    rows = []
    for m in U:
        if not m.get("in_universe"):
            continue
        trims = m.get("trims") or []
        srcs = sorted({s.lower() for t in trims for s in t.get("sources", [])})
        official = any(t.get("official") for t in trims)
        years = sorted({t.get("year") for t in trims if t.get("year")})
        pts = m.get("powertrains") or []
        names = (m.get("registration") or {}).get("reg_names") or []
        l12 = sum(regv[n][x] for n in names for x in last12)
        p12 = sum(regv[n][x] for n in names for x in prev12)
        engines = collections.Counter()
        for n in names:
            engines.update(reg_eng[n])
        tri = dict(
            official_price=official,
            second_price_source=len(srcs) >= 2,
            seats=bool(m.get("seats")),
            hp=bool(m.get("hp")),
            warranty=bool(m.get("warranty") or m.get("warranty_years")),
            distributor=bool(m.get("distributor")),
            powertrain_resolved=bool(pts) and "hybrid" not in pts,
            registrations_last12=l12 > 0,
            current_model_year=bool(years) and max(years) >= 2026,
        )
        rows.append(dict(model_id=m["id"], brand=m["brand"], model=m["model"], body=m.get("body"), segment=m.get("segment"),
                         price_min=m.get("price_min"), price_max=m.get("price_max"), price_sources=";".join(srcs),
                         price_observed=m.get("price_source"), latest_model_year=max(years) if years else "",
                         powertrains=";".join(pts), reg_engines_last12=";".join(f"{k}:{int(v)}" for k, v in engines.most_common()),
                         reg_last12=int(l12), reg_prev12=int(p12), reg_names=";".join(names),
                         missing_critical=";".join(k for k in CRIT if not tri[k]), **{f"has_{k}": v for k, v in tri.items()}))
    with open(os.path.join(a.out, "model_audit.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # ---- missing-model discovery: registrations + sitemaps vs universe (in or out)
    known_names = {n for m in U for n in ((m.get("registration") or {}).get("reg_names") or [])}
    known_fold = {fold(m["brand"] + m["model"]) for m in U} | {fold(m["id"]) for m in U}
    cands = []
    for n, s in regv.items():
        l12 = sum(s[x] for x in last12)
        if n not in known_names and l12 >= 50 and not n.endswith("|Other"):
            b, mdl = n.split("|", 1)
            cands.append(dict(signal="registrations", key=n, brand=b, model=mdl, reg_last12=int(l12),
                              reg_first=min(k for k in s if s[k] > 0), engines=";".join(f"{k}:{int(v)}" for k, v in reg_eng[n].most_common()),
                              url=""))
    seen = set()
    for path in a.sitemaps.split(","):
        for r in csv.DictReader(open(path)):
            slug = r["url"].rstrip("/").split("/")
            key = fold("".join(slug[-2:]) if "hatla2ee" in r["url"] else slug[-1])
            if key in known_fold or key in seen:
                continue
            seen.add(key)
            cands.append(dict(signal=f"sitemap:{r['site']}", key=r["url"], brand="", model=slug[-1], reg_last12="",
                              reg_first="", engines="", url=r["url"], lastmod=r.get("lastmod", "")))
    with open(os.path.join(a.out, "missing_candidates.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["signal", "key", "brand", "model", "reg_last12", "reg_first", "engines", "url", "lastmod"],
                           extrasaction="ignore")
        w.writeheader()
        w.writerows(sorted(cands, key=lambda c: (c["signal"], -(c["reg_last12"] or 0))))

    n = len(rows)
    summ = dict(as_of=a.as_of, universe_in=n, universe_reference=len(U),
                coverage={k: sum(1 for r in rows if r[f"has_{k}"]) for k in CRIT},
                single_price_source=sum(1 for r in rows if not r["has_second_price_source"]),
                price_observed_only_s0=sum(1 for r in rows if r["price_observed"] == "S0"),
                powertrain_hybrid_unresolved=sum(1 for r in rows if "hybrid" in r["powertrains"].split(";")),
                powertrain_empty=sum(1 for r in rows if not r["powertrains"]),
                zero_reg_last12=sum(1 for r in rows if r["reg_last12"] == 0),
                reg_declining_over_50pct=sum(1 for r in rows if r["reg_prev12"] >= 20 and r["reg_last12"] < 0.5 * r["reg_prev12"]),
                missing_candidates=dict(collections.Counter(c["signal"] for c in cands)),
                missing_candidates_reg_over_500=sum(1 for c in cands if c["signal"] == "registrations" and c["reg_last12"] >= 500),
                models_missing_3plus_critical=sum(1 for r in rows if len(r["missing_critical"].split(";")) >= 3))
    json.dump(summ, open(os.path.join(a.out, "summary.json"), "w"), indent=1)
    print(json.dumps(summ, indent=1))


if __name__ == "__main__":
    main()
