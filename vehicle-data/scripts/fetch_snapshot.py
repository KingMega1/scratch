#!/usr/bin/env python3
"""Dated price/spec snapshot for the slice: fetch -> evidence -> parse. No LLM involved.

  fetch_snapshot.py fetch    --urls urls.txt --out <snap>        # model pages (prices)
  fetch_snapshot.py evidence --out <snap>                        # raw html -> evidence.jsonl.gz (kept in git)
  fetch_snapshot.py parse    --out <snap>                        # prices  -> observations_parsed.csv (+ pricetable cells)
  fetch_snapshot.py links    --out <snap> --registry-urls urls   # trim-detail links found on the model pages
  fetch_snapshot.py fetch    --urls <snap>/trim_urls.txt --out <snap> --kind trim
  fetch_snapshot.py specs    --out <snap>                        # specs   -> specs_parsed.csv

Transport is plain HTTP GET: all three sites render prices/specs server-side and the pages used are
allowed by each site's robots.txt (checked 2026-09-25). Raw HTML is large (~1 MB/page) and is kept
outside git (CI artifact); evidence.jsonl.gz keeps everything the parsers read, so any snapshot can be
re-parsed later. Parsers are deterministic; nothing is normalised beyond what is stated.
Requires: requests, beautifulsoup4.
"""
import argparse, csv, gzip, hashlib, io, json, os, re, sys, time

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en"}
AR_MONTHS = {"يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7,
             "أغسطس": 8, "اغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12}
NUM = re.compile(r"^\d{1,3}(,\d{3})+$")
CC_TRIM = re.compile(r"^/en/new-cars/([a-z0-9_]+-[a-z0-9_]+)/([0-9a-f]{12})$")
H2_TRIM = re.compile(r"^/en/new-car/([^/\"]+)/([^/\"]+)/(\d+)$")
CC_SPEC_ROW = re.compile(r'\["\$","div","([0-9a-f]{12,24})",\{"className":"flex justify-between items-center[^"]*",'
                         r'"children":\[\["\$","span",null,\{"className":"[^"]*","children":("(?:[^"\\]|\\.)*")\}\],'
                         r'\["\$","span",null,\{"className":"[^"]*","children":("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)\}\]\]\}\]')
H2_SPEC_KEYS = ["Transmission", "Body Type", "Fuel Type", "Power", "Turbo", "Speeds", "Horse power", "Fuel", "Max speed",
                "Consumption", "Length", "Width", "Height", "Ground Clearance", "Wheel Base", "Trunk Size", "Seats",
                "Traction Type", "Number Of Cylinder", "Fuel Tank Capacity", "Torque Of Newton", "Acceleration",
                "Battery Capacity", "Range", "Charging Time"]


def site(url):
    return "ContactCars" if "contactcars" in url else "Hatla2ee" if "hatla2ee" in url else "EgyCar"


# ------------------------------------------------------------------ fetch

def fetch(urls, out, kind="model", delay=1.0):
    import requests
    raw = os.path.join(out, "raw")
    os.makedirs(raw, exist_ok=True)
    man_path = os.path.join(out, "fetch_manifest.json")
    man = json.load(open(man_path)) if os.path.exists(man_path) else []
    t0, total = time.time(), 0
    for u in urls:  # sequential + polite delay: ~1 req/s per run, well under any reasonable limit
        try:
            r = requests.get(u, headers=UA, timeout=60, allow_redirects=True)
            b = r.content
            h = hashlib.sha256(b).hexdigest()
            fn = h[:16] + ".html.gz"
            with open(os.path.join(raw, fn), "wb") as f:
                f.write(gzip.compress(b))
            total += len(b)
            man.append(dict(url=u, kind=kind, final_url=r.url, status=r.status_code, http_date=r.headers.get("date"),
                            bytes=len(b), sha256=h, file=fn))
        except Exception as e:  # recorded, never silently dropped
            man.append(dict(url=u, kind=kind, error=str(e)))
        time.sleep(delay)
    with open(man_path, "w") as f:
        json.dump(man, f, indent=1)
    print(f"fetched kind={kind} pages={len(urls)} bytes={total} seconds={time.time() - t0:.0f}")


# ------------------------------------------------------------------ evidence

def vis(html):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(html, "html.parser")
    for x in s(["script", "style", "noscript", "svg"]):
        x.decompose()
    return [l.strip() for l in s.get_text("\n").split("\n") if l.strip()]


def rsc_payload(html):
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S)
    out = []
    for c in chunks:
        try:
            out.append(json.loads('"' + c + '"'))
        except ValueError:
            pass
    return "".join(out)


