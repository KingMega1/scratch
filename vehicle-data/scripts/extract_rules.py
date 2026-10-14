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
KM = r"(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7}|1\s*million|1\s*m)\s*(?:km|kilomet(?:er|re)s?|k\.m)"
W_EN = [re.compile(YRS + r"[^.\n]{0,40}?" + KM, re.I), re.compile(KM + r"[^.\n]{0,40}?" + YRS, re.I)]
W_EN_YONLY = re.compile(YRS + r"[^.\n]{0,25}warrant|warrant[^.\n]{0,40}?" + YRS, re.I)
AR_Y = r"(\d{1,2}\s*(?=سنوات|سنة|سنين|أعوام|اعوام|عام)|سنتين|ثلاث(?=\s*سنوات)|خمس(?=\s*سنوات)|سبع(?=\s*سنوات)|ست(?=\s*سنوات)|أربع(?=\s*سنوات)|اربع(?=\s*سنوات)|عشر(?=\s*سنوات))\s*(?:سنوات|سنة|سنين|أعوام|اعوام|عام)?"
AR_KM = r"(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})\s*(?:ألف\s*)?(?:كم|كيلو)"
W_AR = [re.compile(AR_Y + r"[^.\n]{0,40}?" + AR_KM), re.compile(AR_KM + r"[^.\n]{0,40}?" + AR_Y)]
MONTHS = re.compile(r"(\d{2,3})\s*(?:months?|شهور|شهر[اًا]*)[^\n]{0,60}?(\d{1,3}(?:[,.]\d{3})+|\d{4,7})\s*(?:km|كيلو|كم)", re.I)
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


MULTI_MARKET = {"www.chevroletarabia.com": "/eg-", "www.gmcarabia.com": "/eg-", "www.cadillacarabia.com": "/eg-",
                "www.xpeng.com": "/eg", "www.volvocars.com": "/eg", "www.genesis.com": "/eg"}
NON_EG_LOCALE = re.compile(r"^(lb|iq|ae|sa|kw|qa|bh|om|jo|au|nz|uk|us|gb|za|ma|tn|dz|ly)(-(en|ar))?$", re.I)


def egypt_market(u):
    p = urlparse(u)
    pre = MULTI_MARKET.get(p.netloc)
    if pre and not p.path.lower().startswith(pre):
        return False
    return not any(NON_EG_LOCALE.match(x) for x in p.path.split("/") if x)


def url_segments(u):
    p = unquote(urlparse(u).path)
    segs = [re.sub(r"^(the|new)[_-]", "", s, flags=re.I) for s in re.split(r"[/]", p) if s]
    out = list(segs)
    for s in segs:  # file names like "Tiggo-7-Brochure.pdf" -> also test the part before brochure words
        base = re.sub(r"\.(pdf|html?)$", "", s, flags=re.I)
        base = re.sub(r"[-_ ]?(brochure|catalog(ue)?|spec(s|ification)?s?|en|ar|egypt|eg|20\d\d|my\d\d)$", "", base, flags=re.I)
        out.append(base)
        out.append(re.split(r"[-_ ]*(?:brochure|catalog)", s, flags=re.I)[0])            # "Eclipse Cross Brochure 3 FEB"
        out.append(re.sub(r"[-_ ]+M\d\d$", "", base))                                    # "Xpander M27"
        out.append(re.sub(r"[-_ ]+(ckd|cbu)$", "", base, flags=re.I))                     # "Tiggo_4_Pro-CKD" (a *-ckd p1_id still wins: longest token)
        if "deepal" in u.lower():  # Deepal S05/S07 are sold as BEV and REEV under one model name
            out.append(re.sub(r"[_-](bev|reev)([_-].*)?$", "", base, flags=re.I))      # "Deepal_s05_BEV_1_x"
        out.append(re.sub(r"-(ljf|p\d{3,}|xhn)(-.*)?$", "", s, flags=re.I))               # renault.com.eg "taliant-ljf-ph1"
    return out


def num(s):
    if re.match(r"1\s*m", s, re.I):
        return 1_000_000
    return int(re.sub(r"[,.\s]", "", s))


def yrs(s):
    s = s.lower().strip()
    return WORD_NUM.get(s) or AR_WORD.get(s) or int(s)


