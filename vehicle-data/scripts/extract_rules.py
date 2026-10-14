"""Offline candidate rules for extract_official.py (no network, deterministic).

Model attribution: a page or PDF is attributed to an allocated p1_id only when its URL path (or PDF file name /
anchor text) carries exactly that model's token and no longer allocated token of the same brand also matches
(e.g. a tiggo-7-pro page is never attributed to chery/tiggo-7). Brand-wide statements are written to
brand_statements.csv for P2, never fanned out to models. PROBE hosts count only when OWNER_PROOF matches.
"""
import csv, os, re
from urllib.parse import urlparse, unquote

AR_DIG = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "ten": 10}
YRS = r"(\d{1,2}|one|two|three|four|five|six|seven|eight|ten)[\s-]*(?:\(\d+\)\s*)?(?:years?|yrs?)"
KM = r"(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})\s*(?:km|kilomet(?:er|re)s?|k\.m)"
W_EN = [re.compile(YRS + r"[^.\n]{0,40}?" + KM, re.I), re.compile(KM + r"[^.\n]{0,40}?" + YRS, re.I)]
W_EN_YONLY = re.compile(YRS + r"[^.\n]{0,25}warrant|warrant[^.\n]{0,40}?" + YRS, re.I)
AR_Y = r"(\d{1,2}|سنتين|ثلاث|خمس|سبع|ست|أربع|اربع|عشر)\s*(?:سنوات|سنة|سنين|أعوام|اعوام|عام)?"
AR_KM = r"(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})\s*(?:ألف\s*)?(?:كم|كيلو)"
W_AR = [re.compile(AR_Y + r"[^.\n]{0,40}?" + AR_KM), re.compile(AR_KM + r"[^.\n]{0,40}?" + AR_Y)]
AR_WORD = {"سنتين": 2, "ثلاث": 3, "أربع": 4, "اربع": 4, "خمس": 5, "ست": 6, "سبع": 7, "عشر": 10}
OWNER_PROOF = re.compile(r"egypt|مصر|\.eg\b", re.I)
SPEC_FIELDS = [  # (field, unit, label regex)  -- only labels that are unambiguous
    ("engine_cc", "cc", r"^(engine )?(displacement|capacity|engine capacity|cylinder capacity|سعة المحرك)\b"),
    ("power_hp", "hp", r"^(max(imum)?\.? )?(power|horse ?power|output)\b|القوة|القدرة"),
    ("torque_nm", "Nm", r"^(max(imum)?\.? )?torque\b|عزم"),
    ("length_mm", "mm", r"^(overall )?length\b|^الطول"),
    ("width_mm", "mm", r"^(overall )?width\b|^العرض"),
    ("height_mm", "mm", r"^(overall )?height\b|^الارتفاع"),
    ("wheelbase_mm", "mm", r"^wheel ?base\b|قاعدة العجلات"),
    ("ground_clearance_mm", "mm", r"^(min(imum)? )?ground clearance\b|الخلوص الأرضي"),
    ("fuel_tank_l", "L", r"^fuel tank( capacity)?\b|خزان الوقود"),
    ("boot_l", "L", r"^(luggage|boot|trunk|cargo)( space| capacity| volume)?\b|سعة الشنطة"),
    ("transmission", "", r"^(transmission|gear ?box)\b|ناقل الحركة"),
    ("seats", "", r"^(seating capacity|seats|no\.? of seats)\b|عدد المقاعد"),
]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def tokens(r):
    b, m = r["p1_id"].split("/", 1)
    return {t for t in {norm(m), norm(r["model"]), norm(b) + norm(m)} if len(t) >= 2}


def attribute(text_segments, rows):
    """Return the single p1_id whose token exactly equals a segment; longest wins, ties -> None."""
    hits = []
    segs = [norm(s) for s in text_segments if s]
    for r in rows:
        for t in tokens(r):
            if t in segs:
                hits.append((len(t), r["p1_id"]))
    if not hits:
        return None
    hits.sort(reverse=True)
    best = [h for h in hits if h[0] == hits[0][0]]
    ids = {h[1] for h in best}
    return ids.pop() if len(ids) == 1 else None


def url_segments(u):
    p = unquote(urlparse(u).path)
    segs = [s for s in re.split(r"[/]", p) if s]
    out = list(segs)
    for s in segs:  # file names like "Tiggo-7-Brochure.pdf" -> also test the part before brochure words
        base = re.sub(r"\.(pdf|html?)$", "", s, flags=re.I)
        base = re.sub(r"[-_ ]?(brochure|catalog(ue)?|spec(s|ification)?s?|en|ar|egypt|eg|20\d\d|my\d\d)$", "", base, flags=re.I)
        out.append(base)
    return out


def num(s):
    return int(re.sub(r"[,.\s]", "", s))


def yrs(s):
    s = s.lower()
    return WORD_NUM.get(s) or AR_WORD.get(s) or int(s)


