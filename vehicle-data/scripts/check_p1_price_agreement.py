"""P2 -> P1 price agreement check (read-only).

For every model with a P2-accepted price in the serving release, compare it with the price the P1 engine would use
from a P1 recommendation_view.json (engine rule: latest model year only, priced, named, de-duplicated).
Also lists P1 models priced in the universe that have no P2-accepted price (shown in recommendations, absent from
P5 compare/detail).

usage: python3 scripts/check_p1_price_agreement.py <recommendation_view.json> [serving_release.json] [--ids a,b]
exit 1 when a P2-accepted model disagrees.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def current_trims(m):
    tr = [t for t in m.get("trims", []) if (t.get("min") or 0) > 0]
    if not tr:
        return []
    y = max(t.get("year") or 0 for t in tr)
    tr = [t for t in tr if (t.get("year") or 0) == y]
    named = [t for t in tr if not re.fullmatch(r"(unspecified|n/a|-)?", (t.get("label") or "").strip(), re.I)]
    tr = named or tr
    seen, out = set(), []
    for t in tr:
        k = f'{t["min"]}|{re.sub(r"[^a-z0-9]", "", (t.get("label") or "").lower())[:5]}'
        if k not in seen:
            seen.add(k)
            out.append(t)
    return out


def check(view, release, ids=None):
    acc = {}
    for e in release["entries"] + release.get("market_additions", []):
        pid = e.get("p1_id") or e.get("identity")
        p = (e.get("accepted") or {}).get("price")
        if pid and p and (p.get("price_from") or 0) > 0:
            acc[pid] = p
    rows, unaccepted = [], []
    for m in view["models"]:
        if ids and m["id"] not in ids:
            continue
        cur = current_trims(m)
        p1_from = min((t["min"] for t in cur), default=None)
        p1_my = max((t.get("year") or 0 for t in cur), default=0) or None
        p = acc.get(m["id"])
        if p:
            ok = p1_from == p["price_from"]
            rows.append({"id": m["id"], "p2_from": p["price_from"], "p2_my": p.get("model_year"), "p2_as_of": p.get("as_of"),
                         "p1_from": p1_from, "p1_my": p1_my, "p1_dates": sorted({t.get("date") for t in cur if t.get("date")}),
                         "agree": ok})
        elif m.get("u") and cur:
            unaccepted.append({"id": m["id"], "p1_from": p1_from, "p1_my": p1_my, "official": any(t.get("official") for t in cur),
                               "p1_dates": sorted({t.get("date") for t in cur if t.get("date")})})
    return rows, unaccepted


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ids = None
    if "--ids" in sys.argv:
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
        args = [a for a in args if a != sys.argv[sys.argv.index("--ids") + 1]]
    view = json.loads(Path(args[0]).read_text())
    release = json.loads(Path(args[1] if len(args) > 1 else ROOT / "views/catalogue-serving.release.json").read_text())
    rows, unaccepted = check(view, release, ids)
    bad = [r for r in rows if not r["agree"]]
    print(json.dumps({"dataset": view["meta"].get("version"), "release_id": release.get("release_id"),
                      "p2_accepted_models_in_p1": len(rows), "disagree": len(bad), "disagreements": bad,
                      "priced_in_p1_without_p2_acceptance": len(unaccepted),
                      "unaccepted": unaccepted if ids else [u["id"] for u in unaccepted]}, indent=1, ensure_ascii=False))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
