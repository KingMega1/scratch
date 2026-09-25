#!/usr/bin/env python3
"""Manual price snapshot for the slice (Living Data Architecture §9 step 7: manual, not scheduled).

1. fetch:  download each URL once, store the raw page (gzip, named by SHA-256) + fetch_manifest.json
2. parse:  deterministic parsers per site -> observations_parsed.csv + contactcars_pricetable_cells.csv

  python3 fetch_snapshot.py fetch --urls urls.txt --out <snapshot_dir>
  python3 fetch_snapshot.py parse --out <snapshot_dir>

S1_2026-09-25 was produced with exactly this code (run from a sandbox with egress to the three sites).
Parsers read visible page text; ContactCars 'price table' pages are read from their table cells so an
empty Official/Market column is never mis-assigned. Nothing is normalised here beyond what is stated.
Requires: requests, beautifulsoup4.
"""
import argparse, csv, gzip, hashlib, io, json, os, re, sys

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en"}
AR_MONTHS = {"يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7,
             "أغسطس": 8, "اغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12}
NUM = re.compile(r"^\d{1,3}(,\d{3})+$")


def fetch(urls, out):
    import requests
    from concurrent.futures import ThreadPoolExecutor
    raw = os.path.join(out, "raw")
    os.makedirs(raw, exist_ok=True)

    def get(u):
        try:
            r = requests.get(u, headers=UA, timeout=60, allow_redirects=True)
            b = r.content
            h = hashlib.sha256(b).hexdigest()
            fn = h[:16] + ".html.gz"
            with open(os.path.join(raw, fn), "wb") as f:
                f.write(gzip.compress(b))
            return dict(url=u, final_url=r.url, status=r.status_code, http_date=r.headers.get("date"), bytes=len(b), sha256=h, file=fn)
        except Exception as e:  # recorded, never silently dropped
            return dict(url=u, error=str(e))

    with ThreadPoolExecutor(6) as ex:
        man = list(ex.map(get, urls))
    with open(os.path.join(out, "fetch_manifest.json"), "w") as f:
        json.dump(man, f, indent=1)
    return man


def vis(html):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(html, "html.parser")
    for x in s(["script", "style", "noscript", "svg"]):
        x.decompose()
    return [l.strip() for l in s.get_text("\n").split("\n") if l.strip()]


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


def p_hatla2ee(L):
    out, i = [], 0
    while i < len(L):
        m = re.match(r"^(.*?) (\d{4}) (.+)$", L[i])
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
                # columns: official, [market], min deposit, min installment
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
            # column position is NOT known from visible text; build_p1.py takes it from contactcars_pricetable_cells.csv
            out.append(dict(model_year=m.group(2), trim_raw=m.group(3), official_price=op, market_price=mp,
                            effective_date=None, title_prefix=m.group(1), row_type="pricetable"))
            i = j
        else:
            i += 1
    return out


def table_cells(html):
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S)
    rsc = "".join(json.loads('"' + c + '"') for c in chunks)
    rows = []
    for tb in re.findall(r"<table>.*?</table>", rsc, flags=re.S):
        if "Avg Market Price" not in tb:
            continue
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, flags=re.S):
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]
            if len(cells) == 3:
                rows.append(cells)
    return rows


def parse(out):
    man = json.load(open(os.path.join(out, "fetch_manifest.json")))
    load = lambda x: gzip.decompress(open(os.path.join(out, "raw", x["file"]), "rb").read()).decode("utf-8", "replace")
    rows, cells = [], []
    for x in man:
        if x.get("error") or x.get("status") != 200:
            print("SKIP (fetch failed):", x["url"], x.get("error") or x.get("status"), file=sys.stderr)
            continue
        L = vis(load(x))
        src = "ContactCars" if "contactcars" in x["url"] else "Hatla2ee" if "hatla2ee" in x["url"] else "EgyCar"
        r = {"ContactCars": p_contactcars, "Hatla2ee": p_hatla2ee, "EgyCar": p_egycar}[src](L)
        for o in r:
            o.update(source=src, source_url=x["url"], fetched_at=x["http_date"], page_sha256=x["sha256"])
        rows += r
    for x in man:  # second pass kept separate so row order matches S1_2026-09-25
        if "contactcars" not in x["url"] or x.get("error") or x.get("status") != 200:
            continue
        html = load(x)
        L = vis(html)
        upd = next((L[i + 1] for i, l in enumerate(L) if l.endswith("Prices Updated on") and i + 1 < len(L)), None)
        for o in p_contactcars_table(L):
            o.update(source="ContactCars(pricetable)", source_url=x["url"], fetched_at=x["http_date"],
                     page_sha256=x["sha256"], page_updated_label=upd)
            rows.append(o)
        cells += [[x["url"]] + c for c in table_cells(html)]
    cols = ["source", "source_url", "fetched_at", "page_sha256", "model_year", "title_prefix", "trim_raw", "engine_cc",
            "official_price", "market_price", "effective_date", "page_updated_label", "row_type"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    with open(os.path.join(out, "observations_parsed.csv"), "w", newline="") as f:
        f.write(buf.getvalue())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["source_url", "row_label", "official_cell", "market_cell"])
    w.writerows(cells)
    with open(os.path.join(out, "contactcars_pricetable_cells.csv"), "w", newline="") as f:
        f.write(buf.getvalue())
    print(f"rows={len(rows)} table_cells={len(cells)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "parse"])
    ap.add_argument("--urls")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "fetch":
        fetch([u.strip() for u in open(a.urls) if u.strip()], a.out)
    else:
        parse(a.out)
