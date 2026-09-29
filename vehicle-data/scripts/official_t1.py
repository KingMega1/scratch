#!/usr/bin/env python3
"""Tier-1 official Egypt OEM/distributor snapshot: fetch -> evidence -> deterministic parse. No LLM.

  official_t1.py run --config config/official_sources.json --out snapshots/official/O<n>_<date> [--pages-from <dir>]

Writes (same conventions as fetch_snapshot.py):
  fetch_manifest.json        url, source, recipe, status, http_date, bytes, sha256, file
  evidence.jsonl.gz          per page: exactly the fragments the parsers read (price JSON, grade map, spec rows)
  official_observations.csv  one row per (page, grade, field): value as stated + provenance
  exceptions.csv             pages/grades a deterministic recipe could not resolve (routed to review, never guessed)
Raw pages go to <out>/raw/ (git-ignored). Ported from the P2 factory Nissan batch B001 (2026-09-28).
Recipes: nissan_vlp_price_json, nissan_spec_table, mg_model_page (B001/O1);
gb_model_page, toyota_page_state, kia_versions, chevrolet_nav_prices, skoda_pricelist_json, jetour_model_page (B003/O2).
"""
import argparse, csv, datetime as dt, gzip, hashlib, html, json, os, re, sys, time, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "en"}
COLS = ["source", "source_tier", "recipe", "universe_id", "registry_model_id", "source_url", "fetched_at", "page_sha256",
        "model_key", "grade_key", "trim_raw", "model_year", "field", "value_raw", "value_num", "unit", "effective_date",
        "evidence_pointer", "confidence", "note"]


def num(s):
    t = re.sub(r"[^0-9.]", "", str(s or "").replace(",", ""))
    try:
        return float(t) if t else None
    except ValueError:
        return None


def pipes(page_html):
    x = re.sub(r"<script.*?</script>|<style.*?</style>", "", page_html, flags=re.S)
    x = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "|", x)))
    return [t.strip() for t in re.sub(r"(\s*\|\s*)+", "|", x).split("|") if t.strip()]


# ------------------------------------------------------------------ recipes (each returns rows, evidence, exceptions)

def nissan_vlp_price_json(page, body):
    t = body.decode("utf-8", "ignore")
    m = re.search(r'id="individualVehiclePriceJSON"[^>]*>(.*?)</', t, re.S)
    if not m:
        return [], {}, [("UNSTRUCTURED_SOURCE", "individualVehiclePriceJSON missing")]
    d = json.loads(html.unescape(m.group(1)).strip())
    key = next(iter(d)); blk = d[key]
    upd = blk.get("Updated_On")
    eff = dt.datetime.strptime(upd, "%Y.%m.%d.%H.%M.%S").strftime("%Y-%m-%d") if upd else None
    names = {}
    for g in re.findall(r'data-grade-data="([^"]*)"', t):          # variant A
        for part in g.split(","):
            if "=" in part:
                n, k = part.rsplit("=", 1)
                names.setdefault(k.strip(), n.strip())
    if not names:                                                   # variant B: grade cards in page order
        keys = re.findall(r'data-grade-id="(LVL\d+)"', t)
        L = "|".join(pipes(t)).split("DISCOVER YOUR PERFECT", 1)
        if len(L) == 2:
            labels = re.findall(r"\|([^|]{2,60})\|Starting from", "|" + L[1])
            if len(labels) == len(keys):
                names = dict(zip(keys, labels))
    ch = next(k for k in blk if k not in ("Updated_On", "modelCode"))
    rows, exc = [], []
    for gk, g in blk[ch]["grades"].items():
        nm, price = names.get(gk), g.get("gradePrice") or ""
        if not nm:
            exc.append(("GRADE_UNNAMED", f"{gk} @ {price or 'no price'}: official page publishes no grade name"))
        rows.append(dict(model_key=key, grade_key=gk, trim_raw=nm or f"UNNAMED:{gk}",
                         model_year=int(key[:4]) if re.match(r"^\d{4}-", key) else None, field="price_official_egp",
                         value_raw=price, value_num=num(price), unit="EGP", effective_date=eff,
                         evidence_pointer=f"individualVehiclePriceJSON.{key}.{ch}.grades.{gk}.gradePrice",
                         confidence="HIGH" if nm else "MEDIUM",
                         note=None if price else "grade listed without price (NOT_PUBLISHED)"))
    return rows, {"price_json": d, "grade_names": names}, exc