def warranty_hits(text):
    t = text.translate(AR_DIG)
    out = []
    for line in re.split(r"[\n•|]+", t):
        if not re.search(r"warrant|ضمان", line, re.I):
            continue
        line = " ".join(line.split())
        for rx in W_EN + W_AR:
            m = rx.search(line)
            if m:
                g = m.groups()
                y, k = (g[0], g[1]) if re.match(r"\d{1,2}$|[a-z]|[؀-ۿ]", g[0]) and not re.match(r"\d{3,}", g[0]) else (g[1], g[0])
                try:
                    yv, kv = yrs(y), num(k)
                except ValueError:
                    continue
                if "ألف" in m.group(0) and kv < 1000:
                    kv *= 1000
                if 1 <= yv <= 10 and 10_000 <= kv <= 1_000_000:
                    out.append((yv, kv, line[:300]))
                break
        else:
            m = W_EN_YONLY.search(line)
            if m:
                y = next(x for x in m.groups() if x)
                if 1 <= yrs(y) <= 10:
                    out.append((yrs(y), "", line[:300]))
    return out


def component(q):
    if re.search(r"batter|بطاري", q, re.I):
        return "battery"
    if re.search(r"engine|powertrain|motor|المحرك", q, re.I):
        return "engine/powertrain"
    if re.search(r"paint|corrosion|rust|الصدأ|الدهان", q, re.I):
        return "paint/corrosion"
    return "vehicle (as stated)"


def issuer_for(host, brand):
    return f"{brand} Egypt official site ({host})"


def run(out, pages, pdfs, alloc):
    by_brand = {}
    for r in alloc:
        by_brand.setdefault(r["brand"], []).append(r)
    want = {r["p1_id"]: r["claude_cloud_extraction"] for r in alloc}
    owner_ok = {}
    for p in pages:
        h = urlparse(p["final_url"]).netloc
        txt = " ".join(p["lines"][:400] + p["lines"][-200:]) + " " + h
        if p["host_status"] == "KNOWN" or (OWNER_PROOF.search(txt) and re.search(re.escape(p["brand"].split()[0]), txt, re.I)):
            owner_ok[h] = owner_ok.get(h) or p["host_status"]
    W, B, S, BS = [], [], [], []

    for p in pages:
        h = urlparse(p["final_url"]).netloc
        if h not in owner_ok:
            continue
        rows = by_brand.get(p["brand"], [])
        pid = attribute(url_segments(p["final_url"]), rows)
        hits = warranty_hits("\n".join(p["lines"]))
        for y, k, q in hits:
            if pid and "warranty" in want.get(pid, ""):
                W.append(dict(p1_id=pid, years=y, km=k, scope="model page; " + component(q), source_url=p["final_url"],
                              issuer=issuer_for(h, p["brand"]), retrieved_at=p["retrieved_at"], quote=q))
            elif not pid:
                BS.append(dict(brand=p["brand"], kind="warranty", years=y, km=k, source_url=p["final_url"],
                               retrieved_at=p["retrieved_at"], quote=q))
    for d in pdfs:
        if d.get("status") != 200:
            continue
        rows = by_brand.get(d["brand"], [])
        segs = url_segments(d["final_url"]) + [d.get("anchor", "")]
        pid = attribute(segs, rows) or (attribute(url_segments(d.get("source_page") or ""), rows) if d.get("source_page") else None)
        src_host = urlparse(d.get("source_page") or d["final_url"]).netloc
        if not pid or src_host not in owner_ok:
            continue
        first = " ".join((d.get("text") or [""])[:3])
        model = next(r["model"] for r in rows if r["p1_id"] == pid)
        if norm(model) not in norm(" ".join(d.get("text") or [])) and norm(model) not in norm(" ".join(segs)):
            continue  # PDF never names the model: not attributable
        yrs_ = sorted(set(re.findall(r"\b(202[3-8])\b", first + " " + " ".join(segs))))
        my = yrs_[0] if len(yrs_) == 1 else ""
        if "brochure" in want.get(pid, ""):
            B.append(dict(p1_id=pid, model_year=my, url=d["final_url"], sha256=d["sha256"], bytes=d["bytes"],
                          pages=d.get("pages") or "", issuer=issuer_for(src_host, d["brand"]), retrieved_at=d["retrieved_at"]))
        for y, k, q in warranty_hits("\n".join(d.get("text") or [])):
            if "warranty" in want.get(pid, ""):
                W.append(dict(p1_id=pid, years=y, km=k, scope="brochure; " + component(q), source_url=d["final_url"],
                              issuer=issuer_for(src_host, d["brand"]), retrieved_at=d["retrieved_at"], quote=q))

    def dedup(rows, keys):
        seen, outr = set(), []
        for r in rows:
            k = tuple(r[x] for x in keys)
            if k not in seen:
                seen.add(k)
                outr.append(r)
        return outr

    files = {
        "warranty_candidates.csv": (dedup(W, ["p1_id", "years", "km", "source_url"]),
                                    ["p1_id", "years", "km", "scope", "source_url", "issuer", "retrieved_at", "quote"]),
        "brochure_candidates.csv": (dedup(B, ["p1_id", "sha256"]),
                                    ["p1_id", "model_year", "url", "sha256", "bytes", "pages", "issuer", "retrieved_at"]),
        "specs_candidates.csv": (dedup(S, ["p1_id", "model_year", "trim", "field", "source_url"]),
                                 ["p1_id", "model_year", "trim", "field", "value", "unit", "source_url", "issuer", "retrieved_at", "quote"]),
        "brand_statements.csv": (dedup(BS, ["brand", "years", "km", "source_url"]),
                                 ["brand", "kind", "years", "km", "source_url", "retrieved_at", "quote"]),
    }
    for fn, (rows, cols) in files.items():
        with open(os.path.join(out, fn), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)
        print(fn, len(rows))
    return owner_ok
