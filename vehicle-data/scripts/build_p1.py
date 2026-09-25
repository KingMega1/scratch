#!/usr/bin/env python3
"""Build the P1 buyer-intelligence view for the ~EGP 2M SUV slice.

Deterministic: same inputs -> same output (generated_at is taken from --as-of).
No value is averaged, imputed or back-filled. Conflicts are emitted as lists.

Inputs (raw inputs live outside git; see vehicle-data/README.md for Drive IDs + SHA-256):
  --master     carindex_master.csv   (S0 snapshot, 2026-09-10, row-parallel to source_records.csv)
  --reg        reg_payload.json      (payload embedded in Vehicle_Registration_Explorer.html)
  S1 files, registry and crosswalks are read from this repo.
"""
import argparse, csv, hashlib, json, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S0_ID, S0_DATE = "S0_2026-09-10", "2026-09-10"
SNAP_ROOT = os.path.join(ROOT, "snapshots")


def _snap_key(d):
    n, date = d.split("_", 1)
    return (date, int(n[1:]))


# dated scrape snapshots S1..Sn (S0 is the pre-existing carindex_master.csv); order = observation date
SNAPSHOTS = sorted((d for d in (os.listdir(SNAP_ROOT) if os.path.isdir(SNAP_ROOT) else [])
                    if re.match(r"^S\d+_\d{4}-\d{2}-\d{2}$", d) and os.path.exists(os.path.join(SNAP_ROOT, d, "observations_parsed.csv"))),
                   key=_snap_key)
SNAP_ORDER = [S0_ID] + SNAPSHOTS
LATEST_ID = SNAP_ORDER[-1]