NISSAN_SPEC_LABELS = {"Number of Seats": ("seats", "count"), "Engine displacement": ("engine_cc", "cc"),
                      "Overall Length (mm)": ("length_mm", "mm"), "Wheelbase (mm)": ("wheelbase_mm", "mm"),
                      "Fuel Capacity (litres)": ("fuel_tank_l", "l"), "Luggage Capacity (VDA) (litres)": ("boot_l", "l"),
                      "Ground Clearance (mm)": ("ground_clearance_mm", "mm"), "Fuel Type": ("fuel_type", None),
                      "Wheels Driven": ("drive", None)}


def nissan_spec_table(page, body):
    L = pipes(body.decode("utf-8", "ignore")); rows, ev = [], {}
    for i, tok in enumerate(L[:-1]):
        if tok in NISSAN_SPEC_LABELS and tok not in ev:
            f, u = NISSAN_SPEC_LABELS[tok]; v = L[i + 1]; ev[tok] = v
            rows.append(dict(model_key=page["url"].split("/")[-2], grade_key=None, trim_raw=None, model_year=None, field=f,
                             value_raw=v, value_num=num(v) if u else None, unit=u, effective_date=None,
                             evidence_pointer=f'spec table "{tok}"', confidence="HIGH",
                             note="table shows ONE grade; grade-scoped unless confirmed model-wide"))
    return rows, {"spec_rows": ev}, ([] if rows else [("UNSTRUCTURED_SOURCE", "no label|value spec table")])


MG_SECTIONS = {"Power & Performance", "Technology", "Comfort", "Safety", "Exterior", "Interior", "Performance"}
MG_FIELDS = {"Engine": ("engine", None), "Max Power (hp)": ("power_hp", "hp"), "Max Torque (N.m)": ("torque_nm", "Nm"),
             "Transmission": ("transmission", None), "Airbags": ("airbags", "count"), "Battery Capacity (kWh)": ("battery_kwh", "kWh"),
             "Electric Range (km)": ("electric_range_km", "km"), "Drive Type": ("drive", None)}