def _match_km(line, tail=""):
    for idx, rx in enumerate(W_EN + W_AR):
        m = rx.search(line)
        if not m or re.search(r"service|package|maintenance|صيانة|خدمة", line[m.start():m.end() + 30], re.I):
            continue
        if idx in (1, 3) and not re.match(r"\s*(warrant|ضمان)", line[m.end():], re.I):
            continue  # km-before-years only when the years are directly followed by the warranty word
        g = m.groups()
        y, k = (g[0], g[1]) if not re.match(r"\d{3,}|\d{1,3}[,.\s]\d{3}", g[0]) else (g[1], g[0])
        try:
            yv, kv = yrs(y), num(k)
        except ValueError:
            continue
        if "ألف" in m.group(0) and kv < 1000:
            kv *= 1000
        if 1 <= yv <= 10 and 10_000 <= kv <= 1_000_000:
            return yv, kv
    return None


def _match_months(line):
    m = MONTHS.search(line)
    if m and int(m.group(1)) % 12 == 0 and not re.search(r"service|package|maintenance|صيانة", line[m.start():m.end()], re.I):
        y, k = int(m.group(1)) // 12, num(m.group(2))
        if 1 <= y <= 10 and 10_000 <= k <= 1_000_000:
            return y, k
    return None


def warranty_hits(text):
    """(years, km|'', quote) per distinct statement. A statement may span up to 3 rendered lines;
    extended (paid) warranty lines are skipped."""
    t = text.translate(AR_DIG).replace("ـ", "")  # Arabic digits, tatweel
    raw = [" ".join(x.split()) for x in re.split(r"[\n•|]+", t) if x.strip()]
    out, seen = [], set()
    for i in range(len(raw)):
        if not re.search(r"warrant|ضمان", raw[i], re.I) and not any(
                re.search(r"warrant|ضمان", x, re.I) for x in raw[max(0, i - 2):i]):
            continue
        hit = None
        for n in (1, 2, 3):
            line = " ".join(raw[i:i + n])
            ctx = " ".join(raw[max(0, i - 2):i + n])
            if not re.search(r"warrant|ضمان", ctx, re.I) or re.search(r"extended|تمديد|ممتد", line, re.I):
                continue
            yk = _match_km(line) if re.search(r"warrant|ضمان", line, re.I) else None
            if yk:
                hit = (yk[0], yk[1], line[:300])
                break
            yk = _match_km(ctx)
            if yk:
                hit = (yk[0], yk[1], ctx[:300])
                break
            yk = _match_months(line) if re.search(r"warrant|ضمان", line, re.I) else None
            if yk:
                hit = (yk[0], yk[1], line[:300])
                break
        if not hit and re.search(r"warrant|ضمان", raw[i], re.I) and not re.search(r"extended|تمديد|ممتد", raw[i], re.I):
            m = W_EN_YONLY.search(raw[i])
            if m:
                y = yrs(next(x for x in m.groups() if x))
                if 1 <= y <= 10:
                    hit = (y, "", raw[i][:300])
        if hit and (hit[0], hit[1]) not in seen:
            seen.add((hit[0], hit[1]))
            # component from the clause holding the matched figure, then from a "heading:" line just above
            kstr = [f"{hit[1]:,}", str(hit[1]), f"{hit[1] // 1000}"] if hit[1] != "" else [str(hit[0])]
            clauses = re.split(r"\+|،|;| and | AND ", hit[2])
            clause = next((c for c in clauses if any(k in c for k in kstr)), hit[2])
            comp = component(clause)
            if comp == "vehicle (as stated)" and i and len(raw[i - 1]) < 40 and raw[i - 1].rstrip().endswith(":"):
                comp = component(raw[i - 1])
            out.append((hit[0], hit[1], hit[2], comp))
    # a years-only statement duplicated by a years+km statement is dropped
    return [h for h in out if h[1] != "" or not any(o[0] == h[0] and o[1] != "" for o in out)]  # (y, km, quote, component)


def component(q):
    if re.search(r"commercial|taxi|تجارية|تاكس", q, re.I):
        return "commercial use"
    if re.search(r"batter|بطاري", q, re.I):
        return "battery"
    if re.search(r"engine|powertrain|motor|المحرك", q, re.I):
        return "engine/powertrain"
    if re.search(r"transmission|gearbox|ناقل|الفتيس", q, re.I):
        return "transmission"
    if re.search(r"paint|corrosion|rust|الصدأ|الدهان|الطلاء", q, re.I):
        return "paint/corrosion"
    if re.search(r"cassette|audio|الكاسيت|الأقراص|تجميع|assembly|قطع ?الغيار|قطعة ?غيار|spare part", q, re.I):
        return "other (see quote)"
    return "vehicle (as stated)"


