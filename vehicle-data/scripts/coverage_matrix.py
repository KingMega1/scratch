#!/usr/bin/env python3
"""Prioritized coverage matrix for the P2 market universe (412 models): what buyers need, what is accepted, what is next.

  coverage_matrix.py [--out review/coverage_matrix.csv]

Inputs: views/canonical_u11.json (accepted data), registry/u11_prices.csv (price rework reasons),
review/market_universe_audit.csv (registrations, market pages, official pages), config/market_universe.json.
Priority (deterministic):
  P0  top registration volume covering 80% of last-12-month passenger registrations in the universe,
      plus important launches (current model year >= 2026 with an official page or >=2 market listings and <50 regs,
      or named in config priority_launches), plus every identity split
  P1  >= 20 registrations in the last 12 months, or listed on >= 2 market sites
  P2  other on-sale models
Decision-critical essentials: identity, accepted price + trims, power, transmission/drive, powertrain, seats
(always for SUV/MPV), length, EV range/battery (EV/PHEV/REEV), warranty. Hero image is reported, not an essential.
"""
import argparse, collections, csv, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAUNCHES = {"byd/ti-7"}


def read(p):
    return list(csv.DictReader(open(p, newline="", encoding="utf-8")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "review", "coverage_matrix.csv"))
    a = ap.parse_args()
    canon = json.load(open(os.path.join(ROOT, "views", "canonical_u11.json")))
    audit = {r["identity"]: r for r in read(os.path.join(ROOT, "review", "market_universe_audit.csv"))}
    mu = {d["id"]: d for d in json.load(open(os.path.join(ROOT, "config", "market_universe.json")))["identities"]}
    ids = {r["p1_id"]: r for r in read(os.path.join(ROOT, "registry", "u11_models.csv"))}
    prices = collections.defaultdict(list)
    for r in read(os.path.join(ROOT, "registry", "u11_prices.csv")):
        prices[r["p1_id"]].append(r)
    launches = LAUNCHES | set(mu.get("_priority_launches", {}).get("ids", []))
    rows = []
    for m in canon["models"]:
        i = m["p1_id"]
        au = audit.get(i, {})
        reg12, reg6 = int(au.get("reg_last12") or 0), int(au.get("reg_last6") or 0)
        pages = int(au.get("market_pages") or 0)
        years = [int(y) for y in (au.get("current_model_years") or "").split()]
        d = mu.get(i, {})
        body = (ids[i]["body"] or d.get("body") or "").lower()
        pts = set(d.get("powertrains", []))
        specs = m["specs"] or {}
        pv = m["price"]
        fields = set(specs)
        ev_like = bool(pts & {"ev", "phev", "reev"}) or "battery_kwh" in fields or "ev_range_km" in fields
        need = []
        if m["id_status"] != "ACCEPTED":
            need.append("identity")
        if not pv:
            need.append("price")
        if not ({"power_hp", "system_power_hp", "motor_power_hp", "motor_power_kw"} & fields):
            need.append("power")
        if not ({"transmission", "drive"} & fields):
            need.append("transmission/drive")
        if "seats" not in fields and (body in ("suv", "mpv", "van", "minivans") or not body):
            need.append("seats")
        if "length_mm" not in fields:
            need.append("length")
        if ev_like and not ({"ev_range_km", "battery_kwh"} & fields):
            need.append("ev_range/battery")
        if not m["warranty"]:
            need.append("warranty")
        pr = prices.get(i, [])
        reasons = collections.Counter(r["reason"].split(":")[0].split(" (")[0] for r in pr if r["status"] == "REWORK")
        if pv:
            price_state = f'ACCEPTED tier {pv["tier"]}'
        elif not pr:
            price_state = "NO_EVIDENCE"
        else:
            price_state = "REWORK: " + "; ".join(f"{k} x{v}" for k, v in reasons.most_common(2))
        if "price" in need:
            if not pr:
                nxt = "price: no listing captured -> official/distributor source" if pages == 0 else "price: listing has no current price -> official/distributor source"
            elif any("CONFLICT" in k for k in reasons):
                nxt = "price: sites disagree -> official price list decides"
            elif any("PA-2" in k for k in reasons):
                nxt = "price: official value superseded by dated change -> refresh official page"
            else:
                nxt = "price: single site -> second independent source or official"
        elif {"power", "seats", "transmission/drive"} & set(need):
            nxt = "specs: official spec page/brochure for " + "/".join(x for x in need if x in ("power", "seats", "transmission/drive"))
        elif need:
            nxt = need[0] + ": official source"
        else:
            nxt = "complete for decision; image/brochure next" if not m["hero_image"] else "complete"
        launch = i in launches or (reg12 < 50 and years and max(years) >= 2026 and (au.get("official_pages") or pages >= 2))
        rows.append(dict(identity=i, model_id=m["model_id"], brand=m["brand"], model=m["model"], universe=m["universe"],
                         parent=d.get("parent", ""), body=body, reg_last12=reg12, reg_last6=reg6, market_pages=pages,
                         official_page=bool(au.get("official_pages")), current_model_years=" ".join(map(str, years)),
                         launch_flag=bool(launch), price_state=price_state, price_from_egp=(pv or {}).get("price_from", ""),
                         price_tier=(pv or {}).get("tier", ""), trims_accepted=len((pv or {}).get("trims", [])),
                         seats=" | ".join(sorted({x["value"] for x in specs.get("seats", [])})),
                         power_hp=" | ".join(sorted({x["value"] for x in specs.get("power_hp", [])}))[:40],
                         warranty=" | ".join(sorted({w["value"] for w in (m["warranty"] or [])})),
                         brochure=bool(m["brochures"]), hero=bool(m["hero_image"]), essentials_missing=";".join(need),
                         essentials_score=f"{8 - len([x for x in need if x != 'identity'])}/8", next_action=nxt))
    tot = sum(r["reg_last12"] for r in rows)
    cum = 0
    for r in sorted(rows, key=lambda r: -r["reg_last12"]):
        cum += r["reg_last12"]
        r["volume_share_pct"] = round(100 * r["reg_last12"] / tot, 2) if tot else 0
        top = cum - r["reg_last12"] < 0.8 * tot and r["reg_last12"] > 0
        r["priority"] = ("P0" if top or r["launch_flag"] or r["universe"] == "P2_SPLIT"
                         else "P1" if r["reg_last12"] >= 20 or r["market_pages"] >= 2 else "P2")
    rows.sort(key=lambda r: (r["priority"], -r["reg_last12"], r["identity"]))
    for n, r in enumerate(rows, 1):
        r["rank"] = n
    cols = ["rank", "priority", "identity", "model_id", "brand", "model", "universe", "parent", "body", "reg_last12", "reg_last6",
            "volume_share_pct", "launch_flag", "market_pages", "official_page", "current_model_years", "price_state", "price_from_egp",
            "price_tier", "trims_accepted", "seats", "power_hp", "warranty", "brochure", "hero", "essentials_score",
            "essentials_missing", "next_action"]
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    by = collections.defaultdict(collections.Counter)
    for r in rows:
        by[r["priority"]]["models"] += 1
        by[r["priority"]]["price_accepted"] += bool(r["price_from_egp"])
        by[r["priority"]]["essentials_complete"] += not r["essentials_missing"]
        by[r["priority"]]["reg_last12"] += r["reg_last12"]
    print(json.dumps({k: dict(v) for k, v in sorted(by.items())}, indent=1))


if __name__ == "__main__":
    main()