def mg_model_page(page, body):
    L = pipes(body.decode("utf-8", "ignore")); rows, ev, exc = [], {"grade_tables": {}, "compare": {}, "finance": {}}, []
    mk = page["url"].rstrip("/").split("/")[-1]
    # 1) per-grade "Specs & Options" tables: "<Section>|-->|g1|..|gN|label|v1..vN|label|..."
    grades = None
    for i, tok in enumerate(L):   # header learned only where the grade list is followed by the "Engine" row
        if tok in MG_SECTIONS and L[i + 1:i + 2] == ["-->"]:
            k = L.index("Engine", i + 2) if "Engine" in L[i + 2:i + 12] else None
            if k and 1 <= k - (i + 2) <= 6:
                grades = L[i + 2:k]; break
    for i, tok in enumerate(L):
        if grades and tok in MG_SECTIONS and L[i + 1:i + 2] == ["-->"] and L[i + 2:i + 2 + len(grades)] == grades:
            g, n = grades, len(grades); j = i + 2 + n
            while j + n < len(L) and L[j] not in MG_SECTIONS and L[j] not in ("Compare", "-->"):
                label, vals = L[j], L[j + 1:j + 1 + n]
                ev["grade_tables"].setdefault(tok, []).append([label] + vals)
                if label in MG_FIELDS:
                    f, u = MG_FIELDS[label]
                    for gname, v in zip(g, vals):
                        rows.append(dict(model_key=mk, grade_key=gname, trim_raw=gname, model_year=None, field=f, value_raw=v,
                                         value_num=num(v.split("@")[0]) if u else None, unit=u, effective_date=None,
                                         evidence_pointer=f'Specs & Options / {tok} / "{label}" / column "{gname}"',
                                         confidence="HIGH", note=None))
                j += 1 + n
    if not grades:
        exc.append(("UNSTRUCTURED_SOURCE", "no per-grade Specs & Options table"))
    # 2) "Compare" block: dimensions for one named grade
    for i, tok in enumerate(L):
        if tok == "ADD MODEL" and i + 1 < len(L) and " - " in L[i + 1]:
            trim = L[i + 1].split(" - ", 1)[1]; k = i + 2
            while k + 1 < len(L) and L[k] not in ("-->", "ADD MODEL"):
                lab, v = L[k], L[k + 1]
                if lab == "Length/Width/Height (mm)" and re.match(r"^\d+ x \d+ x \d+$", v):
                    for f, x in zip(("length_mm", "width_mm", "height_mm"), v.split(" x ")):
                        rows.append(dict(model_key=mk, grade_key=trim, trim_raw=trim, model_year=None, field=f, value_raw=x,
                                         value_num=num(x), unit="mm", effective_date=None, confidence="HIGH", note=None,
                                         evidence_pointer=f'Compare / {L[i + 1]} / "{lab}"'))
                elif lab in ("Wheelbase (mm)", "Kerb weight (kg)", "Fuel tank capacity(L)"):
                    f = {"Wheelbase (mm)": "wheelbase_mm", "Kerb weight (kg)": "kerb_weight_kg", "Fuel tank capacity(L)": "fuel_tank_l"}[lab]
                    rows.append(dict(model_key=mk, grade_key=trim, trim_raw=trim, model_year=None, field=f, value_raw=v,
                                     value_num=num(v), unit=f.split("_")[-1], effective_date=None, confidence="HIGH", note=None,
                                     evidence_pointer=f'Compare / {L[i + 1]} / "{lab}"'))
                ev["compare"][lab] = v; k += 2
            break
    # 3) "Pricing & Finance" widget: official car price for the named Type
    for i, tok in enumerate(L):
        if tok == "Pricing & Finance":
            seg = L[i:i + 40]
            try:
                typ = seg[seg.index("Type") + 1]
                price = seg[seg.index("Car Price") + 1]
            except ValueError:
                continue
            if re.match(r"^[\d,]+ EGP$", price):
                ev["finance"] = {"type": typ, "car_price": price}
                rows.append(dict(model_key=mk, grade_key=typ, trim_raw=typ, model_year=None, field="price_official_egp",
                                 value_raw=price, value_num=num(price), unit="EGP", effective_date=None, confidence="MEDIUM",
                                 evidence_pointer='Pricing & Finance widget / "Car Price"',
                                 note="price shown by the official finance calculator for this Type; no separate price list on the site"))
            break
    return rows, ev, exc


# ------------------------------------------------------------------ B003 recipes (2026-09-29)
PRICE_TOK = re.compile(r"^(?:EGP\s*)?([\d,]{5,})(?:\.00)?\s*(?:EGP)?$")
PRICE_FLOOR_EGP = 300000        # deterministic plausibility guard for a new passenger car price in Egypt (2026)


def _hp(v):
    m = re.match(r"^\s*([\d.]+)\s*(?:hp|HP|/|$)", v or "")
    return float(m.group(1)) if m else None


GB_SPEC_LABELS = {  # label as printed -> (field, unit, parser)
    "Power (HP/ RPM)": ("power_hp", "hp", _hp), "POWER (HP/RPM)": ("power_hp", "hp", _hp),
    "Length (mm)": ("length_mm", "mm", num), "Length": ("length_mm", "mm", num),
    "Wheelbase (mm)": ("wheelbase_mm", "mm", num), "Wheelbase": ("wheelbase_mm", "mm", num),
    "Ground Clearance (mm)": ("ground_clearance_mm", "mm", num),
    "Fuel Tank Capacity (L)": ("fuel_tank_l", "l", num), "Tank Capacity (L)": ("fuel_tank_l", "l", num),
    "Engine Capacity (L)": ("engine", None, None), "Transmission": ("transmission", None, None),
    "Drivetrain": ("drive", None, None), "Capacity (kWh)": ("battery_kwh", "kWh", num)}


