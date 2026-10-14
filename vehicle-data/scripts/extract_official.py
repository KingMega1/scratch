#!/usr/bin/env python3
"""Official Egypt OEM/importer harvest for the Claude Code Cloud extraction lane (candidates only, no acceptance).

  extract_official.py harvest --out <snap>     # network (GitHub Actions): robots-checked crawl of official sites + PDFs
  extract_official.py extract --out <snap>     # offline: evidence -> specs/warranty/brochure_candidates.csv

Scope: allocation rows with a non-empty `claude_cloud_extraction` column (handoff/parallel-allocation-20261014.csv).
Hosts come from registry/logo_sites.csv, inputs/u11/official/official_sources.json and SEEDS below. Hosts marked
PROBE are unverified guesses: their pages are harvested, but extract emits rows from them only after the page itself
names the Egypt distributor/site (OWNER_PROOF). Raw bytes go to the CI artifact; evidence.jsonl.gz / pdfs.jsonl.gz
keep everything the extractor reads. No LLM, no paid services. Unknown stays unknown.
"""
import argparse, csv, gzip, hashlib, io, json, os, re, sys, time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, urldefrag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOC = os.path.join(ROOT, "handoff", "parallel-allocation-20261014.csv")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en,ar;q=0.8"}
BLOCKED_HOSTS = {"www.soueastegypt.com", "soueastegypt.com", "www.changanegypt.com"}  # official_sources.json blocked_sources

# brand -> (seed urls, status). KNOWN = already in logo_sites/official_sources; PROBE = unverified, needs OWNER_PROOF.
SEEDS = {
    "Mercedes-Benz": (["https://www.mercedes-benz.com.eg/"], "PROBE"),
    "Audi": (["https://www.audi-egypt.com/", "https://www.audi.com.eg/"], "PROBE"),
    "Geely": (["https://geely-egypt.com/", "https://www.geelyegypt.com/", "https://geely.com.eg/"], "PROBE"),
    "Suzuki": (["https://suzuki.com.eg/", "https://www.suzukiegypt.com/", "https://suzuki-egypt.com/"], "PROBE"),
    "Mitsubishi": (["https://www.mitsubishimotors-eg.com/en"], "PROBE"),
    "Volkswagen": (["https://www.volkswagen-egypt.com/", "https://www.vw.com.eg/", "https://www.vw-egypt.com/"], "PROBE"),
    "Renault": (["https://www.renault.com.eg/", "https://www.renault-egypt.com/", "https://www.renaultegypt.com/"], "PROBE"),
    "Volvo": (["https://www.volvocars.com/eg/"], "PROBE"),
    "BAIC": (["https://baicegypt.com/", "https://www.baic-egypt.com/", "https://www.alkanauto.com/"], "PROBE"),
    "GAC": (["https://gacmotor-eg.com/", "https://www.gacegypt.com/", "https://gac-egypt.com/"], "PROBE"),
    "Forthing": (["https://forthing-egypt.com/", "https://www.forthingegypt.com/", "https://forthing.com.eg/"], "PROBE"),
    "Proton": (["https://proton-egypt.com/", "https://www.protonegypt.com/"], "PROBE"),
    "Fiat": (["https://www.fiategypt.com/", "https://www.fiat-egypt.com/"], "PROBE"),
    "JAC": (["https://jac-egypt.com/", "https://www.jacegypt.com/", "https://jac.com.eg/"], "PROBE"),
    "Kaiyi": (["https://kaiyi-egypt.com/", "https://kaiyiegypt.com/"], "PROBE"),
    "SEAT": (["https://www.seat-egypt.com/", "https://www.seategypt.com/"], "PROBE"),
    "CUPRA": (["https://www.cupra-egypt.com/", "https://www.cupraofficial.com.eg/"], "PROBE"),
    "XPeng": (["https://www.xpeng.com/eg"], "PROBE"),
    "Dongfeng": (["https://dongfeng-egypt.com/", "https://www.dongfengegypt.com/"], "PROBE"),
    "Genesis": (["https://www.genesis.com/eg/en"], "PROBE"),
    "Cadillac": (["https://www.cadillacarabia.com/eg-ar"], "PROBE"),
    "GMC": (["https://www.gmcarabia.com/eg-ar"], "PROBE"),
    "Hyundai": (["https://hyundai-egypt.net/"], "KNOWN"),
    "Lynk & Co": (["https://www.lynkco-egypt.com/"], "PROBE"),
    "Alfa Romeo": (["https://www.alfaromeo-eg.com/", "https://www.alfaromeoegypt.com/"], "PROBE"),
    "Jeep": (["https://www.jeep-egypt.com/", "https://www.jeepegypt.com/"], "PROBE"),
    "DFSK": (["https://dfsk-egypt.com/", "https://www.dfskegypt.com/"], "PROBE"),
    "Haval": (["https://www.greatwall.eg/"], "KNOWN"),
    "Opel": (["https://www.opelegypt.net/"], "KNOWN"),
}
MAX_PAGES_PER_HOST = 70
MAX_TARGET_PAGES = 20
MAX_PDFS = 160
MAX_PDF_BYTES = 40_000_000
KEYWORDS = re.compile(r"spec|warrant|brochure|download|catalog|technical|ضمان|المواصفات|مواصفات|كتيب|بروشور", re.I)
PDF_HINT = re.compile(r"\.pdf(\?|$)|brochure", re.I)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def alloc_rows():
    return [r for r in csv.DictReader(open(ALLOC)) if r["claude_cloud_extraction"].strip()]


