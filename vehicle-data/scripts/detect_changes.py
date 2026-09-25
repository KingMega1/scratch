#!/usr/bin/env python3
"""Change detection between two dated snapshots (pure function of the two snapshot folders).

  detect_changes.py --prev snapshots/S1_... --cur snapshots/S2_... [--out events/change_events.csv]

Emits (Living Data Architecture §4): PRICE_CHANGE, PRICE_STATUS_CHANGE, NEW_TRIM, TRIM_MISSING,
SPEC_CHANGE, SPEC_ADDED, SPEC_DROPPED, SOURCE_HEALTH. Thresholds are the architecture's placeholders
(D6 source health +/-20%, D7 materiality >=1% or >=EGP 10,000, implausible >25%) until decided.
event_id is a hash of the event content, so re-running on the same snapshots never duplicates.
Series are per source page, never merged across sources; a TRIM_MISSING is only emitted when the page
itself is healthy (fetched, and row count within tolerance), otherwise SOURCE_HEALTH is emitted.
"""
import argparse, csv, hashlib, importlib.util, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("b", os.path.join(HERE, "build_p1.py"))
b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b)
b.load_registry()  # loads trim synonyms into b.SYN

HEALTH_TOL, MAT_PCT, MAT_EGP, IMPLAUSIBLE = 0.20, 0.01, 10000, 0.25


def rows_of(snap):
    p = os.path.join(snap, "observations_parsed.csv")
    rows = b.read_csv(p) if os.path.exists(p) else []
    cp = os.path.join(snap, "contactcars_pricetable_cells.csv")
    cells = {(c["source_url"], c["row_label"]): c for c in b.read_csv(cp)} if os.path.exists(cp) else {}
    out = {}
    for r in rows:
        off, mkt = r["official_price"], r["market_price"]
        if "pricetable" in r["source"]:
            c = cells.get((r["source_url"], f'{r["title_prefix"]} {r["model_year"]} {r["trim_raw"]}'.strip()))
            off, mkt = (c["official_cell"], c["market_cell"]) if c else ("", "")
        k = (r["source_url"], r["model_year"] or "", r["title_prefix"] or "", b.trim_key(r["trim_raw"]))
        for pt, raw in (("official", off), ("market", mkt)):
            v, st = b.parse_price(raw)
            out.setdefault(k + (pt,), []).append(dict(value=v, status=st, label=r["trim_raw"], fetched_at=r["fetched_at"]))
    return out


def pages_of(snap):
    per = defaultdict(int)
    p = os.path.join(snap, "observations_parsed.csv")
    for r in (b.read_csv(p) if os.path.exists(p) else []):
        per[r["source_url"]] += 1
    return per


def specs_of(snap):
    p = os.path.join(snap, "specs_parsed.csv")
    out = {}
    for r in (b.read_csv(p) if os.path.exists(p) else []):
        out[(r["trim_url"], r["spec_id"])] = r
    return out


def eid(*parts):
    return hashlib.sha256("|".join(str(x) for x in parts).encode()).hexdigest()[:16]


def detect(prev, cur):
    P, C = rows_of(prev), rows_of(cur)
    pp, cp = pages_of(prev), pages_of(cur)
    ps, cs = os.path.basename(prev.rstrip("/")), os.path.basename(cur.rstrip("/"))
    ev = []
    healthy = {}
    for url in set(pp) | set(cp):
        n0, n1 = pp.get(url, 0), cp.get(url, 0)
        ok = n1 > 0 and (n0 == 0 or abs(n1 - n0) / n0 <= HEALTH_TOL)
        healthy[url] = ok
        if not ok:
            ev.append(dict(event="SOURCE_HEALTH", url=url, detail=f"rows {n0} -> {n1}", confidence="HIGH"))
    for k in sorted(set(P) | set(C)):
        url, yr, tp, tk, pt = k
        a, c = P.get(k), C.get(k)
        base = dict(url=url, model_year=yr, trim_key=tk, price_type=pt)
        if a and c:
            av = sorted({x["value"] for x in a if x["value"] is not None})
            cv = sorted({x["value"] for x in c if x["value"] is not None})
            if len(av) > 1 or len(cv) > 1:
                ev.append(dict(base, event="REVIEW_DUPLICATE_ROWS", old=av, new=cv, confidence="LOW"))
            elif av and cv and av != cv:
                d = cv[0] - av[0]
                pct = d / av[0]
                conf = "LOW" if abs(pct) > IMPLAUSIBLE else "MEDIUM"  # single-source series; HIGH needs a 2nd source (build view)
                material = abs(pct) >= MAT_PCT or abs(d) >= MAT_EGP
                ev.append(dict(base, event="PRICE_CHANGE", old=av[0], new=cv[0], delta_egp=d, delta_pct=round(pct, 4),
                               material=material, confidence=conf, label=c[0]["label"]))
            elif bool(av) != bool(cv):
                ev.append(dict(base, event="PRICE_STATUS_CHANGE", old=av or a[0]["status"], new=cv or c[0]["status"], confidence="MEDIUM"))
        elif c and pt == "official":
            ev.append(dict(base, event="NEW_TRIM", new=[x["value"] for x in c], label=c[0]["label"], confidence="MEDIUM"))
        elif a and pt == "official":
            if healthy.get(url):
                ev.append(dict(base, event="TRIM_MISSING", old=[x["value"] for x in a], label=a[0]["label"], confidence="MEDIUM",
                               detail="missing in one healthy run; DISCONTINUED needs k consecutive misses + review (D6)"))
    S0, S1 = specs_of(prev), specs_of(cur)
    if S0 and S1:
        seen_urls = {u for u, _ in S1}
        for k in sorted(set(S0) | set(S1)):
            a, c = S0.get(k), S1.get(k)
            if k[0] not in seen_urls:
                continue  # trim page not fetched this run -> no spec events for it
            if a and c and a["value"] != c["value"]:
                ev.append(dict(event="SPEC_CHANGE", url=k[0], spec_id=k[1], label=c["spec_label"], old=a["value"], new=c["value"], confidence="MEDIUM"))
            elif c and not a:
                ev.append(dict(event="SPEC_ADDED", url=k[0], spec_id=k[1], label=c["spec_label"], new=c["value"], confidence="LOW"))
            elif a and not c:
                ev.append(dict(event="SPEC_DROPPED", url=k[0], spec_id=k[1], label=a["spec_label"], old=a["value"], confidence="LOW"))
    for e in ev:
        e.update(prev_snapshot=ps, snapshot=cs)
        e["event_id"] = eid(e["event"], e.get("url"), e.get("model_year"), e.get("trim_key"), e.get("price_type"),
                            e.get("spec_id"), e.get("old"), e.get("new"), cs)
    return ev


COLS = ["event_id", "event", "snapshot", "prev_snapshot", "url", "model_year", "trim_key", "label", "price_type", "spec_id",
        "old", "new", "delta_egp", "delta_pct", "material", "confidence", "detail"]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prev", required=True)
    ap.add_argument("--cur", required=True)
    ap.add_argument("--out")
    a = ap.parse_args()
    ev = detect(a.prev, a.cur)
    out = a.out or os.path.join(a.cur, "change_events.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(ev)
    from collections import Counter
    print("events:", dict(Counter(e["event"] for e in ev)))