def gb_model_page(page, body):
    """GB Auto brand sites (Chery Egypt, Changan Egypt): banner 'Starting/Start Price' + one label|value spec table."""
    t = body.decode("utf-8", "ignore"); L = pipes(t); rows, ev, exc = [], {}, []
    mk = page["url"].rstrip("/").split("/")[-1]
    if "Page not found..." in L or "Page not found" in L:
        return [], {"not_found": True}, [("MODEL_PAGE_NOT_FOUND", "official site returns its 'Page not found' template for this model")]
    for i, tok in enumerate(L):
        if tok in ("Starting Price", "Start Price"):
            for j in (i + 1, i - 1):
                m = PRICE_TOK.match(L[j]) if 0 <= j < len(L) else None
                if m:
                    ev["banner_price"] = L[j]
                    rows.append(dict(model_key=mk, grade_key=None, trim_raw=None, model_year=None, field="price_from_official_egp",
                                     value_raw=L[j], value_num=num(m.group(1)), unit="EGP", effective_date=None, confidence="HIGH",
                                     evidence_pointer=f'model banner "{tok}"',
                                     note="model-level starting price (cheapest grade); grade not named on the page"))
                    break
            if "banner_price" in ev:
                break
    grades = None
    if "Grade" in L:
        g = L.index("Grade"); k = g + 1
        while k < len(L) and L[k] not in ("S", "-", "O") and len(L[k]) < 25:
            k += 1
        grades = L[g + 1:k]; ev["grade_header"] = grades
    for i, tok in enumerate(L[:-1]):
        if tok in GB_SPEC_LABELS and tok not in ev.setdefault("spec_rows", {}):
            f, u, parse = GB_SPEC_LABELS[tok]; v = L[i + 1]
            if f in {r["field"] for r in rows}:
                continue
            ev["spec_rows"][tok] = v
            rows.append(dict(model_key=mk, grade_key=None, trim_raw=None, model_year=None, field=f, value_raw=v,
                             value_num=parse(v) if parse else None, unit=u, effective_date=None, confidence="HIGH",
                             evidence_pointer=f'spec table "{tok}"',
                             note="spec table shows ONE unnamed configuration; grade-scoped unless confirmed model-wide"))
    if not rows:
        exc.append(("UNSTRUCTURED_SOURCE", "no banner price and no label|value spec table"))
    return rows, ev, exc


def toyota_page_state(page, body):
    """Toyota Egypt: window.__PAGE_STATE__.vehicle_model with vehicleCategories[] {name, price, erp_id}."""
    t = body.decode("utf-8", "ignore")
    m = re.search(r"window\.__PAGE_STATE__\s*=\s*", t)
    if not m:
        return [], {}, [("UNSTRUCTURED_SOURCE", "window.__PAGE_STATE__ missing")]
    vm = json.JSONDecoder().raw_decode(t[m.end():])[0].get("vehicle_model") or {}
    rows, exc = [], []
    yr = vm.get("year"); mk = vm.get("slug") or page["url"].rstrip("/").split("/")[-1]
    ev = {k: vm.get(k) for k in ("name", "slug", "year", "price_from", "horse_power", "engine_capacity", "fuel_type")}
    ev["categories"] = [{k: c.get(k) for k in ("id", "name", "previous_name", "price", "erp_id", "is_available_online")}
                        for c in vm.get("vehicleCategories") or []]
    for c in vm.get("vehicleCategories") or []:
        nm = c.get("name") or ""; trim = nm.split(" - ", 1)[1] if " - " in nm else nm
        legacy = not c.get("erp_id")
        rows.append(dict(model_key=mk, grade_key=str(c.get("id")), trim_raw=trim, model_year=yr, field="price_official_egp",
                         value_raw=str(c.get("price")), value_num=num(c.get("price")), unit="EGP", effective_date=None,
                         evidence_pointer=f"__PAGE_STATE__.vehicle_model.vehicleCategories[id={c.get('id')}].price",
                         confidence="MEDIUM" if legacy else "HIGH",
                         note="grade has no erp_id (legacy/unsold grade still published)" if legacy else None))
    hp = _hp(vm.get("horse_power"))
    if hp:
        rows.append(dict(model_key=mk, grade_key=None, trim_raw=None, model_year=yr, field="power_hp", value_raw=vm.get("horse_power"),
                         value_num=hp, unit="hp", effective_date=None, confidence="HIGH",
                         evidence_pointer="__PAGE_STATE__.vehicle_model.horse_power",
                         note="model headline figure; grade-scoped unless confirmed model-wide"))
    if not rows:
        exc.append(("UNSTRUCTURED_SOURCE", "vehicle_model has no categories"))
    return rows, ev, exc