def brand_hosts():
    """brand -> [(url, status)] from logo_sites, official_sources pages and SEEDS."""
    out = {}
    for r in csv.DictReader(open(os.path.join(ROOT, "registry", "logo_sites.csv"))):
        out.setdefault(r["brand"], []).append((r["homepage"], "KNOWN"))
    off = json.load(open(os.path.join(ROOT, "inputs", "u11", "official", "official_sources.json")))
    rows = {r["p1_id"]: r["brand"] for r in csv.DictReader(open(ALLOC))}
    for p in off["pages"]:
        b = rows.get(p.get("universe_id") or "")
        if not b:
            b = {"mg_eg_web": "MG", "toyota_eg_web": "Toyota", "kia_eg_web": "Kia", "chevrolet_eg_web": "Chevrolet",
                 "skoda_eg_web": "Skoda"}.get(p["source"])
        if b:
            out.setdefault(b, []).append((p["url"], "KNOWN"))
    for b, (urls, st) in SEEDS.items():
        for u in urls:
            out.setdefault(b, []).append((u, st))
    return out


def model_tokens(p1_id, model):
    b, m = p1_id.split("/", 1)
    toks = {norm(m), norm(model), norm(b) + norm(m)}
    return {t for t in toks if len(t) >= 2}


def path_matches(url, toks):
    segs = [norm(s) for s in urlparse(url).path.split("/") if s]
    for s in segs:
        for t in toks:
            if s == t or (len(t) >= 3 and (s.startswith(t) or s.endswith(t))) or (len(t) >= 5 and t in s):
                return True
    return False


# ------------------------------------------------------------------ harvest (network)

class Robots:
    def __init__(self, sess):
        self.sess, self.cache, self.sitemaps = sess, {}, {}

    def allowed(self, url):
        import urllib.robotparser
        p = urlparse(url)
        key = f"{p.scheme}://{p.netloc}"
        if key not in self.cache:
            rp = urllib.robotparser.RobotFileParser()
            status = None
            try:
                r = self.sess.get(key + "/robots.txt", headers=UA, timeout=30)
                status = r.status_code
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                    self.sitemaps[key] = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", r.text)
                elif 400 <= r.status_code < 500:
                    rp.allow_all = True
                else:
                    rp.disallow_all = True
            except Exception as e:
                status = f"error:{type(e).__name__}"
                rp.disallow_all = True
            self.cache[key] = (rp, status)
        rp, _ = self.cache[key]
        return rp.can_fetch(UA["User-Agent"], url)


def page_evidence(url, final_url, html):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(html, "html.parser")
    links = []
    for a in s.find_all("a", href=True):
        h = urldefrag(urljoin(final_url, a["href"].strip()))[0]
        if h.startswith("http"):
            links.append([h, " ".join(a.get_text(" ").split())[:160]])
    for t in s.find_all(["iframe", "embed", "object"]):
        h = t.get("src") or t.get("data")
        if h:
            links.append([urljoin(final_url, h), "embed"])
    scripts = []
    for sc in s.find_all("script"):
        txt = sc.string or ""
        if len(txt) > 40 and re.search(r"warrant|spec|brochure|\.pdf|ضمان|engine|torque|displacement", txt, re.I):
            scripts.append(txt[:300_000])
    tables = []
    for tb in s.find_all("table"):
        rows = []
        for tr in tb.find_all("tr"):
            cells = [" ".join(c.get_text(" ").split()) for c in tr.find_all(["th", "td"])]
            if any(cells):
                rows.append(cells)
        if rows:
            tables.append(rows)
    title = " ".join((s.title.get_text() if s.title else "").split())
    for x in s(["script", "style", "noscript", "svg"]):
        x.decompose()
    lines = [l.strip() for l in s.get_text("\n").split("\n") if l.strip()]
    return dict(title=title, lines=lines[:6000], tables=tables, links=links, scripts=scripts[:12])


