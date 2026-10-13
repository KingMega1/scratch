#!/usr/bin/env python3
"""Download media candidates, measure them, and build labelled contact sheets for visual verification.

  media_sheets.py --out snapshots/MS_<date>_<run> [--media snapshots/M_*/media_candidates.json]

Candidates: brand logos (Wikidata P154) and model images (Wikidata P18) from media_candidates.json, plus official
Egypt OEM page images from inputs/u11/official/*.asset_evidence.json (CEO-MEDIA-2026-10-13 approves OEM imagery).
Writes media_assets.csv (asset_id = sha256[:12], dimensions, source, licence) and sheets/*.jpg (committed, small)
so a reviewer can verify exact model / generation / quality. Nothing is accepted here.
"""
import argparse, csv, glob, hashlib, io, json, os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "CarIndexP2/1.0 (vehicle data verification; github.com/KingMega1/scratch)"}
SKIP = re.compile(r"logo|icon|sprite|favicon|badge|flag|arrow|social|whatsapp|facebook|instagram|youtube|banner-mobile|placeholder", re.I)


def fetch(url):
    import requests
    try:
        r = requests.get(url, headers=UA, timeout=60)
        return r.content if r.status_code == 200 else None
    except Exception:
        return None


def measure(b):
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(b))
        im.load()
        return im
    except Exception:
        return None


def sheet(items, path, title):
    from PIL import Image, ImageDraw
    W, H, cols = 320, 220, 4
    rows = (len(items) + cols - 1) // cols
    S = Image.new("RGB", (W * cols, H * rows + 30), "white")
    d = ImageDraw.Draw(S)
    d.text((6, 8), title[:150], fill="black")
    for k, (aid, im, label) in enumerate(items):
        t = im.convert("RGB")
        t.thumbnail((W - 8, H - 34))
        x, y = (k % cols) * W, 30 + (k // cols) * H
        S.paste(t, (x + 4, y + 2))
        d.text((x + 4, y + H - 30), f"{aid} {im.width}x{im.height}", fill="black")
        d.text((x + 4, y + H - 16), label[:52], fill="gray")
    S.save(path, "JPEG", quality=70)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--media", default=None)
    ap.add_argument("--max-oem", type=int, default=16)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "sheets"), exist_ok=True)
    media = a.media or sorted(glob.glob(os.path.join(ROOT, "snapshots", "M_*", "media_candidates.json")))[-1]
    M = json.load(open(media))
    models = {r["p1_id"]: r for r in csv.DictReader(open(os.path.join(ROOT, "registry", "u11_models.csv"))) if r["on_sale_u11"] == "true"}
    cands = []  # (owner, kind, source, url, page, licence, artist)
    for bnd, cs in M["brands"].items():
        for c in cs:
            if c["carish"]:
                for f in c["logos"][:2]:
                    i = M["files"].get(f, {})
                    if i.get("thumb_url"):
                        cands.append((bnd, "logo", f"commons:{c['qid']}", i["thumb_url"], i.get("page"), i.get("license"), i.get("artist")))
    for p1, cs in M["models"].items():
        for c in cs:
            if c["carish"] and c["model_in_label"]:
                for f in c["images"][:3]:
                    i = M["files"].get(f, {})
                    if i.get("thumb_url"):
                        cands.append((p1, "photo", f"commons:{c['qid']}", i["thumb_url"], i.get("page"), i.get("license"), i.get("artist")))
    for path in glob.glob(os.path.join(ROOT, "inputs", "u11", "official", "*.asset_evidence.json")):
        per = {}
        for x in json.load(open(path))["candidates"]:
            u = x["url"]
            if x.get("universe_id") in models and re.search(r"\.(jpe?g|png|webp)(\b|$)", u, re.I) and not SKIP.search(u):
                per.setdefault(x["universe_id"], []).append((x["universe_id"], "photo", "oem:" + x["source_page"].split("/")[2], u,
                                                             x["source_page"], "CEO_APPROVED_OEM_OFFICIAL", ""))
        for p1, L in per.items():
            seen = set()
            cands += [c for c in L if not (c[3] in seen or seen.add(c[3]))][:60]
    rows, groups, shas = [], {}, set()
    oem_kept = {}
    for owner, kind, src, url, page, lic, artist in cands:
        if src.startswith("oem:") and oem_kept.get(owner, 0) >= a.max_oem:
            continue
        b = fetch(url)
        time.sleep(0.3)
        im = measure(b) if b else None
        if im is None:
            continue
        h = hashlib.sha256(b).hexdigest()
        if h in shas or (kind == "photo" and im.width < 800):
            continue
        shas.add(h)
        if src.startswith("oem:"):
            oem_kept[owner] = oem_kept.get(owner, 0) + 1
        aid = h[:12]
        rows.append(dict(asset_id=aid, owner=owner, kind=kind, source=src, url=url, page=page or "", width=im.width,
                         height=im.height, bytes=len(b), sha256=h, license=lic or "", artist=(artist or "")[:120]))
        groups.setdefault((kind, owner), []).append((aid, im, src))
    with open(os.path.join(a.out, "media_assets.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    logos = [(k[1], v) for k, v in sorted(groups.items()) if k[0] == "logo"]
    for i in range(0, len(logos), 6):  # 6 brands per logo sheet
        items = [(aid, im, f"{bnd} | {src}") for bnd, v in logos[i:i + 6] for aid, im, src in v]
        sheet(items, os.path.join(a.out, "sheets", f"logos_{i // 6:02d}.jpg"), "brand logos")
    for (kind, owner), v in sorted(groups.items()):
        if kind == "photo":
            m = models[owner]
            sheet([(aid, im, src) for aid, im, src in v], os.path.join(a.out, "sheets", owner.replace("/", "__") + ".jpg"),
                  f'{m["brand"]} {m["model"]} ({owner})')
    print(json.dumps(dict(assets=len(rows), logo_brands=len(logos), photo_models=sum(1 for k in groups if k[0] == "photo"))))


if __name__ == "__main__":
    main()