def kia_versions(page, body):
    """Kia Egypt: ICE '<Model> Versions' block (name | stock status | 'EGP n'); EV pages 'Name (n EGP)'."""
    L = pipes(body.decode("utf-8", "ignore")); rows, ev, exc = [], {"versions": []}, []
    mk = page["url"].rstrip("/").split("/")[-1]
    vi = next((i for i, t in enumerate(L) if t.endswith(" Versions")), None)
    if vi is not None:
        names = []
        for t in L[vi + 1:]:
            if t in names:
                break
            names.append(t)
        k = vi + 1 + len(names)
        for n in names:
            try:
                a = L.index(n, k)
            except ValueError:
                continue
            seg = L[a + 1:a + 5]
            pr = next((x for x in seg if re.match(r"^EGP [\d,]+$", x)), None)
            stock = "Out of stock" if "Out of stock" in seg[:2] else None
            ev["versions"].append(dict(name=n, price=pr, stock=stock))
            rows.append(dict(model_key=mk, grade_key=n, trim_raw=n, model_year=None, field="price_official_egp",
                             value_raw=pr or "", value_num=num(pr) if pr else None, unit="EGP", effective_date=None,
                             evidence_pointer=f'"{L[vi]}" / "{n}"', confidence="HIGH",
                             note="; ".join(x for x in (stock and "site marks this version Out of stock",
                                                        None if pr else "version listed without price (NOT_PUBLISHED)") if x) or None))
            k = a + 1
    for t in L:
        m = re.match(r"^(.{1,30}?) \(([\d,]+) EGP\)$", t)
        if m and m.group(1) not in [v["name"] for v in ev["versions"]]:
            ev["versions"].append(dict(name=m.group(1), price=m.group(2)))
            rows.append(dict(model_key=mk, grade_key=m.group(1), trim_raw=m.group(1), model_year=None, field="price_official_egp",
                             value_raw=t, value_num=num(m.group(2)), unit="EGP", effective_date=None,
                             evidence_pointer=f'trim list "{t}"', confidence="HIGH", note=None))
    if not rows:
        exc.append(("UNSTRUCTURED_SOURCE", "no Versions block and no 'Name (price EGP)' list"))
    return rows, ev, exc


def chevrolet_nav_prices(page, body):
    """Chevrolet Egypt (GM Arabia eg-ar): navigation cards '<name> | من <price> ج.م.'; page['label_map'] -> universe_id."""
    L = pipes(body.decode("utf-8", "ignore")); rows, ev, exc, seen = [], {}, [], set()
    lm = page.get("label_map", {})
    for i, t in enumerate(L):
        m = re.match(r"^من ([\d,]+) ج\.م\.?$", t)
        if not m or i == 0:
            continue
        lab = L[i - 1]
        if lab in seen:
            continue
        seen.add(lab); ev[lab] = t
        if lab not in lm:
            continue      # commercial vehicles (trucks/vans) are out of the passenger universe
        rows.append(dict(model_key=lab, grade_key=None, trim_raw=None, model_year=None, field="price_from_official_egp",
                         value_raw=t, value_num=num(m.group(1)), unit="EGP", effective_date=None, confidence="HIGH",
                         evidence_pointer=f'nav card "{lab}"', universe_id=lm[lab],
                         note="model-level 'from' price (cheapest version); versions not named"))
    for lab, uid in lm.items():
        if lab not in seen:
            exc.append(("MODEL_NOT_LISTED", f"nav has no price card for '{lab}' ({uid})"))
    return rows, ev, exc


