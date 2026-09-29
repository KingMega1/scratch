#!/usr/bin/env python3
"""Reconcile Tier-1 official observations against P1's current universe, under the CEO promotion policy (2026-09-28):

  AUTO_PROMOTE  = verified Tier-1 official Egypt source + confident exact identity + deterministic validation
                  + no unresolved conflict
  CEO_REVIEW    = any material discrepancy affecting price, specification, model year, availability or
                  recommendation (surfaced, never silently chosen)
  REVIEW        = identity/label questions a deterministic rule cannot settle (trim naming, page variants)

  reconcile_official.py --official snapshots/official/O1_<date> --universe <p1 view.js|json> --out review/

Writes review/official_reconciliation.csv (every comparison) and review/promotions_official.csv (the AUTO_PROMOTE
set as an applicable patch against universe_version). Applying the patch is a separate, governed step; this
script changes no canonical file. Deterministic: same inputs, same outputs.
"""
import argparse, csv, json, os, re

MATERIAL_EGP = 5000          # same threshold vehicle-data uses for NEAR_AGREEMENT
TRIM_STOP = {"cvt", "at", "mt", "a", "t", "automatic", "manual", "2wd", "4x2", "v6", "v6tt", "e-power", "epower",
             "fwd", "sunny", "magnite", "qashqai", "juke", "sentra", "patrol", "x-trail", "xtrail", "nissan",
             "saloon", "salon", "toyota", "fortuner", "bz4x", "corolla", "kia", "chery", "jetour", "changan"}
TRIM_SYN = {"baseline": "base", "midline": "mid", "n": "", "t1": "1", "t2": "2", "le1": "le 1", "le2": "le 2", "hl": "highline", "tl": "topline"}


def trim_key(label):
    if not label:
        return None
    s = label.lower().replace("+", " plus ").replace("/", " ").replace("e-4orce", " 4wd ")
    s = re.sub(r"\b\d\.\d\s*[lt]\b", " ", s)
    out = []
    for t in re.findall(r"[a-z0-9]+", s):
        for u in TRIM_SYN.get(t, t).split():
            if u and u not in TRIM_STOP:
                out.append(u)
    return " ".join(out) or None


def trans_of(label):
    s = (label or "").lower()
    if re.search(r"\bmt\b|manual", s): return "MT"
    if re.search(r"\bat\b|a/t|automatic|cvt", s): return "AT"
    return None


def compat(a, b):
    return trim_key(a) == trim_key(b) and (trans_of(a) is None or trans_of(b) is None or trans_of(a) == trans_of(b))


