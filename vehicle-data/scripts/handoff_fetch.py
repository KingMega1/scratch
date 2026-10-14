#!/usr/bin/env python3
"""Reproduce exact image bytes for a reviewed external handoff (no new extraction, no acceptance).

  handoff_fetch.py --sel handoff/<file>.json --out snapshots/MH_<date>_<run>
Each selection carries the reviewed sha256. Page images are downloaded from source_url; brochure images
(pdf_xref set) are the native image object `pdf_xref` of the PDF at source_url, whose sha256 must equal pdf_sha256.
Only byte-identical files are kept (<out>/files/<sha256[:20]>.<ext>); report.csv lists every outcome; sheets/*.jpg
are labelled contact sheets for visual review.
"""
import argparse, csv, hashlib, io, json, os, time

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def main():
    import requests
    from PIL import Image, ImageDraw
    ap = argparse.ArgumentParser()
    ap.add_argument("--sel", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "files"), exist_ok=True)
    os.makedirs(os.path.join(a.out, "sheets"), exist_ok=True)
    sel = json.load(open(a.sel))["selections"]
    pdfs, rows, thumbs = {}, [], []
    for s in sel:
        r = dict(p1_id=s["p1_id"], role=s["role"], sha256=s["sha256"], url=s["url"], pdf_xref=s.get("pdf_xref", ""))
        try:
            if s.get("pdf_xref") not in ("", None):
                if s["url"] not in pdfs:
                    pdfs[s["url"]] = requests.get(s["url"], headers=UA, timeout=120).content
                    time.sleep(1)
                pb = pdfs[s["url"]]
                r["pdf_sha_match"] = hashlib.sha256(pb).hexdigest() == s["pdf_sha256"]
                import fitz
                b = fitz.open(stream=pb, filetype="pdf").extract_image(int(s["pdf_xref"]))["image"]
            else:
                b = requests.get(s["url"], headers=UA, timeout=60).content
                time.sleep(0.5)
            h = hashlib.sha256(b).hexdigest()
            r["match"] = h == s["sha256"]
            if r["match"]:
                im = Image.open(io.BytesIO(b))
                ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(im.format, "bin")
                f = os.path.join(a.out, "files", f"{h[:20]}.{ext}")
                open(f, "wb").write(b)
                r.update(file=os.path.relpath(f, a.out), width=im.width, height=im.height)
                t = im.convert("RGB")
                t.thumbnail((320, 200))
                thumbs.append((f"{s['p1_id']} {s['role']} {im.width}x{im.height} {h[:8]}", t))
        except Exception as x:
            r["error"] = str(x)[:200]
        rows.append(r)
    cols = ["p1_id", "role", "sha256", "url", "pdf_xref", "pdf_sha_match", "match", "file", "width", "height", "error"]
    with open(os.path.join(a.out, "report.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    W, H, c = 330, 230, 5
    for i in range(0, len(thumbs), 20):
        ch = thumbs[i:i + 20]
        S = Image.new("RGB", (W * c, H * ((len(ch) + c - 1) // c)), "white")
        d = ImageDraw.Draw(S)
        for k, (lab, t) in enumerate(ch):
            x, y = (k % c) * W, (k // c) * H
            S.paste(t, (x + 5, y + 2))
            d.text((x + 5, y + H - 22), lab, fill="black")
        S.save(os.path.join(a.out, "sheets", f"handoff_{i // 20:02d}.jpg"), "JPEG", quality=78)
    print(f"selections {len(rows)} byte-identical {sum(1 for r in rows if r.get('match'))}")


if __name__ == "__main__":
    main()