SOURCE_TIER = {  # per CarIndex_Source_Registry_2026-09-25 / Living Data Architecture §4.3 (D5 still open)
    "contactcars": "T2", "hatla2ee": "T2", "egycar": "T2", "yallamotor": "T2", "official-toyotaegypt": "T1",
}
NEAR_AGREEMENT_EGP = 5000  # placeholder tolerance from Living Data Architecture D7 (undecided)
SENTINELS = {"price coming soon": "COMING_SOON", "data not available": "NOT_AVAILABLE",
             "unavailable": "NOT_AVAILABLE", "": "NOT_PUBLISHED"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _iso(http_date):
    from email.utils import parsedate_to_datetime
    return parsedate_to_datetime(http_date).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def fold(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("ë", "e"))


def source_id(raw):
    """'ContactCars(pricetable)' -> ('contactcars', 'pricetable')."""
    m = re.match(r"^([^(]+)(?:\((.+)\))?$", (raw or "").strip())
    base, sub = m.group(1).strip().lower(), (m.group(2) or "").lower()
    return base, sub


def parse_price(raw):
    s = (raw or "").strip()
    t = s.replace(",", "").replace(" EGP", "").strip()
    if re.fullmatch(r"\d{5,9}", t):
        return int(t), "OK"
    return None, SENTINELS.get(s.lower(), "PARSE_FAILED")


def parse_year(raw):
    m = re.match(r"^\s*(\d{4})\b", raw or "")
    return int(m.group(1)) if m else None


SYN = {}


AGGREGATE_LABELS = {"other trims", "unspecified trim", "unspecified"}  # S0 master renamed ContactCars 'Other Trims'


def trim_key(label):
    s = (label or "").lower().strip().rstrip(":")
    if s in AGGREGATE_LABELS:
        return "othertrims"
    s = re.sub(r"^(a/t|m/t|cvt|dct)\s*/\s*", "", s)          # Hatla2ee 'A/T / LX'
    s = re.sub(r"\b\d\.\d\s*(l\b)?", " ", s)                 # '1.6', '1.5 L'
    s = re.sub(r"\b(a/t|m/t)\b", " ", s)
    s = s.replace("+", " plus ")                               # 'N-Connecta+' must not collide with 'N-Connecta'
    toks = re.findall(r"[a-z0-9]+", s)
    toks = [SYN.get(t, t) for t in toks]
    return "".join(toks)


# ---------------------------------------------------------------- loaders

def load_registry():
    models = {r["model_id"]: r for r in read_csv(os.path.join(ROOT, "registry", "models.csv"))}
    scrape = {(r["brand_normalized"], r["model_normalized"]): r
              for r in read_csv(os.path.join(ROOT, "crosswalk", "scrape_aliases.csv"))}
    reg = read_csv(os.path.join(ROOT, "crosswalk", "registration_aliases.csv"))
    for r in read_csv(os.path.join(ROOT, "crosswalk", "trim_synonyms.csv")):
        SYN[r["token"]] = r["replacement"]
    return models, scrape, reg


def load_s0(master_path, scrape_alias):
    obs, specs = [], []
    url_to_model = {}
    for i, r in enumerate(read_csv(master_path)):
        a = scrape_alias.get((r["brand_normalized"], r["model_normalized"]))
        if not a:
            continue
        src, sub = source_id(r["source"])
        mid = a["model_id"]
        if sub not in ("classified", "summary"):
            url_to_model.setdefault(r["source_url"], set()).add(mid)
        base = dict(snapshot=S0_ID, observed_at=S0_DATE, model_id=mid, source=src, source_sub=sub,
                    source_raw=r["source"], tier=("T3" if sub in ("classified", "summary") else SOURCE_TIER.get(src, "T2")),
                    url=r["source_url"], model_year=parse_year(r["model_year"]), model_year_raw=r["model_year"],
                    trim_raw=r["variant_raw"], trim_key=trim_key(r["variant_raw"]),
                    effective_date=r["price_date"] or None, row_ref=f"carindex_master.csv#row{r.get('master_row') or i + 2}")
        for ptype in ("official", "market"):
            v, st = parse_price(r[f"{ptype}_price"])
            obs.append(dict(base, price_type=ptype, value=v, value_status=st, value_raw=r[f"{ptype}_price"]))
        specs.append(dict(base, row=r))
    return obs, specs, url_to_model


def load_snapshot(snap_id, scrape_alias, url_to_model):
    d = os.path.join(SNAP_ROOT, snap_id)
    rows = read_csv(os.path.join(d, "observations_parsed.csv"))
    cp = os.path.join(d, "contactcars_pricetable_cells.csv")
    cells = {(c["source_url"], c["row_label"]): c for c in (read_csv(cp) if os.path.exists(cp) else [])}
    name_keys = {}  # folded 'brand model' -> model_id, for multi-model pages
    for (b, m), a in scrape_alias.items():
        name_keys[fold(b + m)] = a["model_id"]
    obs = []
    for i, r in enumerate(rows):
        src, sub = source_id(r["source"])
        if r["title_prefix"] and not re.fullmatch(r"20\d\d", r["model_year"] or ""):
            # e.g. 'Peugeot 3008 2027 Allure' was split at '3008'; re-split at the last 20xx token
            full = f'{r["title_prefix"]} {r["model_year"]} {r["trim_raw"]}'
            m = re.match(r"^(.*) (20\d\d) (.+)$", full)
            if m:
                r = dict(r, title_prefix=m.group(1), model_year=m.group(2), trim_raw=m.group(3), _resplit=True)
            else:
                m = re.match(r"^(.*) (20\d\d)$", full)  # year at the end: 'Peugeot 3008 A/T / Allure 2027'
                if not m:
                    sys.exit(f"unparseable title: {r}")
                pre, trim = r["title_prefix"] + " " + r["model_year"], r["trim_raw"][: -len(m.group(2))].strip()
                # S1-era parser split 'Peugeot 3008 A/T / Allure 2027' at '3008'; transmission marker starts the trim
                t = re.match(r"^(.*?) ((?:[AM]/T|CVT|DCT) */.*)$", pre)
                if t:
                    pre, trim = t.group(1), f"{t.group(2)} {trim}".strip()
                r = dict(r, title_prefix=pre, model_year=m.group(2), trim_raw=trim, _resplit=True)
        cands = url_to_model.get(r["source_url"], set())
        mid = None
        if r["title_prefix"]:
            mid = name_keys.get(fold(r["title_prefix"]))
            if mid is None and len(cands) == 1 and sub != "pricetable":
                mid = next(iter(cands))
        elif len(cands) == 1:
            mid = next(iter(cands))
        if mid is None:
            continue
        off_raw, mkt_raw = r["official_price"], r["market_price"]
        if sub == "pricetable":  # column position taken from the table cells, not from visible-text order
            c = cells.get((r["source_url"], f'{r["title_prefix"]} {r["model_year"]} {r["trim_raw"]}'.strip()))
            if c is None:
                sys.exit(f"pricetable row without cell match: {r}")
            off_raw, mkt_raw = c["official_cell"], c["market_cell"]
        base = dict(snapshot=snap_id, observed_at=_iso(r["fetched_at"]), model_id=mid, source=src, source_sub=sub,
                    source_raw=r["source"], tier=SOURCE_TIER.get(src, "T2"), url=r["source_url"],
                    model_year=parse_year(r["model_year"]), model_year_raw=r["model_year"],
                    trim_raw=r["trim_raw"].strip(), trim_key=trim_key(r["trim_raw"]),
                    effective_date=r["effective_date"] or None, page_sha256=r["page_sha256"],
                    row_ref=f"{snap_id}/observations_parsed.csv#row{i + 2}")
        for ptype, raw in (("official", off_raw), ("market", mkt_raw)):
            v, st = parse_price(raw)
            obs.append(dict(base, price_type=ptype, value=v, value_status=st, value_raw=raw))
    return obs


# ---------------------------------------------------------------- price logic

def attach_undated(obs):
    """EgyCar rows carry no model year. Attach one to a cohort only when another source shows the
    exact same trim_key AND the exact same official price in the same snapshot; otherwise leave it
    undated (model_year=None). No value is changed."""
    idx = defaultdict(set)
    for o in obs:
        if o["model_year"] and o["price_type"] == "official" and o["value"]:
            idx[(o["snapshot"], o["model_id"], o["trim_key"], o["value"])].add(o["model_year"])
    by_row = defaultdict(list)
    for o in obs:
        if o["model_year"] is None:
            by_row[(o["snapshot"], o["row_ref"])].append(o)
    for rows in by_row.values():
        off = next((o for o in rows if o["price_type"] == "official"), None)
        yrs = idx.get((off["snapshot"], off["model_id"], off["trim_key"], off["value"])) if off and off["value"] else None
        if yrs and len(yrs) == 1:
            y = next(iter(yrs))
            for o in rows:
                o["model_year"], o["year_basis"] = y, "attached_by_exact_trim_and_price_match"


def resolve(values):
    """values: list of obs (same snapshot, model, year, trim, official). Returns status + canonical."""
    nums = [o for o in values if o["value"] is not None and o["tier"] in ("T1", "T2")]
    t1 = [o for o in nums if o["tier"] == "T1"]
    distinct = sorted({o["value"] for o in nums})
    srcs = sorted({o["source"] for o in nums})
    if not nums:
        st = sorted({o["value_status"] for o in values})
        return dict(status="NO_NUMERIC_PRICE", value=None, confidence=None, sentinel_statuses=st)
    if len(distinct) == 1:
        v = distinct[0]
        if t1:
            return dict(status="OFFICIAL_T1", value=v, confidence="HIGH", sources=srcs)
        if len(srcs) >= 2:
            return dict(status="AGREED", value=v, confidence="HIGH", sources=srcs)
        return dict(status="SINGLE_SOURCE", value=v, confidence="MEDIUM", sources=srcs)
    if t1 and len({o["value"] for o in t1}) == 1:
        return dict(status="OFFICIAL_T1_OVER_CONFLICT", value=t1[0]["value"], confidence="HIGH", sources=srcs,
                    conflicting_values=distinct)
    if distinct[-1] - distinct[0] <= NEAR_AGREEMENT_EGP:
        return dict(status="NEAR_AGREEMENT", value=None, value_min=distinct[0], value_max=distinct[-1], confidence="MEDIUM",
                    sources=srcs, note=f"sources differ by <= EGP {NEAR_AGREEMENT_EGP} (rounding-level); range reported, not averaged")
    return dict(status="CONFLICT", value=None, confidence="LOW", sources=srcs, conflicting_values=distinct)


def obs_ref(o):
    d = dict(source=o["source_raw"], value=o["value"], value_status=o["value_status"], observed_at=o["observed_at"],
             url=o["url"], trim_label=o["trim_raw"], ref=o["row_ref"])
    if o.get("effective_date"):
        d["source_effective_date"] = o["effective_date"]
    if o.get("year_basis"):
        d["model_year_basis"] = o["year_basis"]
    return d


def build_price(mid, obs):
    mine = [o for o in obs if o["model_id"] == mid and o["tier"] in ("T1", "T2")]
    t3 = [o for o in obs if o["model_id"] == mid and o["tier"] == "T3"]
    # price history: series = (site source_id, price_type, model_year, trim_key); EgyCar pages state no
    # model year, so its series ignore the year. Sub-pages of one site (e.g. ContactCars price table) are one source.
    series_history, history = [], []
    ser = defaultdict(lambda: defaultdict(list))
    for o in mine:
        yk = None if o["source"] == "egycar" else o["model_year"]
        ser[(o["source"], o["price_type"], yk, o["trim_key"])][o["snapshot"]].append(o)
    for (src, pt, yk, tk), snaps in sorted(ser.items(), key=lambda kv: tuple("" if x is None else str(x) for x in kv[0])):
        seen = [x for x in SNAP_ORDER if x in snaps]
        B = snaps[seen[-1]]
        A = snaps[seen[-2]] if len(seen) > 1 else []
        av = sorted({o["value"] for o in A if o["value"] is not None})
        bv = sorted({o["value"] for o in B if o["value"] is not None})
        a, b = (A[0] if A else None), B[0]
        if seen[-1] != LATEST_ID:
            ch = "NOT_SEEN_IN_LATEST"
        elif len(av) > 1 or len(bv) > 1:
            ch = "AMBIGUOUS_DUPLICATE_ROWS"
        elif a is None:
            ch = "NEW_IN_LATEST" if len(SNAP_ORDER) > 1 else "BASELINE"
        elif av and bv:
            ch = "UNCHANGED" if av == bv else "CHANGED"
        elif bool(av) != bool(bv):
            ch = "PRICE_STATUS_CHANGE"
        else:
            ch = "UNCHANGED_NON_NUMERIC"
        snap_val = lambda os_: (lambda v: v[0] if len(v) == 1 else None)(sorted({o["value"] for o in os_ if o["value"] is not None}))
        h = dict(source=src, price_type=pt, change=ch, _year_key=yk, trim_key=tk,
                 prev=a and dict(snapshot=a["snapshot"], value=av[0] if len(av) == 1 else None, values=av, status=a["value_status"], label=a["trim_raw"]),
                 latest=dict(snapshot=b["snapshot"], value=bv[0] if len(bv) == 1 else None, values=bv, status=b["value_status"],
                             label=b["trim_raw"], observed_at=b["observed_at"]),
                 series=[dict(snapshot=x, value=snap_val(snaps[x])) for x in seen])
        if ch == "CHANGED":
            h["delta_egp"] = bv[0] - av[0]
        series_history.append(h)
        history.append({**{k: v for k, v in h.items() if k != "_year_key"}, "model_year": yk})
    cohorts = defaultdict(lambda: defaultdict(list))
    for o in mine:
        cohorts[o["model_year"]][o["trim_key"]].append(o)
    out_cohorts, conflicts = [], []
    for y in sorted(cohorts, key=lambda v: (v is None, v or 0)):
        trims = []
        for tk in sorted(cohorts[y]):
            rows = cohorts[y][tk]
            latest = max((o["snapshot"] for o in rows), key=SNAP_ORDER.index)
            cur = [o for o in rows if o["snapshot"] == latest]
            off = resolve([o for o in cur if o["price_type"] == "official"])
            mkts = [obs_ref(o) for o in cur if o["price_type"] == "market" and o["value"] is not None]
            prem = []
            for o in cur:
                if o["price_type"] != "market" or o["value"] is None:
                    continue
                twin = next((p for p in cur if p["price_type"] == "official" and p["row_ref"] == o["row_ref"] and p["value"]), None)
                if twin:
                    prem.append(dict(source=o["source_raw"], market_minus_official=o["value"] - twin["value"]))
            hist = [dict(h) for h in series_history if h["trim_key"] == tk and h["_year_key"] in (y, None)
                    and (h["_year_key"] is not None or any(o["source"] == "egycar" for o in rows))]
            for h in hist:
                h.pop("_year_key"); h.pop("trim_key")
            t = dict(trim_key=tk, labels=sorted({o["trim_raw"] for o in rows}), latest_snapshot=latest,
                     official=dict(off, observations=[obs_ref(o) for o in cur if o["price_type"] == "official"]),
                     market_observations=mkts, market_premium=prem, history=hist)
            if tk == "othertrims" or re.match(r"^range\d*classes", tk):
                t["is_aggregate_row"] = True
            trims.append(t)
            if off["status"] == "CONFLICT":
                conflicts.append(dict(type="PRICE_CONFLICT", model_year=y, trim_key=tk, values=off["conflicting_values"],
                                      sources=off["sources"], snapshot=latest))
        out_cohorts.append(dict(model_year=y, trims=trims))
    # per-cohort summary + derived 'from' price for the latest dated cohort (never averaged)
    summaries = []
    for c in out_cohorts:
        if not c["model_year"]:
            continue
        real = [t for t in c["trims"] if not t.get("is_aggregate_row")]
        cand = sorted({o["value"] for t in real for o in t["official"]["observations"] if o["value"] is not None})
        resolved = [t for t in real if t["official"]["status"] in ("AGREED", "SINGLE_SOURCE", "OFFICIAL_T1", "OFFICIAL_T1_OVER_CONFLICT", "NEAR_AGREEMENT")]
        summaries.append(dict(model_year=c["model_year"], trims=len(real), trims_resolved=len(resolved),
                              trims_in_conflict=sum(1 for t in real if t["official"]["status"] == "CONFLICT"),
                              official_candidate_min=cand[0] if cand else None, official_candidate_max=cand[-1] if cand else None))
    price_from, latest_cohort = None, None
    for c in sorted([c for c in out_cohorts if c["model_year"]], key=lambda c: -c["model_year"]):
        real = [t for t in c["trims"] if not t.get("is_aggregate_row")]
        cand = [o["value"] for t in real for o in t["official"]["observations"] if o["value"] is not None]
        if not cand:
            continue
        latest_cohort = c["model_year"]
        lo = lambda t: t["official"]["value"] if t["official"]["value"] is not None else t["official"].get("value_min")
        resolved = [t for t in real if lo(t) is not None]
        unresolved = [t for t in real if lo(t) is None]
        best = min(resolved, key=lo) if resolved else None
        floor_unres = min((o["value"] for t in unresolved for o in t["official"]["observations"] if o["value"] is not None), default=None)
        if best and (floor_unres is None or floor_unres >= lo(best)):
            o = best["official"]
            if o["status"] == "NEAR_AGREEMENT":
                price_from = dict(status="RESOLVED_RANGE", value=None, value_min=o["value_min"], value_max=o["value_max"],
                                  trim_key=best["trim_key"], confidence=o["confidence"])
            else:
                price_from = dict(status="RESOLVED", value=o["value"], trim_key=best["trim_key"], confidence=o["confidence"])
        else:
            price_from = dict(status="CONFLICT", value=None, candidate_min=min(cand),
                              detail="the cheapest trim(s) of this cohort have conflicting or unresolved official prices")
        price_from.update(model_year=c["model_year"], unresolved_trims_in_cohort=[t["trim_key"] for t in unresolved],
                          basis="derived: min official price across trims of the latest model-year cohort that has any numeric official price")
        break
    return dict(currency="EGP", price_from=price_from, cohort_summary=summaries, latest_priced_cohort=latest_cohort, cohorts=out_cohorts,
                t3_evidence=[obs_ref(o) for o in t3 if o["value"] is not None]), conflicts, history


# ---------------------------------------------------------------- specs

SPEC_FIELDS = ["body_type_normalized", "fuel_type_raw", "engine_capacity", "horsepower", "torque", "transmission",
               "drive_type", "seats", "length", "width", "height", "wheelbase", "trunk_capacity", "fuel_consumption",
               "battery_capacity", "electric_range", "warranty"]


def build_specs(mid, specs):
    out = {}
    rows = [s for s in specs if s["model_id"] == mid and s["tier"] in ("T1", "T2")]
    for f in SPEC_FIELDS:
        vals = defaultdict(lambda: dict(sources=set(), trims=set()))
        for s in rows:
            v = (s["row"].get(f) or "").strip()
            if not v or v.upper() in ("NOT_AVAILABLE", "N/A"):
                continue
            vals[v]["sources"].add(s["source_raw"])
            vals[v]["trims"].add(f'{s["model_year_raw"]} {s["trim_raw"]}')
        if not vals:
            out[f] = dict(status="MISSING")
            continue
        lst = [dict(value=v, sources=sorted(d["sources"]), scope=sorted(d["trims"])) for v, d in sorted(vals.items())]
        out[f] = dict(status="SINGLE_VALUE" if len(lst) == 1 else "MULTIPLE_VALUES", values=lst,
                      note=None if len(lst) == 1 else "values differ by trim and/or source; not reconciled")
    return dict(snapshot=S0_ID, observed_at=S0_DATE, attributes=out)


def load_trim_specs(url_to_model):
    """Specs from trim-detail pages (fetch_snapshot.py specs), latest snapshot that has them."""
    snap = next((x for x in reversed(SNAPSHOTS) if os.path.exists(os.path.join(SNAP_ROOT, x, "specs_parsed.csv"))), None)
    if not snap:
        return None, {}
    fields = {(r["source"], r["spec_label"].strip()): r for r in read_csv(os.path.join(ROOT, "crosswalk", "spec_fields.csv"))}
    base_map = {}
    for u, mids in url_to_model.items():
        if len(mids) == 1:
            base_map[re.sub(r"/year-\d{4}$", "", u).lower()] = next(iter(mids))
    out = defaultdict(list)
    for i, r in enumerate(read_csv(os.path.join(SNAP_ROOT, snap, "specs_parsed.csv"))):
        model_url = re.sub(r"/[0-9a-f]{12}$|/\d+$", "", r["trim_url"]).lower()
        mid = base_map.get(model_url)
        f = fields.get((r["source"], r["spec_label"].strip())) or fields.get((r["source"], r["spec_id"].split(":", 1)[-1]))
        if not mid or not f:
            continue
        trim = r["trim_raw"] or re.sub(r" Prices & Features$", "", r["title"] or "")
        out[mid].append(dict(attribute=f["attribute"], value=r["value"], unit_as_stated=f["unit_as_stated"] or None,
                             source=r["source"], trim=trim, model_year=r["model_year"] or None, url=r["trim_url"],
                             observed_at=_iso(r["fetched_at"]), ref=f"{snap}/specs_parsed.csv#row{i + 2}"))
    return snap, out


def build_trim_specs(snap, rows):
    if not snap:
        return None
    by = defaultdict(list)
    for r in rows:
        by[r["attribute"]].append(r)
    attrs = {}
    for a, lst in sorted(by.items()):
        vals = sorted({str(x["value"]) for x in lst})
        attrs[a] = dict(status="SINGLE_VALUE" if len(vals) == 1 else "MULTIPLE_VALUES", values=vals,
                        observations=lst, note=None if len(vals) == 1 else "differs by trim and/or source; not reconciled")
    return dict(snapshot=snap, trim_pages=len({r["url"] for r in rows}), attributes=attrs)


# ---------------------------------------------------------------- registration

def build_registration(reg_payload, reg_alias, window, slice_ids):
    months_all = sorted(reg_payload["meta"]["months"])
    win = [m for m in months_all if window[0] <= m <= window[1]]
    last3 = win[-3:]
    prev3 = [f"{int(m[:4]) - 1}{m[4:]}" for m in last3]
    acc = defaultdict(list)
    for a in reg_alias:
        acc[(a["reg_brand"], a["reg_model"])].append(a)
    per = defaultdict(lambda: dict(monthly=Counter(), engine=Counter(), segment=Counter(), first=None, aliases=set()))
    for mo, ct, sg, en, b, mdl, v in reg_payload["core"]:
        if ct != "Passenger":
            continue
        for a in acc.get((b, mdl), []):
            if a["status"] != "ACCEPTED":
                continue
            p = per[a["model_id"]]
            p["monthly"][mo] += v
            p["aliases"].add(f"{b}|{mdl}")
            if mo in win:
                p["engine"][en] += v
                p["segment"][sg] += v
            p["first"] = min(p["first"] or "9999", mo)
    out = {}
    tot_slice = sum(sum(per[m]["monthly"][x] for x in win) for m in slice_ids if m in per)
    ranks = sorted(((sum(per[m]["monthly"][x] for x in win), m) for m in slice_ids if m in per), reverse=True)
    rank_of = {m: i + 1 for i, (_, m) in enumerate(ranks)}
    for mid, p in per.items():
        wsum = int(sum(p["monthly"][x] for x in win))
        l3 = int(sum(p["monthly"][x] for x in last3))
        p3 = int(sum(p["monthly"][x] for x in prev3))
        launched_in_base = (p["first"] or "9999") > prev3[0]
        yoy = None if (p3 == 0 or launched_in_base) else round((l3 - p3) / p3, 3)
        out[mid] = dict(
            unit="first registrations (licences), passenger vehicles; not sales",
            window=dict(start=win[0], end=win[-1], months_present=win,
                        months_missing=[m for m in _month_range(win[0], win[-1]) if m not in win]),
            registrations_in_window=wsum,
            rank_in_slice=rank_of.get(mid), slice_models_ranked=len(ranks),
            share_of_slice_registrations=(round(wsum / tot_slice, 4) if tot_slice and mid in rank_of else None),
            momentum=dict(basis=f"sum of {','.join(last3)} vs same months one year earlier ({','.join(prev3)})",
                          last3=l3, prior_year_same3=p3, yoy_change=yoy,
                          yoy_suppressed_reason=("first registered after the start of the comparison base" if launched_in_base else None),
                          caveat="classification regime changed Sep 2025 and model-name strings drift across appends; YoY may be distorted"),
            first_seen_month=p["first"],
            months_with_registrations_in_window=sum(1 for x in win if p["monthly"][x] > 0),
            powertrain_mix_in_window={k: int(v) for k, v in p["engine"].most_common()},
            segment_labels_in_window={k: int(v) for k, v in p["segment"].most_common()},
            monthly={m: int(p["monthly"][m]) for m in months_all if p["monthly"][m] > 0 and m >= "2024-09"},
            aliases_used=sorted(p["aliases"]))
    return out, win


def _month_range(a, b):
    y, m = int(a[:4]), int(a[5:])
    out = []
    while f"{y}-{m:02d}" <= b:
        out.append(f"{y}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--master", required=True)
    ap.add_argument("--reg", required=True)
    ap.add_argument("--as-of", required=True, help="generation date, YYYY-MM-DD")
    ap.add_argument("--out", default=os.path.join(ROOT, "views", "p1_suv_2m.json"))
    a = ap.parse_args()

    cfg = json.load(open(os.path.join(ROOT, "config", "slice_suv_2m.json")))
    rules = cfg["rules"]
    models, scrape_alias, reg_alias = load_registry()
    s0_obs, s0_specs, url_to_model = load_s0(a.master, scrape_alias)
    s1_obs = [o for sid in SNAPSHOTS for o in load_snapshot(sid, scrape_alias, url_to_model)]
    obs = s0_obs + s1_obs
    attach_undated(obs)
    spec_snap, trim_specs = load_trim_specs(url_to_model)
    reg_payload = json.load(open(a.reg))

    # universe: price rule on S0 official prices (as in config)
    lo, hi = rules["price_band_egp"]
    price_ok = {}
    for mid in models:
        v = [o["value"] for o in s0_obs if o["model_id"] == mid and o["price_type"] == "official" and o["value"]
             and o["tier"] != "T3" and o["trim_key"] != "othertrims"]  # aggregate rows cannot qualify a model
        price_ok[mid] = bool(v) and min(v) <= hi and max(v) >= lo
    reg_all, win = build_registration(reg_payload, reg_alias, rules["registration_window"], list(models))
    slice_ids = [m for m in models if price_ok[m] and reg_all.get(m, {}).get("registrations_in_window", 0) >= rules["registration_min"]]
    reg, _ = build_registration(reg_payload, reg_alias, rules["registration_window"], slice_ids)

    review, out_models = [], []
    all_history = []
    for mid, m in models.items():
        price, conflicts, history = build_price(mid, obs)
        all_history += [dict(h, model_id=mid) for h in history]
        gaps = []
        ra = [x for x in reg_alias if x["model_id"] == mid]
        if not price_ok[mid]:
            gaps.append(dict(type="PRICE_RULE_NOT_MET", detail="no trim-level S0 official price overlapping the slice band"))
        if not any(x["status"] == "ACCEPTED" for x in ra):
            gaps.append(dict(type="REGISTRATION_UNLINKED", detail="; ".join(f'{x["reg_brand"]}|{x["reg_model"]}: {x["status"]} - {x["note"]}' for x in ra)))
        for x in ra:
            if x["status"] == "ACCEPTED" and x["confidence"] != "HIGH":
                review.append(dict(item_type="REGISTRATION_ALIAS", model_id=mid, detail=f'{x["reg_brand"]}|{x["reg_model"]} ({x["match_rule"]})', status="ACCEPTED_PENDING_REVIEW"))
        if price["price_from"] is None:
            gaps.append(dict(type="NO_OFFICIAL_PRICE", detail="no numeric official price in any dated cohort"))
        elif price["price_from"]["status"] == "CONFLICT":
            gaps.append(dict(type="FROM_PRICE_IN_CONFLICT", detail=f'{price["price_from"]["model_year"]}: lowest candidate {price["price_from"]["candidate_min"]}'))
        elif price["price_from"]["unresolved_trims_in_cohort"]:
            gaps.append(dict(type="UNRESOLVED_TRIMS_IN_PRICED_COHORT", detail=", ".join(price["price_from"]["unresolved_trims_in_cohort"])))
        if price["latest_priced_cohort"] and price["latest_priced_cohort"] < 2026:
            gaps.append(dict(type="STALE_COHORT", detail=f'latest priced model year is {price["latest_priced_cohort"]}'))
        s1_seen = any(o["model_id"] == mid and o["snapshot"] == LATEST_ID for o in s1_obs)
        if not s1_seen:
            gaps.append(dict(type="NOT_IN_LATEST_SNAPSHOT", detail=f"no {LATEST_ID} observation mapped to this model"))
        single_src = sorted({o["source"] for o in obs if o["model_id"] == mid and o["tier"] == "T2" and o["value"]})
        if len(single_src) == 1:
            gaps.append(dict(type="SINGLE_SOURCE_MODEL", detail=f"all price evidence from {single_src[0]}"))
        for h in history:
            if h["change"] == "AMBIGUOUS_DUPLICATE_ROWS":
                review.append(dict(item_type="DUPLICATE_ROWS_IN_SNAPSHOT", model_id=mid,
                                   detail=f'{h["model_year"]} {h["trim_key"]} {h["source"]} {h["price_type"]}: {h["prev"] and h["prev"]["snapshot"]} {h["prev"] and h["prev"]["values"]} / {h["latest"]["snapshot"]} {h["latest"]["values"]}', status="OPEN"))
            if h["change"] == "PRICE_STATUS_CHANGE" and h["trim_key"] == "othertrims" and h["price_type"] == "official" and h["prev"] and h["prev"]["snapshot"] == S0_ID and h["prev"]["value"]:
                review.append(dict(item_type="S0_PRICE_COLUMN_SUSPECT", model_id=mid,
                                   detail=f'{h["model_year"]} Other Trims: S0 recorded official {h["prev"]["value"]}; {h["latest"]["snapshot"]} table cells show this row priced only in the market column', status="OPEN"))
        for c in conflicts:
            review.append(dict(item_type=c["type"], model_id=mid, detail=f'{c["model_year"]} {c["trim_key"]}: {c["values"]} from {c["sources"]}', status="OPEN"))
        eff = sorted({o["effective_date"] for o in obs if o["model_id"] == mid and o.get("effective_date")})
        out_models.append(dict(
            model_id=mid, slug=m["slug"], brand=m["brand"], model=m["model_name"], id_status=m["id_status"],
            in_slice=mid in slice_ids,
            slice_eval=dict(price_rule_passed=price_ok[mid], registrations_in_window=reg_all.get(mid, {}).get("registrations_in_window"),
                            registration_rule_passed=reg_all.get(mid, {}).get("registrations_in_window", 0) >= rules["registration_min"]),
            price=price, specs=dict(build_specs(mid, s0_specs), trim_pages=build_trim_specs(spec_snap, trim_specs.get(mid, []))), registration=reg.get(mid) or reg_all.get(mid),
            freshness=dict(price_snapshots=[dict(id=x, observed_at=(S0_DATE if x == S0_ID else x.split("_", 1)[1]),
                                                 model_observed=any(o["model_id"] == mid and o["snapshot"] == x for o in obs))
                                            for x in SNAP_ORDER],
                           source_stated_price_dates=eff, spec_snapshot=S0_DATE,
                           registration_data_through=win[-1]),
            conflicts=conflicts, gaps=gaps))

    changes = Counter(h["change"] for h in all_history)
    def ins(p):
        return dict(path=os.path.relpath(p, ROOT) if p.startswith(ROOT) else os.path.basename(p), sha256=sha256(p))
    doc = dict(
        schema="carindex.p1.buyer_view/v2", slice=cfg["slice_id"], generated_as_of=a.as_of,
        notes=["Model level is canonical; trims are evidence attached to a model.",
               "No value is averaged or imputed. CONFLICT means sources disagree and no canonical value is given.",
               "Registration counts are first licences (Ahram/AMIC data via Registration Explorer), not sales.",
               "IDs are PROVISIONAL (Living Data Architecture D3/D4 undecided); do not build public URLs on them."],
        universe_rule=rules,
        inputs=[ins(a.master), ins(a.reg)] + [ins(os.path.join(SNAP_ROOT, x, f)) for x in SNAPSHOTS
                for f in ("observations_parsed.csv", "contactcars_pricetable_cells.csv", "specs_parsed.csv")
                if os.path.exists(os.path.join(SNAP_ROOT, x, f))] + [
                ins(os.path.join(ROOT, "registry", "models.csv")), ins(os.path.join(ROOT, "crosswalk", "scrape_aliases.csv")),
                ins(os.path.join(ROOT, "crosswalk", "registration_aliases.csv")), ins(os.path.join(ROOT, "crosswalk", "trim_synonyms.csv"))],
        price_history=dict(snapshots=SNAP_ORDER, latest=LATEST_ID, series_compared=sum(changes.values()), changes=dict(changes),
                           next_snapshot="see vehicle-data/README.md"),
        models=sorted(out_models, key=lambda x: (not x["in_slice"], -(x["slice_eval"]["registrations_in_window"] or 0))))
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1, default=list)
        f.write("\n")
    with open(os.path.join(ROOT, "review", "review_queue.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["item_type", "model_id", "detail", "status"])
        w.writeheader()
        w.writerows(review)
    with open(os.path.join(ROOT, "views", "price_history.csv"), "w", newline="", encoding="utf-8") as f:
        cols = ["model_id", "model_year", "trim_key", "source", "price_type", "change", "prev_snapshot", "prev_value", "prev_status",
                "latest_snapshot", "latest_value", "latest_status", "delta_egp", "series"]
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for h in all_history:
            p_, l_ = h["prev"] or {}, h["latest"]
            w.writerow(dict(model_id=h["model_id"], model_year=h["model_year"], trim_key=h["trim_key"], source=h["source"],
                            price_type=h["price_type"], change=h["change"], prev_snapshot=p_.get("snapshot"), prev_value=p_.get("value"),
                            prev_status=p_.get("status"), latest_snapshot=l_["snapshot"], latest_value=l_["value"], latest_status=l_["status"],
                            delta_egp=h.get("delta_egp"), series=" ".join(f'{x["snapshot"]}={x["value"]}' for x in h["series"])))
    with open(os.path.join(ROOT, "views", "p1_suv_2m_summary.csv"), "w", newline="", encoding="utf-8") as f:
        cols = ["model_id", "slug", "brand", "model", "in_slice", "from_status", "from_value", "from_value_min", "from_value_max",
                "from_model_year", "from_confidence", "cohorts_priced", "trims_in_conflict_latest_cohort",
                "registrations_2025_09_to_2026_08", "rank_in_slice", "share_of_slice", "yoy_last3", "first_seen_month",
                "registered_powertrains", "gaps"]
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for m in doc["models"]:
            pf = m["price"]["price_from"] or {}
            r = m["registration"] or {}
            cs = m["price"]["cohort_summary"]
            latest = next((c for c in cs if c["model_year"] == pf.get("model_year")), {})
            w.writerow(dict(model_id=m["model_id"], slug=m["slug"], brand=m["brand"], model=m["model"], in_slice=m["in_slice"],
                            from_status=pf.get("status", "NONE"), from_value=pf.get("value"), from_value_min=pf.get("value_min", pf.get("candidate_min")),
                            from_value_max=pf.get("value_max"), from_model_year=pf.get("model_year"), from_confidence=pf.get("confidence"),
                            cohorts_priced=",".join(str(c["model_year"]) for c in cs if c["official_candidate_min"]),
                            trims_in_conflict_latest_cohort=latest.get("trims_in_conflict"),
                            registrations_2025_09_to_2026_08=r.get("registrations_in_window"), rank_in_slice=r.get("rank_in_slice"),
                            share_of_slice=r.get("share_of_slice_registrations"), yoy_last3=r.get("momentum", {}).get("yoy_change"),
                            first_seen_month=r.get("first_seen_month"),
                            registered_powertrains=";".join(f"{k}:{v}" for k, v in (r.get("powertrain_mix_in_window") or {}).items()),
                            gaps=";".join(g["type"] for g in m["gaps"])))
    print(f"models={len(out_models)} in_slice={len(slice_ids)} review_items={len(review)} history={dict(changes)}")


if __name__ == "__main__":
    main()
