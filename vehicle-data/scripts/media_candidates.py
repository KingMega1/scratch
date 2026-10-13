#!/usr/bin/env python3
"""Brand-logo and model-image candidates with machine-readable usage rights (Wikidata + Wikimedia Commons).

  media_candidates.py --out snapshots/M_<date>_<run> [--thumb 1600]

For each U11 brand: Wikidata items matching the brand name, their logo (P154) and official website (P856).
For each U11 on-sale model: Wikidata items matching "<brand> <model>", their image (P18).
Every file gets Commons imageinfo: original size, 1600px thumbnail URL, licence, author, credit, description, date.
Thumbnails (800px) are downloaded for visual verification (CI artifact only; never served from here).
Nothing is accepted by this script: candidates -> media_candidates.json; acceptance happens in canonical review.
"""
import argparse, csv, json, os, re, time, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "CarIndexP2/1.0 (vehicle data verification; contact via github.com/KingMega1/scratch)"}
WD = "https://www.wikidata.org/w/api.php"
CM = "https://commons.wikimedia.org/w/api.php"
CAR_WORDS = re.compile(r"car|automobile|suv|crossover|sedan|saloon|hatchback|vehicle|minivan|mpv|pickup|coupe|roadster|estate|wagon", re.I)
BRAND_WORDS = re.compile(r"automobile|car|vehicle|manufacturer|automaker|marque|brand|motor", re.I)


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def get(url, params, tries=3):
    import requests
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=60)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return {}


def search(q, limit=7):
    return [x["id"] for x in get(WD, dict(action="wbsearchentities", search=q, language="en", type="item", limit=limit, format="json")).get("search", [])]


def entities(ids):
    out = {}
    for i in range(0, len(ids), 50):
        out.update(get(WD, dict(action="wbgetentities", ids="|".join(ids[i:i + 50]), props="claims|labels|descriptions",
                                languages="en|ar", format="json")).get("entities", {}))
        time.sleep(0.5)
    return out


def claim_vals(e, p):
    return [c["mainsnak"].get("datavalue", {}).get("value") for c in e.get("claims", {}).get(p, []) if c["mainsnak"].get("datavalue")]


def imageinfo(files, thumb):
    out = {}
    for i in range(0, len(files), 40):
        j = get(CM, dict(action="query", titles="|".join("File:" + f for f in files[i:i + 40]), prop="imageinfo",
                         iiprop="url|size|sha1|extmetadata|mime", iiurlwidth=thumb, format="json"))
        for p in (j.get("query", {}).get("pages", {}) or {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            md = {k: v.get("value") for k, v in (ii.get("extmetadata") or {}).items()}
            out[p["title"][5:]] = dict(url=ii.get("url"), thumb_url=ii.get("thumburl"), width=ii.get("width"), height=ii.get("height"),
                                       sha1=ii.get("sha1"), mime=ii.get("mime"), page=ii.get("descriptionurl"),
                                       license=md.get("LicenseShortName"), license_url=md.get("LicenseUrl"),
                                       usage_terms=md.get("UsageTerms"), artist=re.sub(r"<[^>]+>", "", md.get("Artist") or ""),
                                       credit=re.sub(r"<[^>]+>", "", md.get("Credit") or ""), restrictions=md.get("Restrictions"),
                                       description=re.sub(r"<[^>]+>", "", md.get("ImageDescription") or "")[:400],
                                       date=re.sub(r"<[^>]+>", "", md.get("DateTimeOriginal") or "")[:40])
        time.sleep(0.5)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--thumb", type=int, default=1600)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "raw"), exist_ok=True)
    models = [r for r in csv.DictReader(open(os.path.join(ROOT, "registry", "u11_models.csv"))) if r["on_sale_u11"] == "true"]
    brands = sorted({r["brand"] for r in models})
    res = dict(brands={}, models={})
    for bnd in brands:
        ids = search(bnd, 8)
        ent = entities(ids)
        cands = []
        for q in ids:
            e = ent.get(q, {})
            desc = (e.get("descriptions", {}).get("en") or {}).get("value", "")
            cands.append(dict(qid=q, label=(e.get("labels", {}).get("en") or {}).get("value"), description=desc,
                              logos=claim_vals(e, "P154"), website=claim_vals(e, "P856"), carish=bool(BRAND_WORDS.search(desc))))
        res["brands"][bnd] = cands
        time.sleep(0.5)
    for m in models:
        ids = search(f'{m["brand"]} {m["model"]}', 7)
        ent = entities(ids)
        cands = []
        for q in ids:
            e = ent.get(q, {})
            desc = (e.get("descriptions", {}).get("en") or {}).get("value", "")
            lab = (e.get("labels", {}).get("en") or {}).get("value", "")
            cands.append(dict(qid=q, label=lab, description=desc, images=claim_vals(e, "P18"),
                              label_ar=(e.get("labels", {}).get("ar") or {}).get("value"),
                              carish=bool(CAR_WORDS.search(desc)), model_in_label=fold(m["model"]) in fold(lab)))
        res["models"][m["p1_id"]] = cands
        time.sleep(0.5)
    files = sorted({f for c in res["brands"].values() for x in c for f in x["logos"]} |
                   {f for c in res["models"].values() for x in c if x["carish"] and x["model_in_label"] for f in x["images"]})
    info = imageinfo(files, a.thumb)
    res["files"] = info
    import requests
    for f, i in info.items():  # 800px previews for visual verification
        u = i.get("thumb_url")
        if not u:
            continue
        u8 = re.sub(r"/\d+px-", "/800px-", u) if "/thumb/" in u else u
        try:
            r = requests.get(u8, headers=UA, timeout=60)
            if r.status_code == 200:
                ext = ".png" if f.lower().endswith((".svg", ".png")) else ".jpg"
                fn = re.sub(r"[^A-Za-z0-9._-]", "_", f)[:150] + ext
                open(os.path.join(a.out, "raw", fn), "wb").write(r.content)
                i["preview_file"] = fn
        except Exception as x:
            i["preview_error"] = str(x)
        time.sleep(0.3)
    json.dump(res, open(os.path.join(a.out, "media_candidates.json"), "w"), indent=1, ensure_ascii=False, sort_keys=True)
    print(json.dumps(dict(brands=len(brands), brand_with_logo=sum(any(x["logos"] for x in c) for c in res["brands"].values()),
                          models=len(models), models_with_image=sum(any(x["images"] and x["carish"] and x["model_in_label"] for x in c)
                                                                    for c in res["models"].values()),
                          files=len(info), previews=sum(1 for i in info.values() if i.get("preview_file")))))


if __name__ == "__main__":
    main()