def issuer_for(host, brand):
    return f"{brand} Egypt official site ({host})"


BROCHURE_RX = re.compile(r"brochure|brouch|catalog|كتيب|بروشور|/brochures?/|download (bev|reev)\b", re.I)
VARIANT_RX = re.compile(r"(?<![a-z])(reev|phev|bev|ev|erev|hev|dm|i-dm|hybrid)(?![a-z])", re.I)
NOT_BROCHURE_RX = re.compile(r"warrant|warrenty|maintenance|maintence|schedule|periodic|_PM|PM_|booklet|ضمان|صيانة|draft", re.I)
WARRANTY_DOC_RX = re.compile(r"warrant|warrenty|ضمان", re.I)
MY_RX = re.compile(r"(?:\bMY\s*'?|model year\s*|موديل\s*)(20[2-3]\d)\b|\b(2[4-9])MY[_ -]", re.I)

NISSAN_LABELS = {
    "engine size / displacement": ("engine_cc", "cc"), "engine displacement": ("engine_cc", "cc"),
    "maximum power (hp/rpm)": ("power_hp", "hp"), "maximum torque (nm/rpm)": ("torque_nm", "Nm"),
    "overall length (mm)": ("length_mm", "mm"), "overall height (mm)": ("height_mm", "mm"),
    "overall width (mm) excluding mirrors": ("width_mm", "mm"), "wheelbase (mm)": ("wheelbase_mm", "mm"),
    "ground clearance (mm)": ("ground_clearance_mm", "mm"), "fuel capacity (litres)": ("fuel_tank_l", "L"),
    "luggage volume (litres)": ("boot_l", "L"), "luggage capacity (vda) (litres)": ("boot_l", "L"),
    "transmission type": ("transmission", ""), "number of seats": ("seats", ""), "kerb weight (kg)": ("kerb_weight_kg", "kg"),
    "fuel type": ("fuel", ""), "no. of cylinders": ("cylinders", ""), "number of cylinders": ("cylinders", ""),
}
RENAULT_LABELS = {"ground clearance": ("ground_clearance_mm", "mm"), "overall length": ("length_mm", "mm"),
                  "height of the vehicle": ("height_mm", "mm"), "wheelbase": ("wheelbase_mm", "mm"),
                  "minimum boot volume (liters)": ("boot_l", "L"), "tank (litres)": ("fuel_tank_l", "L")}
PDF_LINE_SPECS = [
    (re.compile(r"^(?:engine capacity|displacement\s*\((?:ml|cc)\))\s+(\d[\d.,]*\s*(?:l|cc|ml)?(?:\s*turbo)?)\b", re.I), "engine", ""),
    (re.compile(r"^max(?:imum)?\.?\s*(?:horse\s*)?power\s*(?:\([^)]*\))?\s*(?:kw\s*\(hp\))?\s*(?:/\s*rpm)?\s+(\d[\d()./\s-]*\d)", re.I), "power", ""),
    (re.compile(r"^max(?:imum)?\.?\s*torque\s*(?:\([^)]*\))?\s*(?:/\s*max(?:imum)?\s*torque speed\s*\(rpm\))?\s*(?:/\s*rpm\s*\)?)?\s*(\d[\d/\s~-]*\d)", re.I), "torque", ""),
    (re.compile(r"^wheel\s*base(?:\s*\(mm\))?\s+(\d{4})\b", re.I), "wheelbase_mm", "mm"),
    (re.compile(r"^fuel tank capacity\s*(?:\(l\))?\s+(\d{2,3})\s*l?\b", re.I), "fuel_tank_l", "L"),
    (re.compile(r"^ground clearance\s+(\d{3})\s*mm", re.I), "ground_clearance_mm", "mm"),
    (re.compile(r"^seats? number\s+(\d)\b", re.I), "seats", ""),
    (re.compile(r"^transmission\s+([A-Za-z0-9][A-Za-z0-9 ()./+-]{1,60})", re.I), "transmission", ""),
]
LWH = re.compile(r"length\W{0,3}width\W{0,3}height\s*\(mm\)\s*(\d{4})\s*[*x×]\s*(\d{4})\s*[*x×]\s*(\d{4})", re.I)
TRIM_HDR = re.compile(r"^(?:basic parameter|grade|trim|version)s?\s+([A-Za-z0-9][A-Za-z0-9 ()+./-]*[A-Za-z0-9)])", re.I)


