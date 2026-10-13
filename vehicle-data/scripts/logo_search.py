#!/usr/bin/env python3
"""Brand-logo candidates from Wikimedia Commons file search for brands without an accepted logo.

  logo_search.py --out snapshots/ML_<date>_<run> [--per-brand 4]

Commons search (namespace File) for '<brand> logo' and '<brand> car logo'; keeps svg/png files whose title contains the
brand name; records licence metadata; renders a labelled contact sheet (PNG thumbnails from Commons, so SVGs render).
Nothing is accepted here: acceptance = visual review recorded in registry/media_accepted.csv.
"""
import argparse, csv, hashlib, io, json, os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "CarIndexP2/1.0 (vehicle data verification; github.com/KingMega1/scratch)"}
CM = "https://commons.wikimedia.org/w/api.php"


def get(params):
    import requests
    for i in range(3):
        try:
            r = requests.get(CM, params=params, headers=UA, timeout=60)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        time.sleep(3 * (i + 1))
    return {}


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("ë", "e").replace("š", "s"))


def main():
    import requests
    from PIL import Image, ImageDraw
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-brand", type=int, default=4)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "sheets"), exist_ok=True)
    acc = {r["owner"] for r in csv.DictReader(open(os.path.join(ROOT, "registry", "media_accepted.csv")))
           if r["kind"] == "logo" and r["status"] == "ACCEPT"}
    brands = sorted({r["brand"] for r in csv.DictReader(open(os.path.join(ROOT, "registry", "u11_models.csv")))
                     if r["on_sale_u11"] == "true"} - acc)
    rows, groups = [], {}
    for b in brands:
        titles = []
        for q in (f"{b} logo", f"{b} car logo"):
            j = get(dict(action="query", list="search", srnamespace=6, srsearch=q, srlimit=12, format="json"))
            for h in j.get("query", {}).get("search", []):
                t = h["title"]
                if t not in titles and re.search(r"\.(svg|png)$", t, re.I) and fold(b)[:5] in fold(t):
                    titles.append(t)
            time.sleep(0.5)
        titles = titles[:a.per_brand]
        if not titles:
            continue
        j = get(dict(action="query", titles="|".join(titles), prop="imageinfo", iiprop="url|size|sha1|extmetadata",
                     iiurlwidth=1200, format="json"))
        for p in (j.get("query", {}).get("pages", {}) or {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            md = {k: v.get("value") for k, v in (ii.get("extmetadata") or {}).items()}
            u = ii.get("thumburl")
            if not u:
                continue
            try:
                r = requests.get(u, headers=UA, timeout=60)
                im = Image.open(io.BytesIO(r.content))
                im.load()
            except Exception:
                continue
            h = hashlib.sha256(r.content).hexdigest()
            rows.append(dict(asset_id=h[:12], owner=b, kind="logo", source="commons_search", title=p["title"], url=u,
                             page=ii.get("descriptionurl"), width=im.width, height=im.height, sha256=h,
                             license=md.get("LicenseShortName"), artist=re.sub(r"<[^>]+>", "", md.get("Artist") or "")[:120],
                             restrictions=md.get("Restrictions") or ""))
            groups.setdefault(b, []).append((h[:12], im, p["title"][5:60]))
            time.sleep(0.4)
    for site in csv.DictReader(open(os.path.join(ROOT, "registry", "logo_sites.csv"))):  # official Egypt-site header logos
        b = site["brand"]
        try:
            html = requests.get(site["homepage"], headers=dict(UA, **{"User-Agent": "Mozilla/5.0"}), timeout=60).text
        except Exception:
            continue
        srcs = []
        for m in re.finditer(r'<img[^>]+>', html, re.I):
            tag = m.group(0)
            src = re.search(r'(?:src|data-src)="([^"]+)"', tag)
            if src and re.search(r"logo", tag, re.I):
                srcs.append(requests.compat.urljoin(site["homepage"], src.group(1)))
        srcs += [requests.compat.urljoin(site["homepage"], u) for u in re.findall(r'href="([^"]*logo[^"]*\.(?:svg|png))"', html, re.I)]
        for u in list(dict.fromkeys(srcs))[:4]:
            try:
                r = requests.get(u, headers=UA, timeout=60)
                body = r.content
                if u.lower().split("?")[0].endswith(".svg") or body[:200].lstrip().startswith((b"<svg", b"<?xml")):
                    import cairosvg
                    body = cairosvg.svg2png(bytestring=body, output_width=1200)
                im = Image.open(io.BytesIO(body))
                im.load()
            except Exception:
                continue
            h = hashlib.sha256(r.content).hexdigest()
            rows.append(dict(asset_id=h[:12], owner=b, kind="logo", source="official_egypt_site", title=u.rsplit("/", 1)[-1], url=u,
                             page=site["homepage"], width=im.width, height=im.height, sha256=h, license="official site (CEO-MEDIA-2026-10-13)",
                             artist="", restrictions=""))
            groups.setdefault(b, []).append((h[:12], im, "SITE " + u.rsplit("/", 1)[-1][:40]))
            time.sleep(0.4)
    with open(os.path.join(a.out, "logo_candidates.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    W, H, cols = 320, 200, 4
    items = sorted(groups.items())
    for i in range(0, len(items), 5):  # 5 brands per sheet, one row each
        chunk = items[i:i + 5]
        S = Image.new("RGB", (W * cols, H * len(chunk)), (205, 205, 205))
        d = ImageDraw.Draw(S)
        for rI, (b, v) in enumerate(chunk):
            for k, (aid, im, t) in enumerate(v[:cols]):
                th = im.convert("RGBA")
                th.thumbnail((W - 10, H - 40))
                x, y = k * W, rI * H
                S.paste(th, (x + 5, y + 5), th)
                d.text((x + 5, y + H - 32), f"{b} | {aid}", fill="black")
                d.text((x + 5, y + H - 18), t[:48], fill=(60, 60, 60))
        S.save(os.path.join(a.out, "sheets", f"logos_{i // 5:02d}.jpg"), "JPEG", quality=75)
    print(json.dumps(dict(brands_searched=len(brands), brands_with_candidates=len(groups), candidates=len(rows))))


if __name__ == "__main__":
    main()