def table_cells(rsc):
    rows = []
    for tb in re.findall(r"<table>.*?</table>", rsc, flags=re.S):
        if "Avg Market Price" not in tb:
            continue
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, flags=re.S):
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]
            if len(cells) == 3:
                rows.append(cells)
    return rows


def evidence(out):
    man = json.load(open(os.path.join(out, "fetch_manifest.json")))
    ev = []
    for x in man:
        if x.get("error") or x.get("status") != 200:
            ev.append(dict(url=x["url"], kind=x.get("kind"), error=x.get("error") or x.get("status")))
            continue
        html = gzip.decompress(open(os.path.join(out, "raw", x["file"]), "rb").read()).decode("utf-8", "replace")
        rsc = rsc_payload(html) if "contactcars" in x["url"] else ""
        jsonld = []
        for blob in re.findall(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html, flags=re.S):
            try:
                j = json.loads(blob)
            except ValueError:
                continue
            if isinstance(j, dict) and j.get("@type") in ("Vehicle", "Car", "car", "Product"):
                j.pop("image", None)
                j.pop("logo", None)
                jsonld.append(j)
        links = sorted(set(re.findall(r'href="(/en/new-cars?/[^"#?]+)"', html)) | set(re.findall(r'"(/en/new-cars/[a-z0-9_]+-[a-z0-9_]+/[0-9a-f]{12})"', html)))
        ev.append(dict(url=x["url"], kind=x.get("kind", "model"), http_date=x["http_date"], sha256=x["sha256"], bytes=x["bytes"],
                       lines=vis(html), jsonld=jsonld, table_cells=table_cells(rsc) if rsc else [],
                       spec_rows=[[sid, json.loads(lab), json.loads(val) if val.startswith('"') else val]
                                  for sid, lab, val in CC_SPEC_ROW.findall(rsc)] if rsc else [],
                       links=links))
    with gzip.open(os.path.join(out, "evidence.jsonl.gz"), "wt", encoding="utf-8") as f:
        for e in ev:
            f.write(json.dumps(e, ensure_ascii=False, sort_keys=True) + "\n")
    print(f"evidence pages={len(ev)} errors={sum(1 for e in ev if 'error' in e)}")


def load_evidence(out, kind=None):
    with gzip.open(os.path.join(out, "evidence.jsonl.gz"), "rt", encoding="utf-8") as f:
        ev = [json.loads(l) for l in f]
    return [e for e in ev if kind is None or e.get("kind", "model") == kind]


# ------------------------------------------------------------------ price parsers (unchanged logic from S1)

def p_contactcars(L):
    out, yr = [], None
    for i, l in enumerate(L):
        m = re.match(r"^Available (\d{4}) .* Trims$", l)
        if m:
            yr = m.group(1)
        if l == "Class" and i + 4 < len(L) and L[i + 1] == "#" and L[i + 4] == "Official Price":
            trim, op, mp, k = L[i + 3], L[i + 5], None, i + 6
            if L[k] == "EGP":
                k += 1
            if L[k] == "Market Average":
                mp = L[k + 1]
            out.append(dict(model_year=yr, trim_raw=trim, official_price=op, market_price=mp, effective_date=None))
    return out


class _Swap:
    """Match-like view of '(prefix) (trim) (year)' exposing group(1)=prefix, group(2)=year, group(3)=trim."""
    def __init__(self, m):
        self.g = (m.group(0), m.group(1), m.group(3), m.group(2))

    def group(self, i):
        return self.g[i]


