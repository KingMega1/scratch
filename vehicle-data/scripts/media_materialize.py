#!/usr/bin/env python3
"""Materialize accepted media into P5-servable files (P5 contract: /media/models/<site_slug>.webp; CSP img-src 'self').

  media_materialize.py [--report snapshots/MM_<date>_<run>]

For every registry/media_accepted.csv row with status ACCEPT/ACCEPT_LIMITED, an http(s) source and a local_path:
download, require sha256 == the reviewed sha256 (bytes that were visually verified), convert to WebP (max 2400 px
wide, quality 85, never upscaled) and write vehicle-data/<local_path>. Drive-archive sources are skipped here (no
Drive credentials in CI). Writes <report>/materialize.csv and labelled contact sheets for independent spot checks.
"""
import argparse, csv, hashlib, io, os, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def main():
    import requests
    from PIL import Image, ImageDraw
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.report, "sheets"), exist_ok=True)
    rows = list(csv.DictReader(open(os.path.join(ROOT, "registry", "media_accepted.csv"))))
    out, thumbs = [], []
    for r in rows:
        if r["status"] not in ("ACCEPT", "ACCEPT_LIMITED") or not r["local_path"] or not r["url"].startswith("http") \
                or "drive.google" in r["url"]:
            continue
        dst = os.path.join(ROOT, r["local_path"])
        res = dict(asset_id=r["asset_id"], owner=r["owner"], kind=r["kind"], local_path=r["local_path"], url=r["url"])
        try:
            for i in range(4):  # 429 back-off (Commons rate limits)
                resp = requests.get(r["url"], headers=UA, timeout=60)
                if resp.status_code != 429:
                    break
                time.sleep(10 * (i + 1))
            b = resp.content
            h = hashlib.sha256(b).hexdigest()
            res.update(http=resp.status_code, sha256=h, sha_match=h == r["sha256"])
            if resp.status_code == 200 and h == r["sha256"]:
                if r["url"].lower().split("?")[0].endswith(".svg") or b[:200].lstrip().startswith((b"<svg", b"<?xml")):
                    import cairosvg  # official-site SVG logos: render at the reviewed width
                    b = cairosvg.svg2png(bytestring=b, output_width=int(r["width"]))
                im = Image.open(io.BytesIO(b))
                im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
                if im.width > 2400:
                    im = im.resize((2400, round(im.height * 2400 / im.width)), Image.LANCZOS)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if dst.endswith(".png"):  # logos keep lossless PNG with transparency
                    im.save(dst, "PNG", optimize=True)
                else:
                    im.save(dst, "WEBP", quality=85, method=6)
                res.update(written=True, out_width=im.width, out_height=im.height, out_bytes=os.path.getsize(dst))
                if r["kind"] == "hero":
                    t = im.convert("RGB")
                    t.thumbnail((300, 190))
                    thumbs.append((r["owner"], t))
            else:
                res.update(written=False)
                if resp.status_code == 200:  # re-rendered upstream bytes: keep for a fresh visual review, never served
                    os.makedirs(os.path.join(a.report, "mismatch"), exist_ok=True)
                    open(os.path.join(a.report, "mismatch", r["asset_id"] + "_" + h[:12] + ".bin"), "wb").write(b)
        except Exception as x:
            res.update(written=False, error=str(x)[:200])
        out.append(res)
        time.sleep(0.3)
    cols = ["asset_id", "owner", "kind", "local_path", "url", "http", "sha256", "sha_match", "written", "out_width",
            "out_height", "out_bytes", "error"]
    with open(os.path.join(a.report, "materialize.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    W, H, cols_n = 310, 215, 4
    for i in range(0, len(thumbs), 16):
        chunk = thumbs[i:i + 16]
        S = Image.new("RGB", (W * cols_n, H * ((len(chunk) + cols_n - 1) // cols_n)), "white")
        d = ImageDraw.Draw(S)
        for k, (owner, t) in enumerate(chunk):
            x, y = (k % cols_n) * W, (k // cols_n) * H
            S.paste(t, (x + 5, y + 2))
            d.text((x + 5, y + H - 18), owner, fill="black")
        S.save(os.path.join(a.report, "sheets", f"heroes_{i // 16:02d}.jpg"), "JPEG", quality=72)
    print(f"materialized {sum(1 for r in out if r.get('written'))}/{len(out)}; sha mismatches "
          f"{sum(1 for r in out if r.get('sha_match') is False)}")


if __name__ == "__main__":
    main()