def skoda_pricelist_json(page, body):
    """Skoda Egypt price list module: "engines":[{"equipmentPrices":{"<equipment>":{"priceFrom":"n"}}}]."""
    t = html.unescape(body.decode("utf-8", "ignore")); rows, exc = [], []
    m = re.search(r'"engines":(\[)', t)
    if not m:
        return [], {}, [("UNSTRUCTURED_SOURCE", "price list module JSON missing")]
    engines = json.JSONDecoder().raw_decode(t[m.start(1):])[0]
    mk = page["url"].rstrip("/").split("/")[-2]
    for e in engines:
        for eq, p in sorted((e.get("equipmentPrices") or {}).items()):
            rows.append(dict(model_key=mk, grade_key=eq, trim_raw=eq, model_year=None, field="price_official_egp",
                             value_raw=p.get("priceFrom"), value_num=num(p.get("priceFrom")), unit="EGP", effective_date=None,
                             evidence_pointer=f'price list JSON engines[fuel={e.get("fuelTypeKind")}].equipmentPrices."{eq}".priceFrom',
                             confidence="HIGH", note=None))
    return rows, {"engines": engines}, exc


def jetour_model_page(page, body):
    """Jetour Egypt: engine cards '<title> | Engine | .. | Max power (hp) | n hp' + optional grade price list
    'Comes in N Grades' -> '<grade> | n EGP'. The nav 'Starting Price' tile is not attributable and is ignored."""
    L = pipes(body.decode("utf-8", "ignore")); rows, ev, exc = [], {"engines": [], "grades": []}, []
    mk = page["url"].rstrip("/").split("/")[-1]
    for i, t in enumerate(L):
        if t == "Max power (hp)" and i + 1 < len(L):
            title = next((L[j] for j in range(i - 1, max(0, i - 6), -1) if L[j].lower().startswith("jetour ")), None)
            ev["engines"].append([title, L[i + 1]])
            rows.append(dict(model_key=mk, grade_key=title, trim_raw=title, model_year=None, field="power_hp", value_raw=L[i + 1],
                             value_num=_hp(L[i + 1]), unit="hp", effective_date=None, confidence="HIGH",
                             evidence_pointer=f'engine card "{title}" / "Max power (hp)"', note=None))
    gi = next((i for i, t in enumerate(L) if re.match(r"^Comes in \d+ Grades", t)), None)
    if gi is not None:
        for i in range(gi + 1, len(L) - 1):
            m = re.match(r"^([\d,]+) EGP$", L[i + 1])
            if m and not L[i].startswith("Starting Price"):
                ev["grades"].append([L[i], L[i + 1]])
                rows.append(dict(model_key=mk, grade_key=L[i], trim_raw=L[i], model_year=None, field="price_official_egp",
                                 value_raw=L[i + 1], value_num=num(m.group(1)), unit="EGP", effective_date=None, confidence="HIGH",
                                 evidence_pointer=f'"{L[gi]}" / "{L[i]}"', note=None))
    if not rows:
        exc.append(("UNSTRUCTURED_SOURCE", "no engine cards and no grade price list"))
    return rows, ev, exc


RECIPES = {"nissan_vlp_price_json": nissan_vlp_price_json, "nissan_spec_table": nissan_spec_table, "mg_model_page": mg_model_page,
           "gb_model_page": gb_model_page, "toyota_page_state": toyota_page_state, "kia_versions": kia_versions,
           "chevrolet_nav_prices": chevrolet_nav_prices, "skoda_pricelist_json": skoda_pricelist_json,
           "jetour_model_page": jetour_model_page}


