#!/usr/bin/env python3
"""Build the frozen buyer-decision vehicle universe (a read-only VIEW, not a new dataset).

Inputs (canonical, unmodified; Sep 10 2026 snapshot, per CarIndex_Source_Registry_2026-09-25.md §2):
  carindex_master.csv      Drive id 1ki9OgVsRiA2gqymKpw0htE9-7ysahQc5  (1,444 rows)
  vehicle_candidates.csv   Drive id 1oFUsnAWsXNal1xUO9bjhBSI2lf5zZy_H  (528 rows)

Grain: MODEL (brand_normalized + model_normalized). Trims are attached as supporting evidence only.
Rules: no imputation, sentinels stay unknown, every value keeps its source family list.

Usage: python3 build_universe.py <dir-with-both-csvs>
Writes: universe.v1.json and universe.v1.js (same content, for file:// use) next to this script.
"""
import csv, io, json, re, sys, hashlib, statistics, collections, os

FREEZE = {
    "universe_version": "U1-2026-09-25",
    "snapshot": "S0_2026-09-10",
    "budget_anchor_egp": 2_000_000,
    # a model is in scope if at least one official-priced trim falls in this band (anchor -20% / +20%)
    "band_min_egp": 1_600_000,
    "band_max_egp": 2_400_000,
    "min_source_families_with_official_price": 2,
    "passenger_body_types": ["SUV", "Sedan", "Hatchback", "Hatchback/Wagon", "MPV", "MiniVans", "Crossover"],
    "trim_price_agreement_tolerance": 0.005,
}
T1_FAMILIES = {"Official-ToyotaEgypt"}
SENTINEL = {"", "NOT_AVAILABLE", "Data Not Available", "Unavailable", "N/A", "Price Coming Soon"}


def load_text(path):
    """Accept raw CSV or the Drive connector's markdown-escaped export (backslash-escaped punctuation, '  \\n' line ends)."""
    t = open(path, encoding="utf-8").read()
    if t.startswith("{"):  # saved connector JSON {fileContent: ...}
        t = json.loads(t)["fileContent"]
    t = t.replace("  \n", "\n")
    return re.sub(r"\\([!-/:-@\[-`{-~])", r"\1", t)


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"\d{5,9}", s) else None


def family(src):
    return src.split("(")[0]


def row_powertrain(r):
    t = f"{r['powertrain_raw']} {r['fuel_type_raw']} {r['variant_raw']}".lower()
    if re.search(r"plug-in|phev|reev|erev", t):
        return "PHEV"
    if "hybrid" in t or "e-power" in t:
        return "HEV"
    if "electric" in t or re.search(r"\bev\b", t):
        return "EV"
    if "diesel" in t:
        return "Diesel"
    if re.search(r"\bgas\b|petrol|gasoline", t):
        return "Petrol"
    return None