def load_universe(p):
    s = open(p, encoding="utf-8").read()
    s = re.sub(r"^\s*window\.CI_UNIVERSE\s*=\s*", "", s).rstrip().rstrip(";")
    return json.loads(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--official", required=True); ap.add_argument("--universe", required=True)
    ap.add_argument("--out", default="review")
    a = ap.parse_args()
    U = load_universe(a.universe); uv = U["meta"]["version"]; M = {m["id"]: m for m in U["models"]}
    obs = list(csv.DictReader(open(os.path.join(a.official, "official_observations.csv"), encoding="utf-8")))
    rec = []

    def add(uid, field, trim, official, current, cls, reason, obs_rows, patch=None):
        rec.append(dict(universe_version=uv, universe_id=uid, field=field, trim=trim, official_value=official,
                        current_value=current, decision=cls, reason=reason, patch=json.dumps(patch) if patch else "",
                        evidence=";".join(f'{o["source_url"]}#{o["evidence_pointer"]}@{o["page_sha256"][:12]}' for o in obs_rows)))

    by_model = {}
    for o in obs:
        if o["universe_id"]:
            by_model.setdefault(o["universe_id"], []).append(o)
    for uid, rows in sorted(by_model.items()):
        m = M.get(uid)
        if m is None:
            add(uid, "model", None, None, None, "CEO_REVIEW", "official model page maps to an id absent from the universe", rows[:1]); continue
        if not m.get("u"):
            add(uid, "availability", None, "listed on official site", "u=false (out of universe)", "CEO_REVIEW",
                "official Egypt site lists the model but P1 universe excludes it", rows[:1])
        # ---- prices (per grade)
        prices = [o for o in rows if o["field"] == "price_official_egp"]
        cur = m["trims"]; matched = set()
        for o in prices:
            v = float(o["value_num"]) if o["value_num"] else None
            hits = [t for t in cur if compat(o["trim_raw"], t["label"])]
            matched.update(t["label"] for t in hits)
            if v is None:
                add(uid, "price", o["trim_raw"], "not published", [(t["label"], t["min"]) for t in hits] or None, "CEO_REVIEW",
                    "official site lists the grade without a price: current value has no official backing", [o]); continue
            if not hits:
                same = [t["label"] for t in cur if t["min"] == v]
                add(uid, "price", o["trim_raw"], v, None, "REVIEW",
                    f"official grade has no trim match in universe (same-price labels: {same}); label reconciliation", [o]); continue
            for t in hits:
                d = abs(t["min"] - v)
                if d == 0:
                    cls = "AUTO_PROMOTE" if o["confidence"] == "HIGH" else "REVIEW"
                    add(uid, "price", t["label"], v, t["min"], cls,
                        "exact match: upgrade provenance to official" if cls == "AUTO_PROMOTE" else "exact match but source confidence MEDIUM",
                        [o], dict(op="set_official", trim=t["label"], official=True, date=o["effective_date"] or o["fetched_at"],
                                  source=o["source_url"]) if cls == "AUTO_PROMOTE" else None)
                elif d <= MATERIAL_EGP and o["confidence"] == "HIGH":
                    add(uid, "price", t["label"], v, t["min"], "AUTO_PROMOTE",
                        f"non-material difference EGP {d:,.0f} (<= {MATERIAL_EGP:,}): tier rule takes the official value", [o],
                        dict(op="set_price", trim=t["label"], min=v, official=True, date=o["effective_date"] or o["fetched_at"], source=o["source_url"]))
                else:
                    why = (f"material price discrepancy EGP {d:,.0f}" if d > MATERIAL_EGP
                           else f"EGP {d:,.0f} difference but official value confidence {o['confidence']} ({o['note']})")
                    if o["confidence"] == "LOW":
                        why += f" [{o['note']}]"
                    add(uid, "price", t["label"], v, t["min"], "CEO_REVIEW", why, [o])
        if prices and not any(o["field"] == "price_from_official_egp" for o in rows):
            for t in cur:
                if t["label"] not in matched:
                    add(uid, "availability", t["label"], "absent from official site", t["min"], "CEO_REVIEW",
                        "universe trim not listed by the official source (stale, dealer-only, renamed or duplicate label)", [])
        # ---- model-level "from" price (banner/nav: cheapest version, grade not named) -- B003
        for o in [o for o in rows if o["field"] == "price_from_official_egp"]:
            v = float(o["value_num"]); lo = min(t["min"] for t in cur) if cur else None
            cheapest = [t["label"] for t in cur if t["min"] == lo]
            if lo is None:
                add(uid, "price_from", None, v, None, "CEO_REVIEW", "official from-price for a model with no priced trim in universe", [o])
            elif v == lo and o["confidence"] == "HIGH":
                if len(cheapest) == 1:
                    add(uid, "price_from", cheapest[0], v, lo, "AUTO_PROMOTE", "official from-price equals the single cheapest universe trim: attach official provenance",
                        [o], dict(op="set_official", trim=cheapest[0], official=True, date=o["effective_date"] or o["fetched_at"], source=o["source_url"]))
                else:
                    add(uid, "price_from", ";".join(cheapest), v, lo, "REVIEW", "from-price matches, but several universe labels share the minimum (duplicate labels?)", [o])
            elif abs(v - lo) <= MATERIAL_EGP and o["confidence"] == "HIGH":
                add(uid, "price_from", ";".join(cheapest), v, lo, "REVIEW",
                    f"non-material from-price difference EGP {abs(v - lo):,.0f}; grade not named, so no trim-level patch", [o])
            else:
                add(uid, "price_from", ";".join(cheapest), v, lo, "CEO_REVIEW",
                    f"material from-price discrepancy EGP {abs(v - lo):,.0f}" + (f" [{o['note']}]" if o["confidence"] == "LOW" else ""), [o])
        # ---- model year stated by the official source
        yrs = {int(o["model_year"]) for o in prices if o["model_year"]}
        cy = {t["year"] for t in cur}
        if yrs and yrs != cy:
            add(uid, "model_year", None, sorted(yrs), sorted(cy), "CEO_REVIEW", "official model year differs from universe", prices[:1])
        # ---- specs held at model level in the universe
        for field, key in (("power_hp", "hp"), ("seats", "seats")):
            fo = [o for o in rows if o["field"] == field and o["value_num"]]
            if not fo:
                continue
            vals = sorted({int(float(o["value_num"])) for o in fo})
            curv = sorted(m.get(key) or [])
            scoped = any("grade-scoped" in (o["note"] or "") for o in fo)
            if not curv:
                if field == "seats":   # Find My Car hard constraint: never filled automatically
                    cls, why = "REVIEW", "seats is a hard-constraint field; official evidence is grade-scoped, confirm across all versions"
                elif scoped:
                    cls, why = "REVIEW", "official evidence covers one grade only; cannot fill a model-level field"
                elif len(vals) == 1:
                    cls, why = "AUTO_PROMOTE", "field empty in universe; single consistent official value across all published grades"
                else:
                    cls, why = "REVIEW", "field empty in universe; official values differ by grade/page variant"
                add(uid, field, None, vals, None, cls, why, fo, dict(op="set_field", field=key, value=vals) if cls == "AUTO_PROMOTE" else None)
            elif set(vals) == set(curv):
                add(uid, field, None, vals, curv, "AUTO_PROMOTE", "exact match: attach official provenance", fo,
                    dict(op="attach_provenance", field=key, value=vals, source=fo[0]["source_url"]))
            elif scoped and set(vals) < set(curv):
                add(uid, field, None, vals, curv, "REVIEW", "official table covers one configuration; its value is a consistent subset of the universe values", fo)
            elif set(curv) <= set(vals) or set(vals) <= set(curv):
                add(uid, field, None, vals, curv, "CEO_REVIEW", "partial overlap between official and universe values (grade coverage differs)", fo)
            else:
                add(uid, field, None, vals, curv, "CEO_REVIEW", "specification discrepancy", fo)

    # pages that exist but were not parsed (timeout/404/unstructured) are a source-health question, not evidence of
    # absence; only the site's own 'Page not found' template is availability evidence (B003)
    xp = os.path.join(a.official, "exceptions.csv")
    X = list(csv.DictReader(open(xp, encoding="utf-8"))) if os.path.exists(xp) else []
    unparsed = {}
    for x in X:
        if x["universe_id"] and x["universe_id"] not in by_model:
            unparsed.setdefault(x["universe_id"], []).append(x)
    for uid, xs in sorted(unparsed.items()):
        kinds = sorted({x["kind"] for x in xs})
        if "MODEL_PAGE_NOT_FOUND" in kinds:
            add(uid, "availability", None, "official model page returns 'Page not found'", "in universe", "CEO_REVIEW",
                "official site no longer publishes this model (discontinued, renamed or moved to another importer?)", [])
        else:
            add(uid, "source_health", None, None, None, "REVIEW", f"official page configured but not parsed ({', '.join(kinds)}); no conclusion drawn", [])
    # lineup coverage: in-universe models of a covered brand that no official page lists
    brands = {uid.split("/")[0] for uid in by_model}
    for m in U["models"]:
        if m.get("u") and m["id"].split("/")[0] in brands and m["id"] not in by_model and m["id"] not in unparsed:
            add(m["id"], "availability", None, "not listed on official site", f'in universe; reg last12={(m.get("reg") or {}).get("last12")}',
                "CEO_REVIEW", "brand lineup fetched from the official site does not include this model (discontinued? other importer?)", [])
    # an open model-year discrepancy is an unresolved conflict for every price of that model
    blocked = {r["universe_id"] for r in rec if r["field"] == "model_year" and r["decision"] == "CEO_REVIEW"}
    for r in rec:
        if r["universe_id"] in blocked and r["field"] == "price" and r["decision"] == "AUTO_PROMOTE":
            r.update(decision="REVIEW", patch="", reason=r["reason"] + " | BLOCKED: open model-year discrepancy on this model")
    os.makedirs(a.out, exist_ok=True)
    cols = ["universe_version", "universe_id", "field", "trim", "official_value", "current_value", "decision", "reason", "patch", "evidence"]
    with open(os.path.join(a.out, "official_reconciliation.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rec)
    with open(os.path.join(a.out, "promotions_official.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(r for r in rec if r["decision"] == "AUTO_PROMOTE")
    s = {}
    for r in rec:
        s.setdefault(r["universe_id"].split("/")[0], {}).setdefault(r["decision"], 0)
        s[r["universe_id"].split("/")[0]][r["decision"]] += 1
    print(json.dumps(dict(universe_version=uv, comparisons=len(rec), by_brand=s), indent=1))


if __name__ == "__main__":
    main()
