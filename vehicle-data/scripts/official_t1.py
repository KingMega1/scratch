#!/usr/bin/env python3
"""Tier-1 official Egypt OEM/distributor snapshot: fetch -> evidence -> deterministic parse. No LLM.

  official_t1.py run --config config/official_sources.json --out snapshots/official/O<n>_<date> [--pages-from <dir>]

Writes (same conventions as fetch_snapshot.py):
  fetch_manifest.json        url, source, recipe, status, http_date, bytes, sha256, file
  evidence.jsonl.gz          per page: exactly the fragments the parsers read (price JSON, grade map, spec rows)
  official_observations.csv  one row per (page, grade, field): value as stated + provenance
  exceptions.csv             pages/grades a deterministic recipe could not resolve (routed to review, never guessed)
Raw pages go to <out>/raw/ (git-ignored). Ported from the P2 factory Nissan batch B001 (2026-09-28).
Recipes: nissan_vlp_price_json, nissan_spec_table, mg_model_page.
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


RECIPES = {"nissan_vlp_price_json": nissan_vlp_price_json, "nissan_spec_table": nissan_spec_table, "mg_model_page": mg_model_page}


def run(cfg_path, out, pages_from=None, delay=1.0):
    cfg = json.load(open(cfg_path)); os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    man, evs, obs, excs = [], [], [], []
    for p in cfg["pages"]:
        src = cfg["sources"][p["source"]]
        try:
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
            obs.append(dict(r_, source=p["source"], source_tier=src["tier"], recipe=p["recipe"] + "@1",
                            universe_id=p.get("universe_id"), registry_model_id=p.get("registry_model_id"),
                            source_url=p["url"], fetched_at=date, page_sha256=h,
                            note="; ".join(x for x in (r_.get("note"), p.get("variant") and f"page variant: {p['variant']}") if x) or None))
        for kind, detail in exc:
            excs.append(dict(url=p["url"], universe_id=p.get("universe_id"), kind=kind, detail=detail))
        if p.get("universe_id") is None:
            excs.append(dict(url=p["url"], universe_id=None, kind="MISSING_MODEL", detail=p.get("note", "")))
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
    a = ap.parse_args(); run(a.config, a.out)
