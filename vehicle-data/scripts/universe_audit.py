#!/usr/bin/env python3
"""Egyptian market-universe audit (deterministic; no fetching): what is sold or registered that the 283 do not cover.

  universe_audit.py [--out review/market_universe_audit.csv]

Joins, per (brand, model) identity:
  - P1 U11 reference (inputs/u11/p11_universe.json, 490 models; 283 in universe) incl. P1 exclusion reasons
  - Passenger registrations (inputs/registration_models.csv, CEO Vehicle_Registration_Explorer payload)
  - market-site new-car catalogues (latest snapshots/S*/model_urls.csv: ContactCars, Hatla2ee, EgyCar)
  - priced model-year evidence on those pages (latest snapshots/U_* for the 283, snapshots/UA_* for all other pages)
  - identity decisions already taken (config/market_universe.json)
and classifies each identity with a fixed rule (evidence, not judgement):
  IN_283                 in the P1/U11 on-sale universe
  DECIDED_<kind>         recorded in config/market_universe.json (ADDITION / SPLIT / ALIAS / NOT_ON_SALE / OUT_OF_SCOPE)
  ON_SALE_NOT_IN_283     an official Egypt model page lists it, or a market new-car page carries a priced model year >= 2025
  REGISTERED_NO_PAGE     registrations in the last 6 months but no market new-car page (grey import / not catalogued)
  REGISTERED_LISTED_NO_PRICE  market page exists, registrations in last 12 months, no priced current model year
  INACTIVE               none of the above (no current price, no registrations in the last 6 months)
"""
import argparse, collections, csv, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(ROOT, "inputs", "u11")
BRAND = {"mercedes": "mercedesbenz", "porche": "porsche", "cubra": "cupra", "minicoper": "mini", "mini": "mini", "baic": "baic",
         "seat": "seat", "imm": "im", "immotors": "im", "landrover": "landrover", "rangerover": "landrover", "rollsroyce": "rollsroyce",
         "mazarati": "maserati", "alfaromeo": "alfaromeo", "lynkco": "lynkco", "lynkandco": "lynkco", "ssangyong": "kgm", "kgm": "kgm",
         "citroen": "citroen", "dsautomobiles": "ds", "gac": "gac", "aion": "gac", "xiaomi": "xiaomi", "xpeng": "xpeng",
         "morisgarage": "mg", "morrisgarages": "mg", "dongfengaeolus": "dongfeng", "dfm": "dongfeng", "lynkco": "lynkco", "rangerover": "landrover"}
SUFFIX = re.compile(r"(shape)?(new)?(generation|facelift)$")


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("ë", "e").replace("&", "").replace("+", "plus"))


def fb(b):
    f = fold(b)
    return BRAND.get(f, f)


def read(p):
    return list(csv.DictReader(open(p, newline="", encoding="utf-8"))) if os.path.exists(p) else []


