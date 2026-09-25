#!/usr/bin/env python3
"""New-model / launch detection from the sources' own sitemaps (3-6 small requests per run).

  discover.py sitemaps --out <snap>                 # -> model_urls.csv (site, url, lastmod)
  discover.py diff --out <snap> [--prev <snap>]     # -> discovery_events.csv
  discover.py triage --out <snap> [--max 40]        # fetch only NEW candidates once, parse price/body

Event types (Living Data Architecture §4 vocabulary):
  NEW_MODEL_URL       model page present now, absent in the previous discovery run
  MODEL_URL_REMOVED   model page absent now, present before (candidate MISSING, never DISCONTINUED)
  UNKNOWN_TO_CATALOG  model page not in the S0 catalogue (baseline run: pre-existing gaps, not launches)
  LASTMOD_CHANGED     a tracked slice page's sitemap lastmod moved (Hatla2ee/EgyCar only; ContactCars
                      stamps every page with the same lastmod, so it carries no signal there)
Triage fetches each NEW/UNKNOWN candidate page once and records body type + official price range so a
reviewer only looks at candidates that could matter (e.g. SUV in the slice band). Nothing is added to
the registry automatically: NEW_MODEL needs a reviewer (architecture §4.2).
"""
import argparse, csv, gzip, os, re, sys, time

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en"}
SITEMAPS = [
    ("ContactCars", "https://www.contactcars.com/en/new-cars/sitemap.xml", re.compile(r"^https://www\.contactcars\.com/en/new-cars/[a-z0-9_]+-[a-z0-9_]+$")),
    ("Hatla2ee", "https://eg.hatla2ee.com/Sitemap/new-car-makes-models.xml.gz", re.compile(r"^https://eg\.hatla2ee\.com/en/new-car/[^/]+/[^/]+$")),
    ("EgyCar", "https://www.egy-car.com/aps-products-sitemap.xml", re.compile(r"^https://www\.egy-car\.com/[a-z0-9-]+$")),
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _get(url):
    import requests
    r = requests.get(url, headers=UA, timeout=60)
    b = r.content
    if b[:2] == b"\x1f\x8b":
        b = gzip.decompress(b)
    return r.status_code, b.decode("utf-8", "replace")


def sitemaps(out):
    os.makedirs(out, exist_ok=True)
    rows = []
    for site, sm, pat in SITEMAPS:
        st, x = _get(sm)
        if st != 200:
            print(f"SOURCE_HEALTH {site} sitemap HTTP {st}", file=sys.stderr)
            continue
        for block in re.findall(r"<url>(.*?)</url>", x, flags=re.S):
            loc = re.search(r"<loc>\s*(.*?)\s*</loc>", block)
            lm = re.search(r"<lastmod>\s*(.*?)\s*</lastmod>", block)
            if loc and pat.match(loc.group(1)) and not loc.group(1).endswith("/aps-products"):
                rows.append(dict(site=site, url=loc.group(1), lastmod=lm.group(1) if lm else ""))
        time.sleep(1)
    rows.sort(key=lambda r: (r["site"], r["url"]))
    _write(os.path.join(out, "model_urls.csv"), ["site", "url", "lastmod"], rows)
    print("model urls:", {s: sum(1 for r in rows if r["site"] == s) for s, _, _ in SITEMAPS})


def _base(url):  # model-level page for a tracked price URL (strip /year-XXXX)
    return re.sub(r"/year-\d{4}$", "", url)


def diff(out, prev):
    cur = {r["url"]: r for r in _read(os.path.join(out, "model_urls.csv"))}
    old = {r["url"]: r for r in _read(os.path.join(prev, "model_urls.csv"))} if prev else {}
    known = {_base(u.strip()).lower() for u in open(os.path.join(ROOT, "inputs", "s0_known_urls.txt")) if u.strip()}
    tracked = {_base(u.strip()).lower() for u in open(os.path.join(ROOT, "snapshots", "urls_suv_2m.txt")) if u.strip()}
    ev = []
    for u, r in cur.items():
        if old and u not in old:
            ev.append(dict(event="NEW_MODEL_URL", site=r["site"], url=u, lastmod=r["lastmod"], prev_lastmod=""))
        elif not old and u.lower() not in known:
            ev.append(dict(event="UNKNOWN_TO_CATALOG", site=r["site"], url=u, lastmod=r["lastmod"], prev_lastmod=""))
        if old and u in old and u.lower() in tracked and r["lastmod"] != old[u]["lastmod"] and r["site"] != "ContactCars":
            ev.append(dict(event="LASTMOD_CHANGED", site=r["site"], url=u, lastmod=r["lastmod"], prev_lastmod=old[u]["lastmod"]))
    for u, r in old.items():
        if u not in cur:
            ev.append(dict(event="MODEL_URL_REMOVED", site=r["site"], url=u, lastmod="", prev_lastmod=r["lastmod"]))
    _write(os.path.join(out, "discovery_events.csv"), ["event", "site", "url", "lastmod", "prev_lastmod"], ev)
    from collections import Counter
    print("discovery events:", dict(Counter(e["event"] for e in ev)), "baseline" if not old else f"vs {prev}")


def _cc_available(L):
    """ContactCars model page 'Available Models' block: (year, official min, official max)."""
    out = []
    for k, l in enumerate(L):
        if re.fullmatch(r"\d+ Trims? Available", l):
            blk = L[k:k + 14]
            yr = next((x for x in blk if re.fullmatch(r"20\d\d", x)), None)
            nums = [int(x.replace(",", "")) for x in blk if re.fullmatch(r"\d{1,3}(,\d{3}){2,}", x)]
            if yr and nums:
                out.append((yr, min(nums), max(nums)))
    return out


def triage(out, max_n, band=(1600000, 2400000)):
    """One fetch per NEW/UNKNOWN candidate (+1 for body type only when the price is in the slice band)."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import fetch_snapshot as fs
    ev = [e for e in _read(os.path.join(out, "discovery_events.csv"))
          if e["event"] in ("NEW_MODEL_URL", "UNKNOWN_TO_CATALOG") and e["site"] in ("ContactCars", "Hatla2ee")]
    ev.sort(key=lambda e: (e["event"] != "NEW_MODEL_URL", e["site"] != "ContactCars", e["lastmod"]), reverse=False)
    rows = []
    for e in ev[:max_n]:
        try:
            st, html = _get(e["url"])
        except Exception as x:
            rows.append(dict(e, status="ERROR", note=str(x)))
            continue
        L = fs.vis(html) if st == 200 else []
        if e["site"] == "ContactCars":
            av = _cc_available(L)
            years = sorted({a[0] for a in av})
            lo, hi = (min(a[1] for a in av), max(a[2] for a in av)) if av else (None, None)
            trims = sum(int(re.match(r"\d+", l).group()) for l in L if re.fullmatch(r"\d+ Trims? Available", l))
        else:
            parsed = fs.p_hatla2ee(L)
            pr = sorted(int(p["official_price"].replace(",", "")) for p in parsed if re.fullmatch(r"[\d,]{7,}", p["official_price"] or ""))
            years = sorted({p["model_year"] for p in parsed if p.get("model_year")})
            lo, hi, trims = (pr[0] if pr else None), (pr[-1] if pr else None), len(parsed)
        body, in_band = "", bool(lo and lo <= band[1] and hi >= band[0])
        if in_band and e["site"] == "ContactCars" and years:
            time.sleep(1)
            st2, h2 = _get(f'{e["url"]}/year-{years[-1]}')
            L2 = fs.vis(h2) if st2 == 200 else []
            body = next((L2[i + 1] for i, l in enumerate(L2) if l in ("Body Shape", "Body Style") and i + 1 < len(L2)), "")
        rows.append(dict(e, status=st, body=body, trims=trims, official_min=lo or "", official_max=hi or "",
                         model_years=" ".join(years), in_slice_band=in_band))
        time.sleep(1)
    _write(os.path.join(out, "discovery_triage.csv"),
           ["event", "site", "url", "lastmod", "status", "body", "trims", "official_min", "official_max", "model_years",
            "in_slice_band", "note"], rows)
    print(f"triaged {len(rows)} of {len(ev)} candidates; in slice band: {sum(1 for r in rows if r.get('in_slice_band'))}")


def _read(p):
    with open(p, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _write(p, cols, rows):
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["sitemaps", "diff", "triage"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--prev")
    ap.add_argument("--max", type=int, default=40)
    a = ap.parse_args()
    {"sitemaps": lambda: sitemaps(a.out), "diff": lambda: diff(a.out, a.prev), "triage": lambda: triage(a.out, a.max)}[a.cmd]()
