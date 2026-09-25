#!/usr/bin/env python3
"""Adapt P2's canonical buyer view (carindex.p1.buyer_view/v1) into the shape the P1 app reads.

This is a pass-through: every price, status, source and registration figure comes from P2 unchanged.
The only derivations are (a) picking the best display label for a trim, (b) reading a trim's powertrain
from its own label, (c) parsing warranty years, (d) the min/max of a trim's own observations when P2
gives a range or conflict instead of a single value. Nothing is imputed.

Inputs  (P2 branch claude/carindex-buyer-vehicle-data-97yinp, vehicle-data/):
  views/p1_suv_2m.json, review/review_queue.csv
Usage:  python3 adapt_p2.py <p1_suv_2m.json> <review_queue.csv>
Writes: p2_view.v1.js (window.CI_UNIVERSE) and p2_view.v1.json next to this script.
"""
import csv, hashlib, json, os, re, sys

ADAPTER_VERSION = "A1-2026-09-25"

HYBRID_RE = re.compile(r"hybrid|\bhev\b|e-?power|e-pwr|dm-?i|i-dm|\bdm\b|phev|reev|erev", re.I)
PLUGIN_RE = re.compile(r"dm-?i|i-dm|\bdm\b|phev|plug-in|reev|erev", re.I)
EV_RE = re.compile(r"\b(ev|bev|electric)\b", re.I)

FUEL_TO_GROUP = {"Gas": "petrol", "Electric": "ev", "Plug-in Hybrid": "hybrid"}
REG_TO_GROUP = {"ICE": "petrol", "Hybrid": "hybrid", "BEV": "ev", "REEV": "hybrid", "PHEV": "hybrid"}


def label_group(label):
    if HYBRID_RE.search(label):
        return "hybrid", bool(PLUGIN_RE.search(label))
    if EV_RE.search(label):
        return "ev", False
    return None, False


def fuel_group(v):
    if v in FUEL_TO_GROUP:
        return FUEL_TO_GROUP[v]
    return "hybrid" if "hybrid" in v.lower() or "e-power" in v.lower() else None


def best_label(labels):
    clean = [re.sub(r"^A/T\s*/\s*", "", l).strip() for l in labels]
    clean = [c for c in clean if c] or labels
    clean = [c.rstrip(":;, ") for c in clean]
    return min(clean, key=lambda s: (s.lower() in ("other trims",), -len(s) if len(s) < 30 else len(s)))


def warranty_years(s):
    m = re.search(r"(\d+)\s*(?:yr|year)", s, re.I)
    return int(m.group(1)) if m else None


def spec(attrs, key):
    a = attrs.get(key, {})
    if a.get("status") in (None, "MISSING"):
        return None
    return {"status": a["status"], "values": [{"value": v["value"], "sources": v["sources"]} for v in a.get("values", [])]}