def slug_bm(site, url):
    p = url.rstrip("/").split("/")
    if site == "ContactCars":
        s = p[-1] if not p[-1].startswith("year-") else p[-2]
        b, _, m = s.partition("-")
        return b.replace("_", ""), m.replace("_", " ")
    if site == "Hatla2ee":
        return p[-2], p[-1].replace("-", " ")
    return p[-1], ""  # EgyCar: brand-model in one slug, resolved by prefix below


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "review", "market_universe_audit.csv"))
    a = ap.parse_args()
    U = json.load(open(os.path.join(IN, "p11_universe.json")))["models"]
    reg_keys = json.load(open(os.path.join(IN, "model_registry.json")))["models"]
    dec = json.load(open(os.path.join(ROOT, "config", "market_universe.json")))
    key_of = {}  # (brand fold, model fold) -> identity key (U11 id where one exists)
    ident = {}
    for m in U:
        ident[m["id"]] = dict(brand=m["brand"], model=m["model"], u11_id=m["id"],
                              u11_status="IN_283" if m["in_universe"] else "U11_EXCLUDED:" + "+".join(m["excluded"]))
        key_of[(fb(m["brand"]), fold(m["model"]))] = m["id"]
        for n in ((m.get("registration") or {}).get("reg_names") or []):
            b, _, mo = n.partition("|")
            key_of[(fb(b), fold(mo))] = m["id"]
    fam = {mm: r["family_id"] for r in read(os.path.join(IN, "families.csv")) for mm in r["member_model_ids"].split("|")}
    for rid, r in reg_keys.items():  # identity-registry spellings; engine variants resolve to their P1 family
        tgt = next((x for x in (rid, fam.get(rid), r.get("merged_into")) if x and x in ident), None)
        if tgt:
            for k in r["match_keys"] + [r["display"]]:
                key_of.setdefault((fb(r["brand_id"]), fold(k)), tgt)
    for d in dec["identities"]:  # decided identities (additions/splits) and their aliases
        ident.setdefault(d["id"], dict(brand=d["brand"], model=d["model"], u11_id=d.get("u11_id", ""), u11_status="NOT_IN_U11"))
        for al in d.get("match", []):
            b, _, mo = al.partition("|")
            key_of[(fb(b), fold(mo))] = d["id"]
    for al in dec.get("aliases", []):
        b, _, mo = al["reg"].partition("|")
        key_of[(fb(b), fold(mo))] = al["id"]

    remap = {k: d["id"] for d in dec["identities"] for k in d.get("audit_keys", []) if k != d["id"]}
    remap.update({d["alias_of_audit_key"]: d["id"] for d in dec["identities"] if d.get("alias_of_audit_key")})

    def resolve(b, mo):
        r = resolve_raw(b, mo)
        return remap.get(r, r)

    def resolve_raw(b, mo):
        k = (fb(b), fold(mo))
        if k in key_of:
            return key_of[k]
        bm = fold(mo)  # EgyCar/aggregator spellings: brand repeated in the model slug, "shape facelift" suffixes
        for pre in {fb(b), fold(b)}:
            if pre and bm.startswith(pre) and len(bm) > len(pre):
                bm = bm[len(pre):]
        bm = SUFFIX.sub("", bm)
        for cand in (bm, "mg" + bm if fb(b) == "mg" else None, bm.replace("plus", "") if bm.endswith("plusplus") else None):
            if cand and (fb(b), cand) in key_of:
                key_of[k] = key_of[(fb(b), cand)]
                return key_of[k]
        nid = f"{fb(b)}/{fold(mo)}"
        ident.setdefault(nid, dict(brand=b.strip(), model=mo.strip(), u11_id="", u11_status="NOT_IN_U11"))
        key_of[k] = nid
        return nid

    acc = collections.defaultdict(lambda: dict(reg_names=[], l12=0, l6=0, eng=collections.Counter(), pages=set(), years=set(), priced=0, official=set()))
    for r in read(os.path.join(ROOT, "inputs", "registration_models.csv")):
        if int(r["last12"]) <= 0 and int(r["last6"]) <= 0:
            continue
        i = resolve(r["reg_brand"], r["reg_model"])
        x = acc[i]
        x["reg_names"].append(f'{r["reg_brand"]}|{r["reg_model"]}')
        x["l12"] += int(r["last12"])
        x["l6"] += int(r["last6"])
        for e in filter(None, r["engines_last12"].split("|")):
            k, _, v = e.partition(":")
            x["eng"][k] += int(v)
    smap = sorted(glob.glob(os.path.join(ROOT, "snapshots", "S*_*", "model_urls.csv")))[-1]
    mapped = {r["url"]: r["p1_id"] for r in read(os.path.join(IN, "u11_source_urls.csv"))}
    split_url = {u: d["id"] for d in dec["identities"] for u in d.get("urls", [])}
    brands = sorted({fb(m["brand"]) for m in U} | {fb(d["brand"]) for d in dec["identities"]}, key=len, reverse=True)
    url_id = {}
    for r in read(smap):
        u = r["url"]
        if u in split_url:
            i = split_url[u]
        elif u in mapped:
            i = remap.get(mapped[u], mapped[u])
        else:
            b, mo = slug_bm(r["site"], u)
            if r["site"] == "EgyCar":
                s = fold(b)
                bb = next((x for x in brands if s.startswith(x)), None)
                b, mo = (bb, s[len(bb):]) if bb else (b, "")
            i = resolve(b, mo)
        url_id[u] = i
        acc[i]["pages"].add(u)
    for r in read(os.path.join(ROOT, "inputs", "official_lineup_pages.csv")):  # official Egypt OEM/importer model pages
        key = re.sub(r"^(toyota|the|all|new)-?", "", r["source_key"].lower().replace("-ph1", "").replace("-en", ""))
        i = resolve(r["brand"], key)
        acc[i]["official"].add(r["url"])
    for snap in [sorted(glob.glob(os.path.join(ROOT, "snapshots", p)))[-1:] for p in ("U_*", "UA_*")]:
        for s in snap:
            for o in read(os.path.join(s, "observations_parsed.csv")):
                u = o["source_url"]
                base = u.split("/year-")[0]
                i = url_id.get(u) or url_id.get(base)
                if not i or not re.sub(r"\D", "", o["official_price"] or ""):
                    continue
                acc[i]["priced"] += 1
                if (o["model_year"] or "").isdigit():
                    acc[i]["years"].add(int(o["model_year"]))
    decided = {}
    for d in dec["identities"]:  # SPLIT/ADDITION/OUT_OF_SCOPE take precedence over a SOURCE_ALIAS on the same id
        if d["id"] not in decided or decided[d["id"]]["decision"] == "SOURCE_ALIAS":
            decided[d["id"]] = d
    rows = []
    for i, x in acc.items():
        m = ident[i]
        cur = sorted(y for y in x["years"] if y >= 2025)
        if m["u11_status"] == "IN_283" and decided.get(i, {}).get("decision") in (None, "SOURCE_ALIAS"):
            cls = "IN_283"
        elif i in decided:
            cls = "DECIDED_" + decided[i]["decision"]
        elif cur or x["official"]:
            cls = "ON_SALE_NOT_IN_283"
        elif x["pages"] and x["priced"]:
            cls = "LISTED_PRICED_NO_CURRENT_YEAR"
        elif x["l6"] > 0 and not x["pages"]:
            cls = "REGISTERED_NO_PAGE"
        elif x["l12"] > 0 and x["pages"]:
            cls = "REGISTERED_LISTED_NO_PRICE"
        else:
            cls = "INACTIVE"
        rows.append(dict(identity=i, brand=m["brand"], model=m["model"], u11_id=m["u11_id"], u11_status=m["u11_status"], audit_class=cls,
                         decision_note=decided.get(i, {}).get("note", ""), reg_last12=x["l12"], reg_last6=x["l6"],
                         reg_engines="|".join(f"{k}:{v}" for k, v in x["eng"].most_common()), reg_names=" ; ".join(sorted(set(x["reg_names"]))),
                         official_pages=" | ".join(sorted(x["official"])[:2]), market_pages=len(x["pages"]), priced_rows=x["priced"], current_model_years=" ".join(map(str, cur)),
                         page_urls=" | ".join(sorted(x["pages"]))))
    order = {"ON_SALE_NOT_IN_283": 0, "DECIDED_ADDITION": 1, "DECIDED_SPLIT": 2, "REGISTERED_NO_PAGE": 3,
             "REGISTERED_LISTED_NO_PRICE": 4, "LISTED_PRICED_NO_CURRENT_YEAR": 5}
    rows.sort(key=lambda r: (order.get(r["audit_class"], 9), -r["reg_last12"], r["identity"]))
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    c = collections.Counter(r["audit_class"] for r in rows)
    print(json.dumps(dict(identities=len(rows), by_class=dict(c), sitemap=os.path.relpath(smap, ROOT)), indent=1))


if __name__ == "__main__":
    main()