def ascii_only(s):
    return " ".join(t for t in s.split() if all(ord(c) < 128 for c in t)).strip()


def first_num(v):
    m = re.match(r"\s*(\d[\d,]*(?:\.\d+)?)", v)
    return m.group(1).replace(",", "") if m else ""


def text_attribute(text, by_brand, brand):
    """Unnamed PDF (hashed file name): attribute only if exactly one model name of the brand (allocated or not
    in this allocation, using all allocation rows of the brand) occurs, at least 3 times, as a whole word."""
    full = " ".join(text)
    counts = {}
    for r in by_brand.get(brand, []):
        n = len(re.findall(r"(?<![A-Za-z0-9])" + re.escape(r["model"]) + r"(?![A-Za-z0-9])", full, re.I))
        if n:
            counts[r["p1_id"]] = n
    if len(counts) != 1:
        return None
    pid, n = next(iter(counts.items()))
    model = next(r["model"] for r in by_brand[brand] if r["p1_id"] == pid)
    title = (text[0] if text else "")[:120]
    return pid if n >= 3 or re.search(r"(?<![A-Za-z0-9])" + re.escape(model) + r"(?![A-Za-z0-9])", title, re.I) else None


def nissan_specs(p):
    """Grade blocks on en.nissan.com.eg versions-and-specs / specifications pages."""
    L, out, grade, block, i = p["lines"], [], None, None, 0
    while i < len(L):
        l = L[i]
        if l == "Starting from" and i > 0 and any(x == "Hide Details" for x in L[i:i + 14]):
            grade = L[i - 1]
        elif l == "Your Grade" and grade and i > 0 and L[i - 1] == "Specs":
            block = {}
            j = i + 2
            while j < len(L) and L[j] not in ("Equipment", "Get an Online Quote", "REQUEST A QUOTE", "DOWNLOAD BROCHURE", "Download Brochure"):
                key = L[j].lower().replace("  ", " ").strip()
                if key in NISSAN_LABELS and j + 1 < len(L):
                    block.setdefault(NISSAN_LABELS[key], set()).add(L[j + 1])
                    j += 2
                    continue
                j += 1
            for (f, u), vals in block.items():
                if len(vals) != 1:
                    continue  # conflicting values inside one grade block: omit
                raw = vals.pop()
                val = first_num(raw) if u else raw
                if val:
                    out.append((grade, f, val, u, f"{grade}: {raw}"))
            i = j
            continue
        i += 1
    return out