def run(cfg_path, out, pages_from=None, delay=1.0):
    cfg = json.load(open(cfg_path)); os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    man, evs, obs, excs = [], [], [], []
    for p in cfg["pages"]:
        src = cfg["sources"][p["source"]]
        try:
            if pages_from:   # replay: re-parse the raw bytes an earlier snapshot captured (no network)
                pm = next(m for m in json.load(open(os.path.join(pages_from, "fetch_manifest.json")))
                          if m["url"] == p["url"] and m.get("file"))
                body, status, date = gzip.decompress(open(os.path.join(pages_from, "raw", pm["file"]), "rb").read()), 200, pm["http_date"]
            else:
                req = urllib.request.Request(p["url"], headers=UA)
                with urllib.request.urlopen(req, timeout=60) as r:
                    body, status, date = r.read(), r.status, r.headers.get("date")
        except Exception as e:  # recorded, never silently dropped
            man.append(dict(url=p["url"], source=p["source"], recipe=p["recipe"], error=str(e)))
            excs.append(dict(url=p["url"], universe_id=p.get("universe_id"), kind="SOURCE_HEALTH", detail=str(e)[:200]))
            continue
        h = hashlib.sha256(body).hexdigest(); fn = h[:16] + ".html.gz"
        open(os.path.join(out, "raw", fn), "wb").write(gzip.compress(body))
        man.append(dict(url=p["url"], source=p["source"], recipe=p["recipe"], status=status, http_date=date,
                        bytes=len(body), sha256=h, file=fn))
        rows, ev, exc = RECIPES[p["recipe"]](p, body)
        evs.append(dict(url=p["url"], sha256=h, http_date=date, recipe=p["recipe"], fragments=ev))
        for r_ in rows:
            if r_["field"].startswith("price") and r_.get("value_num") and r_["value_num"] < PRICE_FLOOR_EGP:
                r_["confidence"] = "LOW"
                r_["note"] = "; ".join(x for x in (r_.get("note"), f"IMPLAUSIBLE: below EGP {PRICE_FLOOR_EGP:,} floor, likely placeholder/stale") if x)
                exc.append(("IMPLAUSIBLE_VALUE", f'{r_.get("trim_raw") or r_["model_key"]}: {r_["value_raw"]}'))
            obs.append(dict(r_, source=p["source"], source_tier=src["tier"], recipe=p["recipe"] + "@1",
                            universe_id=r_.get("universe_id") or p.get("universe_id"), registry_model_id=p.get("registry_model_id"),
                            source_url=p["url"], fetched_at=date, page_sha256=h,
                            note="; ".join(x for x in (r_.get("note"), p.get("variant") and f"page variant: {p['variant']}") if x) or None))
        for kind, detail in exc:
            excs.append(dict(url=p["url"], universe_id=p.get("universe_id"), kind=kind, detail=detail))
        if p.get("universe_id") is None and not p.get("label_map"):
            excs.append(dict(url=p["url"], universe_id=None, kind="MISSING_MODEL", detail=p.get("note", "")))
        if not pages_from:
            time.sleep(delay)
    json.dump(man, open(os.path.join(out, "fetch_manifest.json"), "w"), indent=1)
    with gzip.open(os.path.join(out, "evidence.jsonl.gz"), "wt", encoding="utf-8") as f:
        for e in evs:
            f.write(json.dumps(e, sort_keys=True, ensure_ascii=False) + "\n")
    with open(os.path.join(out, "official_observations.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader()
        for o in obs:
            w.writerow({k: o.get(k) for k in COLS})
    with open(os.path.join(out, "exceptions.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["url", "universe_id", "kind", "detail"]); w.writeheader(); w.writerows(excs)
    rep = dict(snapshot=out, pages=len(cfg["pages"]), pages_ok=sum(1 for m in man if m.get("status") == 200),
               observations=len(obs), exceptions=len(excs), llm_calls=0,
               by_source={s: sum(1 for o in obs if o["source"] == s) for s in cfg["sources"]})
    json.dump(rep, open(os.path.join(out, "run_report.json"), "w"), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["run"])
    ap.add_argument("--config", default="config/official_sources.json"); ap.add_argument("--out", required=True)
    ap.add_argument("--pages-from", help="replay raw pages of an earlier snapshot (determinism check, no network)")
    a = ap.parse_args(); run(a.config, a.out, a.pages_from)