def harvest(out, targets=None):
    """targets: CSV (p1_id,url,note) -> fetch only those seeds (TARGET status), no sitemap crawl, MAX_TARGET_PAGES per host."""
    import requests
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    sess = requests.Session()
    robots = Robots(sess)
    rows = alloc_rows()
    tg = list(csv.DictReader(open(targets))) if targets else []
    if tg:
        ids = {t["p1_id"] for t in tg}
        rows = [r for r in rows if r["p1_id"] in ids]
    by_brand = {}
    for r in rows:
        by_brand.setdefault(r["brand"], []).append(r)
    hosts = brand_hosts()
    if tg:
        b_of = {r["p1_id"]: r["brand"] for r in rows}
        hosts = {}
        for t in tg:
            hosts.setdefault(b_of[t["p1_id"]], []).append((t["url"], "TARGET"))
    cap = MAX_TARGET_PAGES if tg else MAX_PAGES_PER_HOST
    ev_f = gzip.open(os.path.join(out, "evidence.jsonl.gz"), "wt")
    pdf_f = gzip.open(os.path.join(out, "pdfs.jsonl.gz"), "wt")
    manifest, pdf_queue, seen = [], {}, set()
    t0 = time.time()

    def get(url, brand, kind, status, depth):
        if url in seen:
            return None
        seen.add(url)
        host = urlparse(url).netloc
        rec = dict(url=url, brand=brand, kind=kind, host_status=status, depth=depth, retrieved_at=now())
        if host in BLOCKED_HOSTS:
            rec["skipped"] = "BLOCKED_SOURCE"
        elif not robots.allowed(url):
            rec["skipped"] = "ROBOTS_DISALLOW_OR_UNREACHABLE"
        if rec.get("skipped"):
            manifest.append(rec)
            return None
        try:
            r = sess.get(url, headers=UA, timeout=45, allow_redirects=True)
            b = r.content
            rec.update(final_url=r.url, status=r.status_code, bytes=len(b), sha256=hashlib.sha256(b).hexdigest(),
                       content_type=r.headers.get("content-type", ""), http_date=r.headers.get("date"))
            with open(os.path.join(out, "raw", rec["sha256"][:16] + ".gz"), "wb") as f:
                f.write(gzip.compress(b))
        except Exception as e:
            rec["error"] = f"{type(e).__name__}: {e}"[:300]
            manifest.append(rec)
            return None
        manifest.append(rec)
        time.sleep(0.7)
        if rec["status"] != 200 or "html" not in rec["content_type"]:
            return None
        html = b.decode(r.encoding or "utf-8", "replace") if r.encoding else b.decode("utf-8", "replace")
        e = page_evidence(url, r.url, html)
        e.update({k: rec[k] for k in ("url", "final_url", "brand", "kind", "host_status", "retrieved_at", "sha256", "bytes")})
        ev_f.write(json.dumps(e, ensure_ascii=False) + "\n")
        return e

    for brand in sorted(by_brand, key=lambda b: -max(int(r["registrations_last12"] or 0) for r in by_brand[b])):
        seeds = hosts.get(brand, [])
        if not seeds:
            continue
        toks = {r["p1_id"]: model_tokens(r["p1_id"], r["model"]) for r in by_brand[brand]}
        alltoks = set().union(*toks.values())
        per_host = {}
        frontier = [(u, st, 0) for u, st in seeds]
        # sitemap URLs per seed host (robots Sitemap: lines + /sitemap.xml), filtered to allocated model tokens
        for u, st in ([] if tg else seeds):
            p = urlparse(u)
            key = f"{p.scheme}://{p.netloc}"
            robots.allowed(u)
            sms = robots.sitemaps.get(key) or [key + "/sitemap.xml"]
            for sm in sms[:3]:
                for loc in sitemap_urls(sess, robots, sm, depth=0):
                    if urlparse(loc).netloc == p.netloc and (path_matches(loc, alltoks) or KEYWORDS.search(loc)):
                        frontier.append((loc, st, 1))
        while frontier:
            u, st, d = frontier.pop(0)
            if PDF_HINT.search(urlparse(u).path) and u.lower().split("?")[0].endswith(".pdf"):
                pdf_queue.setdefault(u, dict(brand=brand, host_status=st, source_page="", anchor="sitemap/seed"))
                continue
            h = urlparse(u).netloc
            if per_host.get(h, 0) >= cap:
                continue
            per_host[h] = per_host.get(h, 0) + 1
            e = get(u, brand, "page", st, d)
            if not e or d >= (1 if tg else 2):
                continue
            for link, text in e["links"]:
                lp = urlparse(link)
                if link.lower().split("?")[0].endswith(".pdf") or re.search(r"brochure|كتيب|بروشور", text, re.I):
                    if link.lower().split("?")[0].endswith(".pdf"):
                        pdf_queue.setdefault(link, dict(brand=brand, host_status=st, source_page=e["final_url"], anchor=text))
                        continue
                if lp.netloc != h or link in seen:
                    continue
                if path_matches(link, alltoks) or norm(text) in alltoks or KEYWORDS.search(link + " " + text):
                    frontier.append((link, st, d + 1))
        print(f"{brand}: pages={sum(per_host.values())} hosts={per_host} t={time.time() - t0:.0f}s", flush=True)

    # PDFs: brochures linked from official pages (any host, typically a CDN)
    for i, (u, meta) in enumerate(list(pdf_queue.items())[:MAX_PDFS]):
        rec = dict(url=u, kind="pdf", retrieved_at=now(), **meta)
        if not robots.allowed(u):
            rec["skipped"] = "ROBOTS_DISALLOW_OR_UNREACHABLE"
            manifest.append(rec)
            continue
        try:
            r = sess.get(u, headers=UA, timeout=120, stream=True)
            buf = io.BytesIO()
            for chunk in r.iter_content(1 << 16):
                buf.write(chunk)
                if buf.tell() > MAX_PDF_BYTES:
                    raise ValueError("too large")
            b = buf.getvalue()
            rec.update(final_url=r.url, status=r.status_code, bytes=len(b), sha256=hashlib.sha256(b).hexdigest(),
                       content_type=r.headers.get("content-type", ""))
        except Exception as e:
            rec["error"] = f"{type(e).__name__}: {e}"[:300]
            manifest.append(rec)
            continue
        manifest.append(rec)
        if r.status_code == 200 and b[:5] == b"%PDF-":
            with open(os.path.join(out, "raw", rec["sha256"][:16] + ".pdf"), "wb") as f:
                f.write(b)
            pages, texts = None, []
            try:
                from pypdf import PdfReader
                rd = PdfReader(io.BytesIO(b))
                pages = len(rd.pages)
                for pg in rd.pages[:60]:
                    try:
                        texts.append((pg.extract_text() or "")[:8000])
                    except Exception:
                        texts.append("")
            except Exception as e:
                rec["pdf_error"] = str(e)[:200]
            pdf_f.write(json.dumps(dict(rec, pages=pages, text=texts), ensure_ascii=False) + "\n")
        time.sleep(0.7)
    ev_f.close()
    pdf_f.close()
    robots_log = {k: v[1] for k, v in robots.cache.items()}
    json.dump(manifest, open(os.path.join(out, "fetch_manifest.json"), "w"), indent=1)
    json.dump(robots_log, open(os.path.join(out, "robots_status.json"), "w"), indent=1)
    ok = [m for m in manifest if m.get("status") == 200]
    rep = dict(snapshot=out, mode="x2" if tg else "x1", seconds=int(time.time() - t0), requests=len(manifest), ok=len(ok),
               pdfs_ok=sum(1 for m in ok if m["kind"] == "pdf"), skipped=sum(1 for m in manifest if m.get("skipped")),
               bytes=sum(m.get("bytes", 0) for m in ok), llm_calls=0)
    json.dump(rep, open(os.path.join(out, "run_report.json"), "w"), indent=1)
    print(json.dumps(rep, indent=1))


def sitemap_urls(sess, robots, url, depth):
    if depth > 1 or not robots.allowed(url):
        return []
    try:
        r = sess.get(url, headers=UA, timeout=30)
        if r.status_code != 200:
            return []
        txt = gzip.decompress(r.content).decode("utf-8", "replace") if r.content[:2] == b"\x1f\x8b" else r.text
    except Exception:
        return []
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", txt)
    if "<sitemapindex" in txt:
        out = []
        for sm in locs[:25]:
            out += sitemap_urls(sess, robots, sm, depth + 1)
        return out
    return locs[:5000]


# ------------------------------------------------------------------ extract (offline)

def load_jsonl(p):
    if not os.path.exists(p):
        return []
    with gzip.open(p, "rt") as f:
        return [json.loads(l) for l in f if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["harvest", "extract"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--targets", help="harvest: CSV p1_id,url,note; restrict the crawl to these seeds")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if a.cmd == "harvest":
        harvest(a.out, a.targets)
    else:
        import extract_rules  # offline rules, written against the harvested evidence
        extract_rules.run(a.out, load_jsonl(os.path.join(a.out, "evidence.jsonl.gz")),
                          load_jsonl(os.path.join(a.out, "pdfs.jsonl.gz")), alloc_rows())


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