def run(out, pages, pdfs, alloc):
    by_brand = {}
    for r in alloc:
        by_brand.setdefault(r["brand"], []).append(r)
    want = {r["p1_id"]: r["claude_cloud_extraction"] for r in alloc}
    all_by_brand = {}
    for r in csv.DictReader(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                              "handoff", "parallel-allocation-20261014.csv"))):
        all_by_brand.setdefault(r["brand"], []).append(r)
    owner_ok = {}
    for p in pages:
        h = urlparse(p["final_url"]).netloc
        txt = " ".join(p["lines"][:400] + p["lines"][-200:]) + " " + h
        if p["host_status"] == "KNOWN" or (OWNER_PROOF.search(txt) and re.search(re.escape(p["brand"].split()[0]), txt, re.I)):
            owner_ok[h] = owner_ok.get(h) or p["host_status"]
    W, B, S, BS, BSRC = [], [], [], [], []

    for p in pages:
        h = urlparse(p["final_url"]).netloc
        if h not in owner_ok or not egypt_market(p["final_url"]):
            continue
        rows = by_brand.get(p["brand"], [])
        pid = attribute(url_segments(p["final_url"]), rows)
        iss = issuer_for(h, p["brand"])
        for y, k, q, comp in warranty_hits("\n".join(p["lines"])):
            if pid and "warranty" in want.get(pid, ""):
                W.append(dict(p1_id=pid, years=y, km=k, scope="model page; " + comp, source_url=p["final_url"],
                              issuer=iss, retrieved_at=p["retrieved_at"], quote=q))
            elif not pid:
                BS.append(dict(brand=p["brand"], kind="warranty", years=y, km=k, source_url=p["final_url"],
                               retrieved_at=p["retrieved_at"], quote=q))
        if not pid or "specs" not in want.get(pid, ""):
            continue
        my = sorted(set(re.findall(r'"(20[2-3]\d)-[a-z0-9-]+":\{"default"', " ".join(p["lines"]))))
        my = my[0] if len(my) == 1 else ""
        if h == "en.nissan.com.eg" and re.search(r"/(versions-and-specs|specifications)\.html$", p["final_url"]):
            for trim, f, v, u, q in nissan_specs(p):
                S.append(dict(p1_id=pid, model_year=my, trim=trim, field=f, value=v, unit=u, source_url=p["final_url"],
                              issuer=iss, retrieved_at=p["retrieved_at"], quote=q))
        if "renault.com.eg" in h and re.search(r"dimension", p["final_url"], re.I):
            for tb in p["tables"]:
                for row in tb:
                    if len(row) == 2 and row[0].lower() in RENAULT_LABELS and re.fullmatch(r"\d{2,5}", row[1]):
                        f, u = RENAULT_LABELS[row[0].lower()]
                        S.append(dict(p1_id=pid, model_year=my, trim="ALL (source table has no trim split)", field=f,
                                      value=row[1], unit=u, source_url=p["final_url"], issuer=iss,
                                      retrieved_at=p["retrieved_at"], quote=f"{row[0]}: {row[1]}"))

    seen_sha = set()
    for d in pdfs:
        if d.get("status") != 200 or not d.get("sha256"):
            continue
        rows = by_brand.get(d["brand"], [])
        segs = url_segments(d["final_url"]) + [d.get("anchor", "")]
        pid = attribute(segs, rows)
        fname = unquote(urlparse(d["final_url"]).path.rsplit("/", 1)[-1])
        if not pid and d.get("source_page") and not ("deepal" not in fname.lower() and VARIANT_RX.search(re.sub(r"\.pdf$", "", fname, flags=re.I).replace("_", "-"))):
            pid = attribute(url_segments(d["source_page"]), rows)  # file name names no other powertrain variant
        src_host = urlparse(d.get("source_page") or d["final_url"]).netloc
        text = d.get("text") or []
        if not pid and BROCHURE_RX.search(d.get("anchor", "")) and not NOT_BROCHURE_RX.search(d.get("anchor", "") + d["final_url"]):
            pid = text_attribute(text, all_by_brand, d["brand"])
            pid = pid if pid in want else None
        if not pid or src_host not in owner_ok or not egypt_market(d.get("source_page") or d["final_url"]):
            continue
        model = next(r["model"] for r in rows if r["p1_id"] == pid)
        if norm(model) not in norm(" ".join(text)) and norm(model) not in norm(" ".join(segs)):
            continue  # PDF never names the model: not attributable
        name = unquote(urlparse(d["final_url"]).path.rsplit("/", 1)[-1]) + " " + d.get("anchor", "")
        is_brochure = bool(BROCHURE_RX.search(name + " " + d["final_url"])) and not NOT_BROCHURE_RX.search(name)
        is_warranty_doc = bool(WARRANTY_DOC_RX.search(name)) and "draft" not in name.lower()
        mys = set()
        for m in MY_RX.finditer(" ".join(text[:3]) + " " + name):
            mys.add(m.group(1) or "20" + m.group(2))
        my = mys.pop() if len(mys) == 1 else ""
        iss = issuer_for(src_host, d["brand"])
        if is_brochure and "brochure" in want.get(pid, "") and (pid, d["sha256"]) not in seen_sha:
            seen_sha.add((pid, d["sha256"]))
            B.append(dict(p1_id=pid, model_year=my, url=d["final_url"], sha256=d["sha256"], bytes=d["bytes"],
                          pages=d.get("pages") or "", issuer=iss, retrieved_at=d["retrieved_at"]))
            BSRC.append(dict(p1_id=pid, sha256=d["sha256"], url=d["final_url"], source_page=d.get("source_page", ""),
                             anchor=d.get("anchor", ""), attribution="file name" if attribute(segs, rows) == pid else "source page/text"))
        if (is_brochure or is_warranty_doc) and "warranty" in want.get(pid, ""):
            kind = "warranty booklet" if is_warranty_doc else "brochure"
            for y, k, q, comp in warranty_hits("\n".join(text)):
                W.append(dict(p1_id=pid, years=y, km=k, scope=f"{kind}; " + comp, source_url=d["final_url"],
                              issuer=iss, retrieved_at=d["retrieved_at"], quote=q))
        if is_brochure and "specs" in want.get(pid, ""):
            for t in text:
                trim = None
                for line in t.split("\n"):
                    line = " ".join(line.split())
                    m = TRIM_HDR.match(ascii_only(line))
                    if m:
                        g = m.group(1).strip()
                        # one grade -> exact trim; several grades on one header line -> value printed once for all
                        trim = g if len(g.split()) == 1 else f"ALL listed grades ({g}); single value printed"
                        continue
                    if not trim:
                        continue
                    al = ascii_only(line)
                    m = LWH.search(al)
                    if m:
                        for f, v in zip(("length_mm", "width_mm", "height_mm"), m.groups()):
                            S.append(dict(p1_id=pid, model_year=my, trim=trim, field=f, value=v, unit="mm", source_url=d["final_url"],
                                          issuer=iss, retrieved_at=d["retrieved_at"], quote=al[:200]))
                        continue
                    for rx, f, u in PDF_LINE_SPECS:
                        m = rx.match(al)
                        if m:
                            v = m.group(1).strip()
                            if f == "engine":
                                f, u, v = ("engine_cc", "cc", first_num(v)) if re.search(r"ml|cc", al, re.I) or "." not in v else ("engine_l", "L", first_num(v))
                            elif f == "power":
                                f, u, v = ("power_hp", "hp", re.search(r"\((\d+)\)", v).group(1)) if re.search(r"kw\s*\(hp\)", al, re.I) and re.search(r"\((\d+)\)", v) else \
                                          (("power_ps", "PS", first_num(v)) if re.search(r"\(ps\)", al, re.I) else (None, None, None))
                            elif f == "torque":
                                f, u, v = "torque_nm", "Nm", first_num(v)
                            if f and v:
                                S.append(dict(p1_id=pid, model_year=my, trim=trim, field=f, value=v, unit=u, source_url=d["final_url"],
                                              issuer=iss, retrieved_at=d["retrieved_at"], quote=al[:200]))
                            break

    def dedup(rows, keys):
        seen, outr = set(), []
        for r in rows:
            k = tuple(r[x] for x in keys)
            if k not in seen:
                seen.add(k)
                outr.append(r)
        return outr

    # a brochure reached only from a hub page (brochures index) is dropped when the same p1_id has a brochure
    # linked from its own model page: hub pages keep superseded generations (e.g. renault 2022 Duster)
    rows_by_brand = by_brand
    def from_model_page(src):
        r = next((x for x in BSRC if x["sha256"] == src["sha256"] and x["p1_id"] == src["p1_id"]), None)
        if not r or not r["source_page"]:
            return False
        brand_rows = next((v for v in rows_by_brand.values() if any(z["p1_id"] == src["p1_id"] for z in v)), [])
        return attribute(url_segments(r["source_page"]), brand_rows) == src["p1_id"]
    has_model = {b["p1_id"] for b in B if from_model_page(b)}
    drop = {(b["p1_id"], b["sha256"]) for b in B if b["p1_id"] in has_model and not from_model_page(b)}
    B = [b for b in B if (b["p1_id"], b["sha256"]) not in drop]
    BSRC = [b for b in BSRC if (b["p1_id"], b["sha256"]) not in drop]
    files = {
        "warranty_candidates.csv": (dedup(W, ["p1_id", "years", "km", "source_url"]),
                                    ["p1_id", "years", "km", "scope", "source_url", "issuer", "retrieved_at", "quote"]),
        "brochure_candidates.csv": (dedup(B, ["p1_id", "sha256"]),
                                    ["p1_id", "model_year", "url", "sha256", "bytes", "pages", "issuer", "retrieved_at"]),
        "specs_candidates.csv": (dedup(S, ["p1_id", "model_year", "trim", "field", "source_url"]),
                                 ["p1_id", "model_year", "trim", "field", "value", "unit", "source_url", "issuer", "retrieved_at", "quote"]),
        "brochure_sources.csv": (dedup(BSRC, ["p1_id", "sha256"]), ["p1_id", "sha256", "url", "source_page", "anchor", "attribution"]),
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