def p_hatla2ee(L):
    out, i = [], 0
    while i < len(L):
        m = (re.match(r"^(.*?) (20\d\d) (.+)$", L[i]) or re.match(r"^(.*?) ((?:[AM]/T|CVT|DCT) */.*) (20\d\d)$", L[i])
             or re.match(r"^(.*) (.+?) (20\d\d)$", L[i]))
        if m and not m.group(2).startswith("20"):  # title with the year at the end: 'Peugeot 3008 A/T / Allure 2027'
            m = _Swap(m)
        if m and i + 1 < len(L) and re.match(r"^\d+ CC$", L[i + 1]) or (m and i + 1 < len(L) and NUM.match(L[i + 1] or "")):
            j, cc = i + 1, None
            if re.match(r"^\d+ CC$", L[j]):
                cc, j = L[j], j + 1
            nums = []
            while j < len(L) and L[j] != "Compare" and j - i < 14:
                if NUM.match(L[j]) or L[j] in ("Data Not Available", "Price Coming Soon"):
                    nums.append(L[j])
                j += 1
            if j < len(L) and L[j] == "Compare" and nums:
                out.append(dict(model_year=m.group(2), trim_raw=m.group(3), official_price=nums[0],
                                market_price=nums[1] if len(nums) == 4 else None, effective_date=None,
                                engine_cc=cc, title_prefix=m.group(1)))
                i = j
        i += 1
    return out


def p_egycar(L):
    out, eff = [], None
    for l in L:
        m = re.search(r"تم تحديثها يوم (\d{1,2}) (\S+) (\d{4})", l)
        if m and m.group(2) in AR_MONTHS:
            eff = f"{m.group(3)}-{AR_MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}"
    for i, l in enumerate(L):
        m = re.match(r"^.*\(\s*(.+?)\s*\)$", l)
        if m and i + 1 < len(L) and re.match(r"^[\d.]+ جنيه$", L[i + 1]):
            out.append(dict(model_year=None, trim_raw=m.group(1),
                            official_price=L[i + 1].replace(" جنيه", "").replace(".", ","), market_price=None, effective_date=eff))
    return out


def p_contactcars_table(L):
    out = []
    try:
        s = next(i for i, l in enumerate(L) if l == "Avg Market Price" and L[i - 1] == "Official Price")
    except StopIteration:
        return out
    i = s + 1
    while i < len(L) and L[i] not in ("Show More", "Advanced Search"):
        m = re.match(r"^(.*?) (\d{4}) (.+)$", L[i])
        if m and i + 1 < len(L) and re.match(r"^[\d,]+ EGP$", L[i + 1]):
            op, mp, j = L[i + 1][:-4], None, i + 2
            if j < len(L) and re.match(r"^[\d,]+ EGP$", L[j]):
                mp, j = L[j][:-4], j + 1
            out.append(dict(model_year=m.group(2), trim_raw=m.group(3), official_price=op, market_price=mp,
                            effective_date=None, title_prefix=m.group(1), row_type="pricetable"))
            i = j
        else:
            i += 1
    return out


def parse(out):
    ev = [e for e in load_evidence(out, "model") if "error" not in e]
    rows, cells = [], []
    for e in ev:
        src = site(e["url"])
        r = {"ContactCars": p_contactcars, "Hatla2ee": p_hatla2ee, "EgyCar": p_egycar}[src](e["lines"])
        for o in r:
            o.update(source=src, source_url=e["url"], fetched_at=e["http_date"], page_sha256=e["sha256"])
        rows += r
    for e in ev:
        if site(e["url"]) != "ContactCars":
            continue
        L = e["lines"]
        upd = next((L[i + 1] for i, l in enumerate(L) if l.endswith("Prices Updated on") and i + 1 < len(L)), None)
        for o in p_contactcars_table(L):
            o.update(source="ContactCars(pricetable)", source_url=e["url"], fetched_at=e["http_date"],
                     page_sha256=e["sha256"], page_updated_label=upd)
            rows.append(o)
        cells += [[e["url"]] + c for c in e["table_cells"]]
    cols = ["source", "source_url", "fetched_at", "page_sha256", "model_year", "title_prefix", "trim_raw", "engine_cc",
            "official_price", "market_price", "effective_date", "page_updated_label", "row_type"]
    _write_csv(os.path.join(out, "observations_parsed.csv"), cols, rows)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["source_url", "row_label", "official_cell", "market_cell"])
    w.writerows(cells)
    with open(os.path.join(out, "contactcars_pricetable_cells.csv"), "w", newline="") as f:
        f.write(buf.getvalue())
    print(f"price rows={len(rows)} table_cells={len(cells)}")


