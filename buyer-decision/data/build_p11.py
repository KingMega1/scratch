#!/usr/bin/env python3
"""P1.1 buyer universe: a read-only VIEW over existing CarIndex sources (no new dataset).

Sources (provenance kept per value):
  S0 price/spec file   carindex_master.csv (Drive 1ki9OgVsRiA2gqymKpw0htE9-7ysahQc5, collected 2026-09-10)
  Identity             vehicle_identity/mappings/master_row_map.csv + identity/*.json (branch claude/carindex-vehicle-data)
  P2 refresh           vehicle-data/views/p1_suv_2m.json (buyer_view/v2) + snapshots/S5/specs_parsed.csv
                       (branch claude/carindex-buyer-vehicle-data-97yinp)
  Registration         Vehicle_Registration_Explorer.html payload (Drive 1jJsabEDwGbrBy2eAjDnnNU2ULeaQ1Ala), 2021-02..2026-08
  Official             curation/official_prices.csv, official_facts.csv (transcribed from Drive price lists, file ids kept)
  Curation             curation/families.csv, reg_aliases.csv, brands.csv, models_ar.csv, body_fixes.csv

Grain: MODEL (brand -> model). Trims are evidence under a model. Nothing is imputed.
Usage: python3 build_p11.py <workdir-with-inputs>
"""
import collections, csv, io, json, os, re, sys, unicodedata, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
CUR = os.path.join(HERE, "curation")
VERSION = "U11-2026-09-26"

BODY_MAP = {"SUV": "suv", "Crossover": "suv", "Sedan": "sedan", "Sedan/Fastback": "sedan", "Hatchback": "hatch",
            "Hatchback/Wagon": "hatch", "Station": "hatch", "MPV": "mpv", "MiniVans": "mpv", "Hatchback/MPV": "mpv"}
EXCLUDED_BODIES = {"Pickup", "Van", "Coupe", "Cabriolet", "Gran Coupe", "Convertible", "Other"}
REG_ENGINE = {"ICE": "petrol", "Hybrid": "hybrid", "BEV": "ev", "REEV": "hybrid"}
HYBRID_RE = re.compile(r"hybrid|\bhev\b|e-?power|e-pwr|dm-?i|i-dm|\bdm\b|phev|reev|erev|plug-in", re.I)
PLUGIN_RE = re.compile(r"dm-?i|i-dm|\bdm\b|phev|plug-in|reev|erev", re.I)
EV_RE = re.compile(r"\b(ev|bev|electric)\b", re.I)
SENT = {"", "NOT_AVAILABLE", "Data Not Available", "Unavailable", "N/A", "Price Coming Soon"}


def fold(s):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower())


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"\d{5,9}", s) else None


def load_text(path):
    t = open(path, encoding="utf-8").read()
    if t.startswith("{"):
        t = json.loads(t)["fileContent"]
    t = t.replace("  \n", "\n")
    return re.sub(r"\\([!-/:-@\[-`{-~])", r"\1", t)


def csv_rows(path):
    return list(csv.DictReader(open(path, encoding="utf-8")))


def label_pt(label):
    if HYBRID_RE.search(label):
        return "hybrid", bool(PLUGIN_RE.search(label))
    if EV_RE.search(label):
        return "ev", False
    return None, False


def clean_label(s):
    s = re.sub(r"^A/T\s*/\s*", "", (s or "").strip())
    return s.rstrip(":;, ") or "Standard"