def slug(*parts):
    s = "-".join(parts).lower()
    s = s.replace("ë", "e")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def fold(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


GENERIC_LABEL = re.compile(r"^\(?(unspecified|\d+ class|automatic|a/t|standard|base|unnamed trim)\)?$", re.I)


def label_quality(label):
    return 0 if GENERIC_LABEL.match(label.strip()) else len(label)


def warranty_years(s):
    m = re.search(r"(\d+)\s*(?:yr|year|years)", s, re.I) or re.search(r"(\d+)\s*Years", s)
    return int(m.group(1)) if m else None


def main(src_dir):
    mpath = os.path.join(src_dir, "carindex_master.csv")
    cpath = os.path.join(src_dir, "vehicle_candidates.csv")
    master = list(csv.DictReader(io.StringIO(load_text(mpath))))
    cands = list(csv.DictReader(io.StringIO(load_text(cpath))))
    assert len(master) == 1444, f"master rows {len(master)} != 1444 (registry)"
    assert len(cands) == 528, f"candidate rows {len(cands)} != 528 (registry)"

    groups = collections.defaultdict(list)
    for r in master:
        groups[(r["brand_normalized"], r["model_normalized"])].append(r)

    models, excluded = [], collections.Counter()
    for (brand, model), rows in sorted(groups.items()):
        priced_all = [(num(r["official_price"]), r) for r in rows if num(r["official_price"])]
        if not priced_all:
            excluded["no_numeric_official_price"] += 1
            continue
        # latest model-year cohort only (Living Data Architecture §6.3); older-year listings are stale evidence
        years = [int(r["model_year"][:4]) for _, r in priced_all if r["model_year"][:4].isdigit()]
        latest = str(max(years)) if years else None
        priced = [(p, r) for p, r in priced_all if r["model_year"][:4] == latest] if latest else priced_all
        older_listings = len(priced_all) - len(priced)
        if not any(FREEZE["band_min_egp"] <= p <= FREEZE["band_max_egp"] for p, _ in priced):
            excluded["no_trim_in_band"] += 1
            continue
        fams = sorted({family(r["source"]) for _, r in priced})
        if len(fams) < FREEZE["min_source_families_with_official_price"]:
            excluded["fewer_than_2_source_families"] += 1
            continue
        bodies = collections.Counter(r["body_type_normalized"] for r in rows if r["body_type_normalized"] not in SENTINEL)
        body = bodies.most_common(1)[0][0] if bodies else None
        if body not in FREEZE["passenger_body_types"]:
            excluded["non_passenger_or_unknown_body"] += 1
            continue

        # trims: group by folded variant label + year; verified if >=2 families agree on price
        tg = collections.defaultdict(list)
        for p, r in priced:
            tg[(fold(r["variant_raw"]), r["model_year"][:4])].append((p, r))
        # price-point agreement across source families, independent of trim label wording
        point_fams = collections.defaultdict(set)
        for p, r in priced:
            point_fams[p].add(family(r["source"]))

        def fams_at(price):
            return sorted({f for p2, fs in point_fams.items() if abs(p2 - price) <= price * FREEZE["trim_price_agreement_tolerance"] for f in fs})

        trims = []
        for (_, yr), obs in tg.items():
            by_fam = collections.defaultdict(set)
            for p, r in obs:
                by_fam[p].add(family(r["source"]))
            # best-supported price for this trim
            price, fset = max(by_fam.items(), key=lambda kv: (len(kv[1]), -kv[0]))
            agree = fams_at(price)
            conflict = len(by_fam) > 1 and any(abs(p2 - price) > price * FREEZE["trim_price_agreement_tolerance"] for p2 in by_fam)
            label = obs[0][1]["variant_raw"].strip() or "(unnamed trim)"
            mkt = [num(r["market_price"]) for _, r in obs if num(r["market_price"])]
            trims.append({
                "label": label,
                "model_year": yr,
                "official_price": price,
                "agreeing_sources": agree,
                "status": "conflict" if conflict else ("verified" if len(agree) >= 2 else "single_source"),
                "other_prices": sorted(p2 for p2 in by_fam if p2 != price),
                "market_price": min(mkt) if mkt else None,
                "powertrain": next((row_powertrain(r) for _, r in obs if row_powertrain(r)), None),
                "source_urls": sorted({r["source_url"] for _, r in obs})[:4],
            })
        # collapse entries that share a price point (same trim under different source wording);
        # keep the most descriptive label, list the others as aliases
        merged = []
        for t in sorted(trims, key=lambda t: t["official_price"]):
            same = next((x for x in merged if x["model_year"] == t["model_year"]
                         and (x["powertrain"] is None or t["powertrain"] is None or x["powertrain"] == t["powertrain"])
                         and abs(x["official_price"] - t["official_price"]) <= t["official_price"] * FREEZE["trim_price_agreement_tolerance"]), None)
            if not same:
                t["label_aliases"] = []
                merged.append(t)
                continue
            if label_quality(t["label"]) > label_quality(same["label"]):
                same["label_aliases"].append(same["label"])
                same["label"] = t["label"]
            else:
                same["label_aliases"].append(t["label"])
            same["powertrain"] = same["powertrain"] or t["powertrain"]
            same["source_urls"] = sorted(set(same["source_urls"]) | set(t["source_urls"]))[:4]
            mk = [v for v in (same["market_price"], t["market_price"]) if v]
            same["market_price"] = min(mk) if mk else None
            if t["status"] == "conflict":
                same["status"] = "conflict"
                same["other_prices"] = sorted(set(same["other_prices"]) | set(t["other_prices"]))
        trims = merged

        def vals(col):
            return sorted({r[col].strip() for r in rows if r[col].strip() not in SENTINEL})

        pts = sorted({row_powertrain(r) for r in rows} - {None})
        seats = vals("seats")
        warr = vals("warranty")
        wy = [y for y in (warranty_years(w) for w in warr) if y]
        prem = [(t["market_price"] - t["official_price"]) / t["official_price"] for t in trims if t["market_price"]]
        cand_rows = [c for c in cands if c["brand"].strip().lower() == brand.lower() and fold(c["model"]).startswith(fold(model))]
        cand_status = collections.Counter(c["status"] for c in cand_rows)
        conflicts = [
            {"variant": c["variant_normalized"], "status": c["status"], "note": c["notes"]}
            for c in cand_rows if "CONFLICT" in c["status"].upper()
        ]
        spec = {
            "horsepower": vals("horsepower"),
            "engine_capacity": vals("engine_capacity"),
            "transmission": vals("transmission"),
            "fuel_consumption": vals("fuel_consumption"),
            "trunk_capacity": vals("trunk_capacity"),
            "length": vals("length"),
            "electric_range": vals("electric_range"),
        }
        gaps = [k for k, v in {"seats": seats, "warranty": warr, **spec}.items() if not v]
        gaps += ["powertrain"] if not pts else []
        prices = [t["official_price"] for t in trims]
        vprices = [t["official_price"] for t in trims if t["status"] == "verified"]
        models.append({
            "id": slug(brand, model),
            "id_status": "PROVISIONAL",
            "brand": brand,
            "model": model,
            "body_type": body,
            "powertrains": pts,
            "model_year_latest": latest,
            "older_year_listings_excluded": older_listings,
            "price": {
                "official_min": min(prices), "official_max": max(prices),
                "verified_min": min(vprices) if vprices else None,
                "verified_max": max(vprices) if vprices else None,
                "basis": "official_price, numeric only, latest model-year cohort, Sep 10 2026 snapshot",
            },
            "market_premium_pct_median": round(statistics.median(prem) * 100, 1) if prem else None,
            "market_premium_n": len(prem),
            "seats": seats,
            "warranty": warr,
            "warranty_years_max": max(wy) if wy else None,
            "spec": spec,
            "source_families": fams,
            "has_official_source": bool(set(fams) & T1_FAMILIES),
            "candidate_status_counts": dict(cand_status),
            "conflicts": conflicts,
            "gaps": gaps,
            "trims": trims,
            "collection_date": sorted({r["collection_date"] for r in rows}),
            "price_dates": vals("price_date"),
            "rows": len(rows),
        })

    h = hashlib.sha256()
    for p in (mpath, cpath):
        h.update(load_text(p).encode("utf-8"))
    out = {
        "meta": {
            **FREEZE,
            "grain": "model",
            "inputs": {
                "carindex_master.csv": "drive:1ki9OgVsRiA2gqymKpw0htE9-7ysahQc5",
                "vehicle_candidates.csv": "drive:1oFUsnAWsXNal1xUO9bjhBSI2lf5zZy_H",
            },
            "inputs_sha256_normalized_text": h.hexdigest(),
            "built_by": "buyer-decision/data/build_universe.py",
            "models_in_scope": len(models),
            "models_excluded": dict(excluded),
            "not_in_data": ["reliability", "running cost", "resale value", "safety rating", "registration volume (crosswalk not built)"],
        },
        "models": models,
    }
    here = os.path.dirname(os.path.abspath(__file__))
    js = json.dumps(out, ensure_ascii=False, indent=1)
    open(os.path.join(here, "universe.v1.json"), "w", encoding="utf-8").write(js + "\n")
    open(os.path.join(here, "universe.v1.js"), "w", encoding="utf-8").write("window.CI_UNIVERSE = " + js + ";\n")
    print(json.dumps(out["meta"], indent=1, ensure_ascii=False))
    for m in models:
        print(f"{m['id']:28} {m['body_type']:10} {','.join(m['powertrains']) or '?':12} {m['price']['official_min']:>9,}-{m['price']['official_max']:>9,} fam={len(m['source_families'])} seats={m['seats']} conflicts={len(m['conflicts'])}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