def _write_csv(path, cols, rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    with open(path, "w", newline="") as f:
        f.write(buf.getvalue())


# ------------------------------------------------------------------ specs

def links(out):
    """Trim-detail links that belong to the model pages we track (no crawling beyond them)."""
    found = set()
    for e in load_evidence(out, "model"):
        if "error" in e:
            continue
        path = re.sub(r"^https?://[^/]+", "", e["url"])
        if site(e["url"]) == "ContactCars":
            slug = path.split("/")[3]
            for l in e["links"]:
                m = CC_TRIM.match(l)
                if m and m.group(1) == slug:
                    found.add("https://www.contactcars.com" + l)
        elif site(e["url"]) == "Hatla2ee":
            base = path.lower().rstrip("/")
            for l in e["links"]:
                m = H2_TRIM.match(l)
                if m and l.lower().startswith(base + "/"):
                    found.add("https://eg.hatla2ee.com" + l)
    with open(os.path.join(out, "trim_urls.txt"), "w") as f:
        f.write("".join(u + "\n" for u in sorted(found)))
    print(f"trim links={len(found)}")


def specs(out):
    rows = []
    for e in load_evidence(out, "trim"):
        if "error" in e:
            continue
        base = dict(source=site(e["url"]), trim_url=e["url"], fetched_at=e["http_date"], page_sha256=e["sha256"])
        if base["source"] == "ContactCars":
            v = next((j for j in e["jsonld"] if j.get("@type") == "Vehicle"), {})
            base.update(brand=(v.get("brand") or {}).get("name"), model=v.get("model"), trim_raw=v.get("vehicleConfiguration"),
                        model_year=v.get("vehicleModelDate"))
            if v:
                eng = v.get("vehicleEngine") or {}
                for k, val in (("offer_price_egp", (v.get("offers") or {}).get("price")), ("fuelType", eng.get("fuelType")),
                               ("engineDisplacement", eng.get("engineDisplacement")), ("vehicleTransmission", v.get("vehicleTransmission")),
                               ("bodyType", v.get("bodyType")), ("assembly_country", v.get("manufacturer"))):
                    if val not in (None, ""):
                        rows.append(dict(base, spec_id="jsonld:" + k, spec_label=k, value=val, via="json-ld"))
            for sid, lab, val in e["spec_rows"]:
                rows.append(dict(base, spec_id=sid, spec_label=lab.strip(), value=val, via="spec-table"))
        else:  # Hatla2ee 'Car Details' block: fixed label/value pairs
            L = e["lines"]
            t = next((l for l in L if l.endswith("Prices & Features")), "")
            m = re.match(r"^(.*?) (.+?) (\d{4}) Prices & Features$", t)
            base.update(title=t, trim_raw=None, model_year=m.group(3) if m else None)
            try:
                i = L.index("Car Details", L.index("Show All 7 Photos") if "Show All 7 Photos" in L else 0)
            except ValueError:
                i = next((k for k, l in enumerate(L) if l == "Car Details" and k + 1 < len(L) and L[k + 1] in H2_SPEC_KEYS), None)
            if i is None:
                continue
            j = i + 1
            while j + 1 < len(L) and L[j] in H2_SPEC_KEYS:
                rows.append(dict(base, spec_id="h2:" + L[j], spec_label=L[j], value=L[j + 1], via="car-details"))
                j += 2
    cols = ["source", "trim_url", "fetched_at", "page_sha256", "brand", "model", "title", "trim_raw", "model_year",
            "spec_id", "spec_label", "value", "via"]
    _write_csv(os.path.join(out, "specs_parsed.csv"), cols, rows)
    print(f"spec rows={len(rows)} trim pages={len({r['trim_url'] for r in rows})}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "evidence", "parse", "links", "specs"])
    ap.add_argument("--urls")
    ap.add_argument("--out", required=True)
    ap.add_argument("--kind", default="model", choices=["model", "trim"])
    ap.add_argument("--delay", type=float, default=1.0)
    a = ap.parse_args()
    if a.cmd == "fetch":
        fetch([u.strip() for u in open(a.urls) if u.strip()], a.out, a.kind, a.delay)
    else:
        {"evidence": evidence, "parse": parse, "links": links, "specs": specs}[a.cmd](a.out)
