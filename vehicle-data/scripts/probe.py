#!/usr/bin/env python3
"""Fetch a short list of URLs and keep the raw responses for offline parser development (no parsing, no acceptance).

  probe.py --urls probe.urls --out snapshots/P_<date>_<run>
Writes <out>/raw/<n>.<ext>.gz and <out>/manifest.json (url, status, final_url, content_type, bytes, sha256).
"""
import argparse, gzip, hashlib, json, os, time

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def main():
    import requests
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "raw"), exist_ok=True)
    man = []
    urls = [u.strip() for u in open(a.urls) if u.strip() and not u.startswith("#")]
    for i, u in enumerate(urls):
        r = dict(n=i, url=u)
        try:
            x = requests.get(u, headers=UA, timeout=60)
            b = x.content
            ext = "xml" if "xml" in x.headers.get("content-type", "") else "txt" if u.endswith(".txt") else "html"
            open(os.path.join(a.out, "raw", f"{i:03d}.{ext}.gz"), "wb").write(gzip.compress(b))
            if ext == "html":  # committed evidence: visible text + links (raw/ is not committed)
                import html as H, re
                t = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", b.decode("utf-8", "replace"))
                links = sorted(set(re.findall(r'href="([^"#]+)"', t)))
                txt = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
                os.makedirs(os.path.join(a.out, "text"), exist_ok=True)
                open(os.path.join(a.out, "text", f"{i:03d}.txt"), "w").write(u + "\n" + txt[:200000])
                json.dump(links, open(os.path.join(a.out, "text", f"{i:03d}.links.json"), "w"))
            r.update(status=x.status_code, final_url=x.url, content_type=x.headers.get("content-type"), bytes=len(b),
                     sha256=hashlib.sha256(b).hexdigest())
        except Exception as e:
            r.update(status=None, error=str(e)[:200])
        man.append(r)
        time.sleep(1.5)
    json.dump(man, open(os.path.join(a.out, "manifest.json"), "w"), indent=1)
    print(json.dumps([(m["n"], m.get("status"), m.get("bytes")) for m in man]))


if __name__ == "__main__":
    main()