def main(view_path, queue_path):
    raw = open(view_path, "rb").read()
    view = json.loads(raw)
    assert view["schema"] == "carindex.p1.buyer_view/v1", view["schema"]
    pending = {}
    for r in csv.DictReader(open(queue_path, encoding="utf-8")):
        pending.setdefault(r["model_id"], []).append({"type": r["item_type"], "status": r["status"], "detail": r["detail"]})

    models, out_of_slice = [], []
    for m in view["models"]:
        if not m["in_slice"]:
            out_of_slice.append(f"{m['brand']} {m['model']}")
            continue
        attrs = m["specs"]["attributes"]
        groups = set()
        for v in (spec(attrs, "fuel_type_raw") or {"values": []})["values"]:
            g = fuel_group(v["value"])
            if g:
                groups.add(g)
        reg = m["registration"]
        for k in (reg.get("powertrain_mix_in_window") or {}):
            if REG_TO_GROUP.get(k):
                groups.add(REG_TO_GROUP[k])

        cohort = next(c for c in m["price"]["cohorts"] if c["model_year"] == m["price"]["latest_priced_cohort"])
        trims, unpriced = [], 0
        for t in cohort["trims"]:
            o = t["official"]
            obs = [x for x in o.get("observations", []) if x.get("value_status") == "OK" and isinstance(x.get("value"), (int, float))]
            vals = sorted({x["value"] for x in obs})
            if o.get("value") is None and not vals:
                unpriced += 1
                continue
            label = best_label(t["labels"])
            g, plugin = label_group(" ".join(t["labels"]))
            basis = "label"
            if g is None:
                g, basis = (next(iter(groups)), "model") if len(groups) == 1 else (None, "unstated")
            changes = [
                {"source": h["source"], "from": h["s0"].get("value"), "to": h["s1"].get("value")}
                for h in t.get("history", []) if h["price_type"] == "official" and h["change"] == "CHANGED"
            ]
            trims.append({
                "key": t["trim_key"], "label": label, "labels": t["labels"],
                "status": o["status"], "confidence": o.get("confidence"),
                "value": o.get("value"), "min": vals[0] if vals else o.get("value"), "max": vals[-1] if vals else o.get("value"),
                "sources": o.get("sources", []),
                "observed_at": max((x["observed_at"] for x in obs), default=None),
                "urls": sorted({x["url"] for x in obs if x.get("url")}),
                "powertrain": g, "plugin": plugin, "powertrain_basis": basis,
                "changes": changes,
            })
        trims.sort(key=lambda t: t["max"])
        wy = [warranty_years(v["value"]) for v in (spec(attrs, "warranty") or {"values": []})["values"]]
        wy = [y for y in wy if y]
        monthly = reg.get("monthly") or {}
        win = reg.get("window") or {}
        last12 = sorted((k, v) for k, v in monthly.items() if win.get("start", "") <= k <= win.get("end", "9999"))
        models.append({
            "id": m["model_id"], "slug": m["slug"], "brand": m["brand"], "model": m["model"], "id_status": m["id_status"],
            "model_year": m["price"]["latest_priced_cohort"],
            "price_from": m["price"]["price_from"],
            "trims": trims, "unpriced_trims": unpriced,
            "powertrains": sorted(groups),
            "specs": {k: spec(attrs, k) for k in ("seats", "transmission", "engine_capacity", "horsepower", "drive_type",
                                                  "fuel_type_raw", "warranty", "length", "trunk_capacity",
                                                  "fuel_consumption", "electric_range", "battery_capacity")},
            "warranty_years_max": max(wy) if wy else None,
            "registration": {
                "count": reg.get("registrations_in_window"), "rank": reg.get("rank_in_slice"), "of": reg.get("slice_models_ranked"),
                "share": reg.get("share_of_slice_registrations"),
                "yoy": (reg.get("momentum") or {}).get("yoy_change"),
                "first_seen": reg.get("first_seen_month"),
                "mix": reg.get("powertrain_mix_in_window"),
                "last12": last12,
                "window": reg.get("window"),
                "unit": reg.get("unit"),
                "alias_pending_review": any(p["type"] == "REGISTRATION_ALIAS" for p in pending.get(m["model_id"], [])),
            },
            "freshness": m["freshness"],
            "conflicts": m["conflicts"],
            "gaps": [g["type"] for g in m["gaps"]],
            "review_open": pending.get(m["model_id"], []),
        })

    out = {
        "meta": {
            "source_schema": view["schema"], "slice": view["slice"], "generated_as_of": view["generated_as_of"],
            "universe_rule": view["universe_rule"], "snapshots": view["price_history"]["snapshots"],
            "p2_view_sha256": hashlib.sha256(raw).hexdigest(), "p2_inputs": view["inputs"],
            "adapter": f"buyer-decision/data/adapt_p2.py {ADAPTER_VERSION}",
            "models_in_slice": len(models), "out_of_slice_known": out_of_slice,
            "budget_anchor_egp": 2_000_000, "band": view["universe_rule"]["price_band_egp"],
            "not_in_data": ["reliability", "running cost", "resale value", "safety rating"],
        },
        "models": models,
    }
    here = os.path.dirname(os.path.abspath(__file__))
    js = json.dumps(out, ensure_ascii=False, indent=1)
    open(os.path.join(here, "p2_view.v1.json"), "w", encoding="utf-8").write(js + "\n")
    open(os.path.join(here, "p2_view.v1.js"), "w", encoding="utf-8").write("window.CI_UNIVERSE = " + js + ";\n")
    print(f"{len(models)} models in slice; out of slice: {out_of_slice}")
    for x in models:
        print(f"{x['slug']:24} {','.join(x['powertrains']):16} " + " | ".join(
            f"{t['label']}={t['max']:,}{'' if t['min'] == t['max'] else '(' + format(t['min'], ',') + ')'}[{t['status'][:4]}:{t['powertrain'] or '?'}{'/'+t['powertrain_basis'][0]}]" for t in x["trims"]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