def main(W):
    master = list(csv.DictReader(io.StringIO(load_text(os.path.join(W, "carindex_master.csv")))))
    rowmap = csv_rows(os.path.join(W, "master_row_map.csv"))
    assert len(master) == len(rowmap) == 1444
    idreg = json.load(open(os.path.join(W, "model_registry.json")))["models"]
    brands = {r["brand_id"]: r for r in csv_rows(os.path.join(CUR, "brands.csv"))}
    ar_models = {r["model_id"]: [x for x in r["ar_names"].split("|") if x] for r in csv_rows(os.path.join(CUR, "models_ar.csv"))}

    # ---- families (model-first grouping for engine-variant ids) ----
    fam_of, fam_display = {}, {}
    for r in csv_rows(os.path.join(CUR, "families.csv")):
        for m in r["member_model_ids"].split("|"):
            fam_of[m] = r["family_id"]
        fam_display[r["family_id"]] = r["display"]
    canon = lambda mid: fam_of.get(mid, mid)

    def display_of(cid):
        if cid in fam_display:
            return fam_display[cid]
        return idreg[cid]["display"] if cid in idreg else cid.split("/")[1]

    # ---- S0 rows grouped by canonical model ----
    rows = collections.defaultdict(list)
    for m, r in zip(master, rowmap):
        rows[canon(r["model_id"])].append((m, r))

    # ---- P2 refreshed view (21 SUVs) ----
    p2 = json.load(open(os.path.join(W, "p2_view.json")))
    idx = {}
    for mid, m in idreg.items():
        for k in m["match_keys"] + [m["display"]]:
            idx[(m["brand_id"], fold(k))] = canon(mid)
    brand_key = {fold(b["display"]): bid for bid, b in brands.items()}
    brand_key.update({fold(bid): bid for bid in brands})
    brand_key["citroen"] = "citroen"

    def resolve(brand, model):
        bid = brand_key.get(fold(brand))
        return idx.get((bid, fold(model))) if bid else None

    p2_by = {}
    for m in p2["models"]:
        if not m["in_slice"]:
            continue
        cid = resolve(m["brand"], m["model"])
        if cid:
            p2_by[cid] = m
    print("P2 slice models resolved:", len(p2_by), "/ 21")

    # ---- P2 trim-page specs (S5) -> canonical model via URL slug ----
    specs_s5 = collections.defaultdict(lambda: collections.defaultdict(set))
    for x in csv_rows(os.path.join(W, "specs_S5.csv")):
        u = x["trim_url"]
        m1 = re.search(r"contactcars\.com/en/new-cars/([a-z0-9]+)-([a-z0-9_]+)/", u)
        m2 = re.search(r"hatla2ee\.com/en/new-car/([^/]+)/([^/]+)/", u)
        cid = None
        if m1:
            cid = resolve(m1.group(1), m1.group(2).replace("_", " "))
        elif m2:
            cid = resolve(m2.group(1), m2.group(2))
        if not cid:
            continue
        lab = x["spec_label"]
        key = {"Seats": "seats", "Number of Seats": "seats", "Horse power": "hp", "Vehicle Warranty (Years)": "warranty_years",
               "Length (mm)": "length_mm", "Trunk Size": "trunk", "Fuel Type": "fuel", "fuelType": "fuel",
               "Vehicle Size Class": "size_class_src", "Assembled In": "assembled_in", "Assembly Country": "assembled_in"}.get(lab)
        if key and x["value"].strip():
            specs_s5[cid][key].add((x["value"].strip(), x["source"]))

    # ---- official prices ----
    official = collections.defaultdict(list)
    for r in csv_rows(os.path.join(CUR, "official_prices.csv")):
        official[r["model_id"]].append(r)
    facts = collections.defaultdict(dict)
    for r in csv_rows(os.path.join(CUR, "official_facts.csv")):
        facts[r["brand_id"]][r["fact"]] = r

    # ---- registration, model level ----
    pay = json.load(open(os.path.join(W, "reg_payload.json")))
    months = pay["meta"]["months"]
    last12 = [m for m in months if "2025-09" <= m <= "2026-08"]
    prior12 = [m for m in months if "2024-09" <= m <= "2025-08" and m != "2025-06"]  # mirror the missing Jun 2026
    reg_alias = {(r["reg_brand"], r["reg_model"]): r["model_id"] for r in csv_rows(os.path.join(CUR, "reg_aliases.csv"))}
    reg = collections.defaultdict(lambda: {"monthly": collections.Counter(), "engines": collections.Counter(), "segments": collections.Counter(), "names": set()})
    unmapped = collections.Counter()
    for mo, ctype, seg, eng, b, m, n in pay["core"]:
        if ctype != "Passenger":
            continue
        cid = reg_alias.get((b, m)) or resolve(b, m) or resolve(b, re.sub("^" + re.escape(b), "", m, flags=re.I))
        if not cid:
            unmapped[(b, m)] += n
            continue
        g = reg[cid]
        g["monthly"][mo] += n
        g["segments"][seg] += n
        g["names"].add(f"{b}|{m}")
        if mo >= "2024-09":
            g["engines"][eng] += n

    body_fixes = {r["model_id"]: r for r in csv_rows(os.path.join(CUR, "body_fixes.csv"))}
    # ---- build models ----
    models, reference = [], []
    for cid, rr in rows.items():
        bid = cid.split("/")[0]
        b = brands.get(bid, {"display": bid.title(), "origin": "", "chinese": "0", "ar_names": ""})
        bodies = collections.Counter(m["body_type_normalized"] for m, _ in rr if m["body_type_normalized"] not in SENT)
        body_raw = bodies.most_common(1)[0][0] if bodies else ""
        g = reg.get(cid)
        seg = g["segments"].most_common(1)[0][0] if g and g["segments"] else ""
        body = BODY_MAP.get(body_raw)
        if cid in body_fixes:  # sources disagree with the car itself (curation/body_fixes.csv)
            body, seg = body_fixes[cid]["body"], body_fixes[cid]["segment"]
        if not body and not body_raw and seg:
            body = "suv" if "SUV" in seg else "mpv" if "MPV" in seg else "hatch" if "HB" in seg else "sedan" if "Car" in seg else None

        # trims: official > P2 refresh > S0
        trims, price_source = [], "S0"
        if cid in official:
            price_source = "official"
            for o in official[cid]:
                trims.append({"label": o["trim"], "min": int(o["price_egp"]), "max": int(o["price_egp"]), "year": int(o["model_year"]),
                              "sources": [o["source"]], "official": True, "date": o["source_date"],
                              "pt": label_pt(o["trim"])[0], "plugin": label_pt(o["trim"])[1]})
        elif cid in p2_by:
            price_source = "p2"
            pm = p2_by[cid]
            coh = next(c for c in pm["price"]["cohorts"] if c["model_year"] == pm["price"]["latest_priced_cohort"])
            for t in coh["trims"]:
                o = t["official"]
                vals = sorted({x["value"] for x in o.get("observations", []) if x.get("value_status") == "OK" and isinstance(x.get("value"), (int, float))})
                if o.get("value") is None and not vals:
                    continue
                lab = clean_label(min(t["labels"], key=len) if len(t["labels"]) > 1 else t["labels"][0])
                pt, pl = label_pt(" ".join(t["labels"]))
                dates = [x.get("observed_at", "")[:10] for x in o.get("observations", []) if x.get("observed_at")]
                trims.append({"label": lab, "min": int(vals[0] if vals else o["value"]), "max": int(vals[-1] if vals else o["value"]),
                              "year": coh["model_year"], "sources": sorted(set(o.get("sources", []))), "official": False,
                              "date": max(dates) if dates else "2026-09-10", "pt": pt, "plugin": pl})
        else:
            priced = [(num(m["official_price"]), m, r) for m, r in rr if num(m["official_price"])]
            if priced:
                ys = [int(m["model_year"][:4]) for _, m, _ in priced if m["model_year"][:4].isdigit()]
                ly = str(max(ys)) if ys else None
                priced = [p for p in priced if not ly or p[1]["model_year"][:4] == ly]
                by_trim = collections.defaultdict(list)
                for p, m, r in priced:
                    by_trim[r["trim_key"] or fold(m["variant_raw"])].append((p, m))
                for k, obs in by_trim.items():
                    ps = sorted({p for p, _ in obs})
                    lab = clean_label(max((m["variant_raw"] for _, m in obs), key=len))
                    pt, pl = label_pt(" ".join(m["variant_raw"] + " " + m["fuel_type_raw"] + " " + m["powertrain_raw"] for _, m in obs))
                    trims.append({"label": lab, "min": ps[0], "max": ps[-1], "year": int(ly) if ly else None,
                                  "sources": sorted({m["source"].split("(")[0] for _, m in obs}), "official": any(m["source"].startswith("Official") for _, m in obs),
                                  "date": "2026-09-10", "pt": pt, "plugin": pl})
        trims.sort(key=lambda t: t["max"])
        # collapse duplicate price points of the same trim wording
        seen, dedup = set(), []
        for t in trims:
            k = (fold(t["label"]), t["max"])
            if k not in seen:
                seen.add(k); dedup.append(t)
        trims = dedup

        # powertrains
        pts = set()
        for m, _ in rr:
            ft = (m["fuel_type_raw"] + " " + m["powertrain_raw"]).lower()
            if "electric" in ft and "hybrid" not in ft: pts.add("ev")
            elif "hybrid" in ft or "phev" in ft or "reev" in ft or "e-power" in ft: pts.add("hybrid")
            elif "gas" in ft or "petrol" in ft or "diesel" in ft: pts.add("petrol")
        if g:
            for e, n in g["engines"].items():
                if REG_ENGINE.get(e) and n >= 5: pts.add(REG_ENGINE[e])
        for t in trims:
            if t["pt"]: pts.add(t["pt"])
        if len(pts) == 1:
            for t in trims:
                t["pt"] = t["pt"] or next(iter(pts))
        elif "petrol" in pts:
            for t in trims:
                if not t["pt"]:
                    t["pt_basis"] = "unstated"

        # specs with provenance
        def vals(col):
            out = collections.defaultdict(set)
            for m, _ in rr:
                v = m[col].strip()
                if v not in SENT: out[v].add(m["source"].split("(")[0])
            return out
        seats = {v: sorted(s) for v, s in vals("seats").items()}
        for v, src in specs_s5[cid].get("seats", set()):
            seats.setdefault(v, [])
            if src not in seats[v]: seats[v].append(src)
        seat_nums = sorted({int(x) for v in seats for x in re.findall(r"\d+", v) if 2 <= int(x) <= 9})
        warranty = {v: sorted(s) for v, s in vals("warranty").items()}
        if "warranty" in facts.get(bid, {}):
            f = facts[bid]["warranty"]; warranty = {f["value"]: [f["source"]]}
        wy = [int(x) for v in warranty for x in re.findall(r"(\d+)\s*(?:yr|year|years|Years)", v)]
        for v, _ in specs_s5[cid].get("warranty_years", set()):
            if v.isdigit(): wy.append(int(v))
        hp = sorted({int(x) for v in list(vals("horsepower")) + [v for v, _ in specs_s5[cid].get("hp", set())] for x in re.findall(r"\d{2,4}", v) if 60 <= int(x) <= 900})
        fc = sorted(vals("fuel_consumption"))

        # registration evidence (model level, 2021+)
        regd = None
        if g:
            mon = g["monthly"]
            l12, p12 = sum(mon[m] for m in last12), sum(mon[m] for m in prior12)
            first = min(mon) if mon else None
            years = sorted({m[:4] for m in mon if mon[m] > 0})
            trend = None
            if first and first >= "2025-03":
                trend = "new"
            elif p12 >= 100:
                r_ = l12 / p12 if p12 else 0
                trend = "gaining" if r_ >= 1.25 else "declining" if r_ <= 0.8 else "steady"
            yearly = collections.Counter()
            for m, n in mon.items():
                yearly[m[:4]] += n
            regd = {"since_2021": int(sum(mon.values())), "last12": int(l12), "prior12": int(p12), "first_month": first,
                    "years": years, "trend": trend, "yearly": {k: int(v) for k, v in sorted(yearly.items())},
                    "segment": seg, "reg_names": sorted(g["names"])}

        pmin = min((t["min"] for t in trims), default=None)
        pmax = max((t["max"] for t in trims), default=None)
        latest_year = max((t["year"] or 0 for t in trims), default=0)
        fams = {s for t in trims for s in t["sources"]}
        on_sale = bool((regd and regd["last12"] > 0) or price_source in ("official", "p2") or len(fams) >= 2)
        reasons = []
        if not trims: reasons.append("no_price")
        if body_raw in EXCLUDED_BODIES or not body: reasons.append("body_not_passenger:" + (body_raw or "?"))
        if latest_year and latest_year < 2025: reasons.append("stale_model_year")
        if not on_sale: reasons.append("no_sale_evidence")
        rec = {
            "id": cid, "slug": cid.replace("/", "-"), "brand_id": bid, "brand": b["display"], "model": display_of(cid),
            "origin": b["origin"], "chinese": b["chinese"] == "1",
            "ar": {"brand": [x for x in b["ar_names"].split("|") if x], "model": ar_models.get(cid, [])},
            "body": body, "body_raw": body_raw, "segment": seg,
            "powertrains": sorted(pts), "seats": seat_nums, "seats_evidence": seats,
            "warranty": sorted(warranty)[:1], "warranty_years": max(wy) if wy else None, "hp": hp, "fuel_consumption": fc,
            "trims": trims, "price_min": pmin, "price_max": pmax, "price_source": price_source,
            "distributor": facts.get(bid, {}).get("distributor", {}).get("value"),
            "registration": regd, "model_year": latest_year or None,
            "in_universe": not reasons, "excluded": reasons,
        }
        reference.append(rec)

    # model-level photos: Wikimedia Commons, freely licensed, manually screened (curation/images.csv)
    import hashlib as _h, urllib.parse as _u
    imgs = {r["query"]: r for r in csv_rows(os.path.join(CUR, "images.csv"))}
    for m in reference:
        r = imgs.get(f"{m['brand']} {m['model']}".strip())
        if r:
            f = r["file"]; h = _h.md5(f.encode()).hexdigest(); q = _u.quote(f)
            m["image"] = {"src": f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/960px-{q}",
                          "credit": f"{r['author']} · {r['license']} · Wikimedia Commons",
                          "page": "https://commons.wikimedia.org/wiki/File:" + q}
    uni = [m for m in reference if m["in_universe"]]
    # relative market evidence inside the universe (by body): rank of last-12-month first licences
    for body in {m["body"] for m in uni}:
        grp = sorted([m for m in uni if m["body"] == body and m["registration"]], key=lambda m: -m["registration"]["last12"])
        for i, m in enumerate(grp):
            m["registration"]["rank_in_body_last12"] = i + 1
            m["registration"]["of_body"] = len(grp)

    gaps = {
        "unmapped_registration_names_top": [f"{b}|{m}:{int(n)}" for (b, m), n in unmapped.most_common(40)],
        "universe_models_without_registration": sorted(m["id"] for m in uni if not m["registration"]),
        "universe_models_seats_unknown": len([m for m in uni if not m["seats"]]),
        "excluded_counts": collections.Counter(r.split(":")[0] for m in reference for r in m["excluded"]),
    }
    raw = json.dumps(reference, sort_keys=True).encode()
    out = {"meta": {"version": VERSION, "grain": "model", "built": "2026-09-26",
                    "registration_months": [months[0], months[-1]], "registration_missing": ["2021-01", "2021-05", "2026-06"],
                    "last12_window": ["2025-09", "2026-08"], "models_in_universe": len(uni), "models_reference": len(reference),
                    "not_in_data": ["reliability", "resale value", "running cost", "safety rating", "aftersales quality"],
                    "sha256": hashlib.sha256(raw).hexdigest()},
           "models": sorted(reference, key=lambda m: (not m["in_universe"], m["id"]))}
    json.dump(out, open(os.path.join(HERE, "p11_universe.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({k: (dict(v) if isinstance(v, collections.Counter) else v) for k, v in gaps.items()},
              open(os.path.join(HERE, "p11_gaps.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # slim client view: only fields the buyer app reads
    def slim(m):
        r = m["registration"] or {}
        return {k: v for k, v in {
            "id": m["id"], "brand_id": m["brand_id"], "brand": m["brand"], "model": m["model"], "ar": m["ar"],
            "origin": m["origin"], "chinese": m["chinese"], "body": m["body"], "segment": m["segment"],
            "powertrains": m["powertrains"], "seats": m["seats"], "warranty": m["warranty"], "warranty_years": m["warranty_years"],
            "hp": m["hp"], "trims": [{k2: t.get(k2) for k2 in ("label", "min", "max", "year", "sources", "official", "date", "pt", "plugin", "pt_basis")} for t in m["trims"]],
            "price_min": m["price_min"], "price_max": m["price_max"], "price_source": m["price_source"],
            "distributor": m["distributor"], "model_year": m["model_year"], "image": m.get("image"),
            "reg": {k2: r.get(k2) for k2 in ("since_2021", "last12", "prior12", "trend", "first_month", "yearly", "rank_in_body_last12", "of_body")} if r else None,
            "u": m["in_universe"],
        }.items() if v not in (None, [], {})}
    client = {"meta": {k: out["meta"][k] for k in ("version", "built", "registration_months", "last12_window", "models_in_universe", "not_in_data")},
              "models": [slim(m) for m in out["models"] if m["in_universe"] or (m["price_min"] and m["body"])]}
    js = json.dumps(client, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(HERE, "p11_client.js"), "w", encoding="utf-8").write("window.CI_UNIVERSE=" + js + ";\n")
    print("client models", len(client["models"]), "bytes", len(js))
    print(json.dumps(out["meta"], indent=1))
    print("excluded:", dict(gaps["excluded_counts"]))
    print("universe by body:", collections.Counter(m["body"] for m in uni))
    print("universe price sources:", collections.Counter(m["price_source"] for m in uni))
    print("7+ seat models in universe:", sorted(f"{m['brand']} {m['model']} {m['price_min']:,}" for m in uni if any(s >= 7 for s in m["seats"])))


if __name__ == "__main__":
    main(sys.argv[1])
