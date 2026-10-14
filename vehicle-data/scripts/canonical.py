#!/usr/bin/env python3
"""P2 canonical promotion for the 283 U11 on-sale models (deterministic; no LLM; no network).

  canonical.py [--snap snapshots/U_<date>_<run>] [--as-of YYYY-MM-DD]

Reads   inputs/u11/{p11_universe.json, catalogue-serving.RC1.json, official/*.official_observations.csv}
        registry/models.csv (existing P2 IDs, never changed), registry/u11_models.csv (previous assignments, kept)
        registry/price_evidence_manual.csv (Tier A/C documents supplied outside the crawler)
        <snap>/observations_parsed.csv, contactcars_pricetable_cells.csv, price_changes_stated.csv (market pages)
Writes  registry/u11_models.csv          canonical identity, one row per model (283 on sale + retained off-sale)
        registry/u11_prices.csv          every price observation with tier, status (ACCEPT/REWORK/...), reason, dates
        views/canonical_u11.json         accepted canonical records + gaps + conflicts (carindex.p2.canonical/v1)
        views/catalogue-serving.release.json   carindex.p2.catalogue-serving/v1 (RC1 fields kept; accepted data added)
        review/u11_coverage.csv          283-row coverage table (source of the CEO review sheet tab)

Acceptance rules (AT-39 price evidence policy; conflicts -> REWORK, nothing inferred, nothing averaged):
  ID-1   identity ACCEPT when p1_id/slug/model_id are unique, U11 and the P5 RC1 release agree on brand+model,
         and any pre-existing P2 ID keeps its slug. IDs are never re-assigned; new IDs continue m_NNNNNN.
  PA-1   Tier A (official Egypt OEM/importer page or document): ACCEPT if confidence HIGH, value not repeated across
         >=3 trims of the model (parser-suspect), and within +/-25% of the market official-price range when one exists.
  PB-1   Tier B: the same official EGP value for the same model, model year and trim reported by >=2 independent
         sites (trim key equal, or the value unique within each site's cohort). Date = source-stated effective date
         when a site states one for that value, else the common observation date (date_basis=OBSERVED).
  PB-2   same model/year/trim with different values across sites -> REWORK (CONFLICT); single site -> Tier C REWORK.
  PS-1   when a model has accepted Tier A trim prices, Tier B rows are kept as CORROBORATES / SUPERSEDED_BY_TIER_A.
"""
import argparse, collections, functools, csv, glob, hashlib, importlib.util, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IN = os.path.join(ROOT, "inputs", "u11")
_spec = importlib.util.spec_from_file_location("b", os.path.join(HERE, "build_p1.py"))
b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b)
b.load_registry()  # trim synonyms -> b.SYN

SITE = {"ContactCars": "ContactCars", "ContactCars(pricetable)": "ContactCars", "Hatla2ee": "Hatla2ee", "EgyCar": "EgyCar"}
DIVERGENCE = 0.25


def read(p):
    return list(csv.DictReader(open(p, newline="", encoding="utf-8"))) if os.path.exists(p) else []


def write(p, cols, rows):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def day(http_date):
    return b._iso(http_date)[:10] if http_date else ""


# ------------------------------------------------------------------ identity

@functools.lru_cache(maxsize=None)
def market_universe():
    p = os.path.join(ROOT, "config", "market_universe.json")
    return json.load(open(p)) if os.path.exists(p) else {"identities": []}


def in_catalogue(r):
    return r["on_sale_u11"] == "true" or r.get("universe") in ("P2_ADDITION", "P2_SPLIT")


@functools.lru_cache(maxsize=None)
def single_length():
    """Length (mm) stated identically on every market trim page of an identity (one site allowed): size-class input only."""
    own = url_owner()
    attr = {(r["source"], r["spec_label"]): r["attribute"] for r in read(os.path.join(ROOT, "crosswalk", "spec_fields.csv"))}
    vals = collections.defaultdict(collections.Counter)
    srcs = collections.defaultdict(set)
    for snap in [sorted(glob.glob(os.path.join(ROOT, "snapshots", x)))[-1:] for x in ("US_*", "USA_*")]:
        for s_ in snap:
            for r in read(os.path.join(s_, "specs_parsed.csv")):
                if attr.get((r["source"], r["spec_label"])) != "length" and r["spec_label"] != "Length (mm)":
                    continue
                u = r["trim_url"]
                p1 = owner_of(own, u) if "contactcars" in u else own.get(u.rsplit("/", 1)[0])
                p1 = split_of(p1, r.get("trim_raw") or r.get("title", "")) if p1 else p1
                m = re.search(r"\d{4}", r["value"] or "")
                if p1 and m and 3000 <= int(m.group(0)) <= 6500:
                    vals[p1][m.group(0)] += 1
                    srcs[p1].add(r["source"])
    return {p: (next(iter(c)), sum(c.values()), "+".join(sorted(srcs[p]))) for p, c in vals.items() if len(c) == 1}


@functools.lru_cache(maxsize=None)
def size_class():
    """Size class = dominant passenger registration segment (CEO registration explorer, last 12 months) of the
    registration names the universe audit assigned to the identity."""
    reg = {(r["reg_brand"], r["reg_model"]): r for r in read(os.path.join(ROOT, "inputs", "registration_models.csv"))}
    ap = os.path.join(ROOT, "review", "market_universe_audit.csv")
    out = {}
    for r in (read(ap) if os.path.exists(ap) else []):
        seg = collections.Counter()
        for n in filter(None, (x.strip() for x in r["reg_names"].split(";"))):
            b_, _, m_ = n.partition("|")
            x = reg.get((b_, m_))
            if x and x["segment_last12"]:
                seg[x["segment_last12"]] += int(x["last12"])
        if seg:
            s_, v = seg.most_common(1)[0]
            out[r["identity"]] = dict(segment=s_, basis=f"registration segment, last 12 months ({v} registrations)",
                                      source="inputs/registration_models.csv (Vehicle_Registration_Explorer)")
    return out


def identity():
    U = [m for m in json.load(open(os.path.join(IN, "p11_universe.json")))["models"] if m.get("in_universe")]
    rc1 = json.load(open(os.path.join(IN, "catalogue-serving.RC1.json")))
    ent = {e["p1_id"]: e for e in rc1["entries"]}
    reg = {r["model_id"]: r for r in read(os.path.join(ROOT, "registry", "models.csv"))}
    prev = {r["p1_id"]: r for r in read(os.path.join(ROOT, "registry", "u11_models.csv"))}
    used = set(reg) | {r["model_id"] for r in prev.values()}
    nxt = max(int(x[2:]) for x in used) + 1
    rows = []
    for m in sorted(U, key=lambda m: m["id"]):
        e = ent.get(m["id"])
        mid = (prev.get(m["id"]) or {}).get("model_id") or (e or {}).get("p2_model_id")
        if not mid:
            mid = f"m_{nxt:06d}"
            nxt += 1
        checks = []
        if not e:
            checks.append("NOT_IN_P5_RC1")
        elif b.fold(e["brand"] + e["model"]) != b.fold(m["brand"] + m["model"]):
            checks.append("BRAND_MODEL_MISMATCH_P5")
        if mid in reg and reg[mid]["slug"] != (e or {}).get("site_slug"):
            checks.append("EXISTING_ID_SLUG_MISMATCH")
        rows.append(dict(model_id=mid, p1_id=m["id"], site_slug=(e or {}).get("site_slug") or m["slug"], brand=m["brand"],
                         model=m["model"], brand_ar=(e or {}).get("ar", {}).get("brand") or "",
                         model_ar=(e or {}).get("ar", {}).get("model") or "", body=m.get("body") or "",
                         on_sale_u11="true", generation="UNKNOWN", identity_checks=";".join(checks)))
    for x in rc1.get("excluded", []):  # off-sale P2 records are retained, never served
        rows.append(dict(model_id=x["p2_model_id"], p1_id=x["p1_id"], site_slug=x["site_slug"],
                         brand=reg.get(x["p2_model_id"], {}).get("brand", ""), model=reg.get(x["p2_model_id"], {}).get("model_name", ""),
                         on_sale_u11="false", generation="UNKNOWN", identity_checks="U11_OFF_SALE"))
    for r in rows:
        r["universe"] = "U11_283" if r["on_sale_u11"] == "true" else "RETAINED_OFF_SALE"
    for d in market_universe()["identities"]:  # P2 market-universe decisions (config/market_universe.json); P1 untouched
        if d["decision"] not in ("ADDITION", "SPLIT"):
            continue
        old = next((r for r in rows if r["p1_id"] == d["id"]), None)
        if old:  # retained off-sale P2 record found on sale again: reinstate it, keeping its model_id
            old.update(universe="P2_" + d["decision"], identity_checks="", brand=d["brand"], model=d["model"], body=d.get("body", ""))
            continue
        mid = (prev.get(d["id"]) or {}).get("model_id")
        if not mid:
            mid = f"m_{nxt:06d}"
            nxt += 1
        rows.append(dict(model_id=mid, p1_id=d["id"], site_slug=d["id"].replace("/", "-"), brand=d["brand"], model=d["model"],
                         brand_ar="", model_ar="", body=d.get("body", ""), on_sale_u11="false", generation="UNKNOWN",
                         identity_checks="", universe="P2_" + d["decision"]))
    for k in ("model_id", "p1_id", "site_slug"):
        c = collections.Counter(r[k] for r in rows)
        for r in rows:
            if c[r[k]] > 1:
                r["identity_checks"] = ";".join(filter(None, [r["identity_checks"], "DUPLICATE_" + k.upper()]))
    for r in rows:
        r["id_status"] = "ACCEPTED" if not r["identity_checks"] else ("RETAINED_OFF_SALE" if r["identity_checks"] == "U11_OFF_SALE" else "REWORK")
        r["id_rule"] = "ID-1"
    return rows, U


# ------------------------------------------------------------------ market evidence (Tier B / C)

def latest_snap():
    s = sorted(glob.glob(os.path.join(ROOT, "snapshots", "U_*")))
    return s[-1] if s else None


def url_owner():
    own = {}
    for r in read(os.path.join(IN, "u11_source_urls.csv")):
        own[r["url"]] = r["p1_id"]
        if "contactcars" in r["url"]:  # model-year pages of the same ContactCars slug
            own["cc:" + r["url"].split("/")[5]] = r["p1_id"]
    ap = os.path.join(ROOT, "review", "market_universe_audit.csv")  # pages the universe audit resolved to a 283 model
    for r in (read(ap) if os.path.exists(ap) else []):
        if r["audit_class"] == "IN_283":
            for u in filter(None, r["page_urls"].split(" | ")):
                own.setdefault(u, r["identity"])
    for d in market_universe()["identities"]:  # additions own their pages; splits take theirs from the parent
        for u in d.get("urls", []):
            own[u] = d["id"]
            if "contactcars" in u:
                own["cc:" + u.split("/")[5]] = d["id"]
    return own


def split_of(p1, trim):
    """SPLIT identities that share a page with their parent: trims matching trim_regex belong to the split."""
    for d in market_universe()["identities"]:
        if d["decision"] == "SPLIT" and d["parent"] == p1 and d.get("trim_regex") and re.search(d["trim_regex"], trim or "", re.I):
            return d["id"]
    return p1


def owner_of(own, url):
    if url in own:
        return own[url]
    if "contactcars" in url:
        return own.get("cc:" + url.split("/")[5])
    return None


def market_obs(snaps):
    out, stated = [], []
    for snap in snaps:
        o, st = market_obs_one(snap)
        out += o
        stated += st
    return out, stated


def market_obs_one(snap):
    if not snap:
        return [], []
    own = url_owner()
    cells = {(c["source_url"], c["row_label"]): c for c in read(os.path.join(snap, "contactcars_pricetable_cells.csv"))}
    out = []
    for r in read(os.path.join(snap, "observations_parsed.csv")):
        p1 = owner_of(own, r["source_url"])
        p1 = split_of(p1, r["trim_raw"]) if p1 else p1
        if not p1 or r["source"] not in SITE:
            continue
        r = b.normalize_title(r)
        off = r["official_price"]
        if "pricetable" in r["source"]:
            c = cells.get((r["source_url"], f'{r["title_prefix"]} {r["model_year"]} {r["trim_raw"]}'.strip()))
            off = c["official_cell"] if c else ""
        v, st = b.parse_price(off)
        tk = b.trim_key(r["trim_raw"])
        if v is None or tk == "othertrims":
            continue
        out.append(dict(p1_id=p1, site=SITE[r["source"]], source=r["source"], url=r["source_url"], model_year=r["model_year"] or "",
                        trim_label=r["trim_raw"], trim_key=tk, price_egp=v, observed_at=day(r["fetched_at"]),
                        source_effective_date=r.get("effective_date") or "", page_sha256=r["page_sha256"]))
    yrs = collections.defaultdict(set)  # EgyCar pages carry no model year: join the cohort holding the same value
    for o in out:
        if o["model_year"]:
            yrs[(o["p1_id"], o["price_egp"])].add(o["model_year"])
    for o in [o for o in out if not o["model_year"]]:
        ys = sorted(yrs.get((o["p1_id"], o["price_egp"]), ()))
        if len(ys) == 1:
            o["model_year"] = ys[0]
    stated = []
    for r in read(os.path.join(snap, "price_changes_stated.csv")):
        p1 = owner_of(own, r["source_url"])
        p1 = split_of(p1, r.get("trim_raw") or r.get("title", "")) if p1 else p1
        v, _ = b.parse_price(r["new_price"])
        ov, _ = b.parse_price(r.get("old_price", ""))
        if p1 and v:
            stated.append(dict(p1_id=p1, model_year=r["model_year"], trim_key=b.trim_key(r["trim_raw"]), price_egp=v, old_price=ov,
                               effective_date=r["effective_date"], url=r["source_url"]))
    return out, stated


def tier_b(obs, stated):
    """Per (model, year): agreeing values across >=2 sites -> ACCEPT; disagreements -> REWORK; single site -> Tier C."""
    by = collections.defaultdict(list)
    for o in obs:
        by[(o["p1_id"], o["model_year"])].append(o)
    stated_by = collections.defaultdict(list)
    for x in stated:
        stated_by[(x["p1_id"], x["model_year"], x["trim_key"])].append(x)
    st = collections.defaultdict(list)
    for s in stated:
        st[(s["p1_id"], s["model_year"], s["price_egp"])].append(s)
    rows = []
    for (p1, yr), L in sorted(by.items()):
        sites = sorted({o["site"] for o in L})
        per = {s: [o for o in L if o["site"] == s] for s in sites}
        cnt = {s: collections.Counter(o["price_egp"] for o in per[s]) for s in sites}
        groups = collections.defaultdict(list)  # (trim_key or unique-value, price) -> obs
        for o in L:
            groups[(o["trim_key"], o["price_egp"])].append(o)
        done = set()
        for (tk, v), g in sorted(groups.items(), key=lambda x: (x[0][1], x[0][0])):
            gs = {o["site"] for o in g}
            basis = "trim_key_equal"
            if len(gs) < 2:  # same price, different label: accept only if the value is unique in every site's cohort
                same_v = [o for o in L if o["price_egp"] == v]
                vs = {o["site"] for o in same_v}
                if len(vs) >= 2 and all(cnt[s][v] == 1 for s in vs):
                    g, gs, basis = same_v, vs, "value_unique_in_cohort"
            ids = tuple(sorted(id(o) for o in g))
            if ids in done:
                continue
            done.add(ids)
            other = [o for o in L if o["trim_key"] == tk and o["price_egp"] != v and o["site"] not in gs]
            cc = next((o for o in g if o["site"] == "ContactCars"), g[0])
            dates = sorted({s["effective_date"] for s in st[(p1, yr, v)] if s["trim_key"] == tk or basis != "trim_key_equal"}
                           | {o["source_effective_date"] for o in g if o["source_effective_date"]})
            latest = max((x for x in stated_by.get((p1, yr, tk), [])), key=lambda x: x["effective_date"], default=None)
            if len(gs) >= 2 and not other and latest and latest["price_egp"] != v and latest["effective_date"] > max(o["observed_at"] for o in g):
                status, tier, reason = "REWORK", "B", f'PB-3 later stated change {latest["effective_date"]} -> {latest["price_egp"]}'
            elif len(gs) >= 2 and not other:
                status, tier, reason = "ACCEPT", "B", f"PB-1 {len(gs)} sites agree ({basis})"
            elif other:
                status, tier, reason = "REWORK", "B" if len(gs) >= 2 else "C", \
                    "PB-2 CONFLICT: " + ";".join(sorted({f'{o["site"]}={o["price_egp"]}' for o in other}))
            else:
                status, tier, reason = "REWORK", "C", "PB-2 single site"
            rows.append(dict(p1_id=p1, model_year=yr, trim_label=cc["trim_label"], trim_key=tk, price_egp=v,
                             effective_date=dates[-1] if dates else "", date_basis="SOURCE_STATED" if dates else "OBSERVED",
                             as_of=max(o["observed_at"] for o in g), issuer="+".join(sorted(gs)), tier=tier,
                             evidence_url=" | ".join(sorted({o["url"] for o in g})),
                             evidence_ref=" | ".join(sorted({o["page_sha256"][:16] for o in g})),
                             observed_at=max(o["observed_at"] for o in g), confidence="MEDIUM" if status == "ACCEPT" else "LOW",
                             status=status, reason=reason, sites=len(gs)))
    # a value that is accepted for a trim cannot also be a 'single site' row of the same trim
    acc = {(r["p1_id"], r["model_year"], r["price_egp"]) for r in rows if r["status"] == "ACCEPT"}
    return [r for r in rows if r["status"] == "ACCEPT" or (r["p1_id"], r["model_year"], r["price_egp"]) not in acc]


# ------------------------------------------------------------------ official evidence (Tier A)

def tier_a(market, stated=()):
    rows = []
    rng = collections.defaultdict(list)
    for o in market:
        rng[o["p1_id"]].append(o["price_egp"])
    for path in sorted(glob.glob(os.path.join(IN, "official", "*.official_observations.csv"))):
        snap = os.path.basename(path).split(".")[0]
        obs = [r for r in read(path) if r["field"] in ("price_official_egp", "price_from_official_egp") and r["universe_id"] and r["value_num"]]
        rep = collections.Counter((r["universe_id"], r["value_num"]) for r in obs if r["field"] == "price_official_egp")
        for r in obs:
            v = int(float(r["value_num"]))
            p1 = r["universe_id"]
            reason, status = "PA-1 official Egypt source, HIGH", "ACCEPT"
            m = rng.get(p1)
            if r["confidence"] != "HIGH":
                status, reason = "REWORK", f"PA-1 confidence {r['confidence']}" + (f": {r['note']}" if r["note"] else "")
            elif r["field"] == "price_official_egp" and rep[(p1, r["value_num"])] >= 3:
                status, reason = "REWORK", "PA-1 same value on >=3 trims (parser-suspect)"
            elif m and not ((1 - DIVERGENCE) * min(m) <= v <= (1 + DIVERGENCE) * max(m)):
                status, reason = "REWORK", f"PA-1 outside +/-25% of market official range {min(m)}-{max(m)}"
            later = sorted((x["effective_date"], x["price_egp"]) for x in stated if x["p1_id"] == p1 and x.get("old_price") == v
                           and x["price_egp"] != v and x["effective_date"] >= r["fetched_at"][:10])
            if status == "ACCEPT" and later:  # PA-2: the official value is the pre-change price of a stated, dated change
                status, reason = "REWORK", f"PA-2 market source states change {v} -> {later[-1][1]} effective {later[-1][0]} (official page observed {r['fetched_at'][:10]})"
            rows.append(dict(p1_id=p1, model_year=r["model_year"], trim_label=r["trim_raw"] or "(from price)",
                             trim_key=b.trim_key(r["trim_raw"]) if r["trim_raw"] else "_from", price_egp=v,
                             effective_date=r["effective_date"], date_basis="SOURCE_STATED" if r["effective_date"] else "OBSERVED",
                             as_of=r["fetched_at"][:10], issuer=r["source"], tier="A", evidence_url=r["source_url"],
                             evidence_ref=f'{snap}:{r["page_sha256"][:16]}:{r["evidence_pointer"]}', observed_at=r["fetched_at"][:10],
                             confidence=r["confidence"], status=status, reason=reason, sites=1,
                             kind="from" if r["field"] == "price_from_official_egp" else "trim"))
    manual = read(os.path.join(ROOT, "registry", "price_evidence_manual.csv"))
    for r in manual:
        v = int(r["price_egp"])
        m = rng.get(r["p1_id"])
        doc = {int(x["price_egp"]) for x in manual if x["p1_id"] == r["p1_id"] and x["evidence_ref"] == r["evidence_ref"]}
        later = sorted({s["effective_date"] for s in stated if s["p1_id"] == r["p1_id"] and s["effective_date"] > (r["effective_date"] or "9")
                        and s["price_egp"] not in doc})  # a later change to a value the document already states corroborates it
        srcs = [u for u in (r["evidence_url"] or "").split(" | ") if u]
        if r["tier"] == "B" and len({u.split("/")[2] for u in srcs}) >= 2 and not later:
            status, reason = "ACCEPT", f"PB-M {len({u.split('/')[2] for u in srcs})} independent dated sources state the identical value"
        elif r["tier"] != "A":
            status, reason = "REWORK", f"Tier {r['tier']}: single media/dealer/social report; review only"
        elif later:
            status, reason = "REWORK", f"PA-2 market source states a later official price change ({later[-1]}) than the document date"
        elif m and not ((1 - DIVERGENCE) * min(m) <= v <= (1 + DIVERGENCE) * max(m)):
            status, reason = "REWORK", f"PA-1 outside +/-25% of market official range {min(m)}-{max(m)}"
        else:
            status, reason = "ACCEPT", "PA-1 official importer/distributor document"
        rows.append(dict(r, price_egp=v, trim_key=b.trim_key(r["trim_label"]), sites=max(1, len({u.split("/")[2] for u in srcs})), kind=r.get("kind") or "trim",
                         status=status, reason=reason + (f"; {r['note']}" if r.get("note") else "")))
    return rows


def supersede(a_rows, b_rows):
    a_ok = collections.defaultdict(set)
    for r in a_rows:
        if r["status"] == "ACCEPT" and r["kind"] == "trim":
            a_ok[r["p1_id"]].add(r["price_egp"])
    a_by = collections.defaultdict(list)
    for r in a_rows:
        if r["status"] == "ACCEPT" and r["kind"] == "trim":
            a_by[r["p1_id"]].append(r)
    for r in b_rows:  # PS-2: a newer-dated market value close to an official value but different -> official trim REWORK
        if r["status"] != "ACCEPT" or r["date_basis"] != "SOURCE_STATED" or r["p1_id"] not in a_by:
            continue
        near = min(a_by[r["p1_id"]], key=lambda a: abs(a["price_egp"] - r["price_egp"]))
        d = abs(near["price_egp"] - r["price_egp"])
        if b.NEAR_AGREEMENT_EGP < d <= 0.05 * near["price_egp"] and r["effective_date"] > (near["effective_date"] or near["as_of"]):
            near["status"] = "REWORK"
            near["reason"] = f'PS-2 CONFLICT: {r["issuer"]} states {r["price_egp"]} effective {r["effective_date"]} (newer than official {near["effective_date"] or "undated"})'
    a_ok = collections.defaultdict(set)
    for r in a_rows:
        if r["status"] == "ACCEPT" and r["kind"] == "trim":
            a_ok[r["p1_id"]].add(r["price_egp"])
    for r in b_rows:
        if r["p1_id"] in a_ok and r["status"] == "ACCEPT":
            r["status"] = "CORROBORATES_TIER_A" if r["price_egp"] in a_ok[r["p1_id"]] else "SUPERSEDED_BY_TIER_A"
            r["reason"] += "; PS-1"
    return a_rows + b_rows


# ------------------------------------------------------------------ specs, warranty, brochures, media

SERVE_PREFIX = "/media/p2/"  # established P5 route (a6d3f0b): release verbatim + vehicle-data/media/{models,brands} -> web/public/media/p2/

KNOWN_CONFLICTS = {  # evidence-level conflicts recorded in AT-51; never promoted until resolved
    ("mg/hs", "power_hp"): "SP-1 CONFLICT: MG Egypt HS page prose 221 hp vs spec table 200 hp (hybrid)",
}
CORE_SPECS = {"power_hp", "system_power_hp", "motor_power_hp", "motor_power_kw", "torque_nm", "system_torque_nm", "motor_torque_nm",
              "engine", "engine_cc", "transmission", "length_mm", "wheelbase_mm", "seats", "kerb_weight_kg", "fuel_tank_l",
              "battery_kwh", "ev_range_km", "ground_clearance_mm", "airbags", "drive", "boot_l", "fuel_consumption_l100"}


def spec_facts():
    """SP-1: official Egypt page (O4, HIGH) or accepted Egypt brochure/price-list facts; differing values for the same
    model+field+applicability -> REWORK (CONFLICT)."""
    f = []
    for r in read(os.path.join(ROOT, "registry", "spec_facts.csv")):
        f.append(dict(p1_id=r["p1_id"], field=r["field"], value=r["value"], unit=r["unit"], applicability=r["applicability"],
                      source=f'drive:{r["source_drive_id"]}', issuer=r["source_issuer"], tier="A",
                      status="ACCEPT" if r["status"] == "ACCEPT" else "REWORK", reason="SP-1 Egypt brochure/price list"))
    for path in sorted(glob.glob(os.path.join(IN, "official", "*.official_observations.csv"))):
        for r in read(path):
            if r["field"].startswith("price") or not r["universe_id"]:
                continue
            ok = r["confidence"] == "HIGH"
            f.append(dict(p1_id=r["universe_id"], field=r["field"], value=r["value_raw"], unit=r["unit"],
                          applicability=" / ".join(filter(None, [re.sub(r"^.*page variant: ", "", r["note"]) if "page variant" in r["note"] else "",
                                                                  r["trim_raw"]])) or
                                        ("grade-scoped (one grade shown)" if "ONE grade" in r["note"] else "model page"),
                          source=r["source_url"], issuer=r["source"], tier="A", status="ACCEPT" if ok else "REWORK",
                          reason="SP-1 official Egypt page" if ok else f'SP-1 confidence {r["confidence"]}'))
    f += market_spec_facts()
    seen = {}
    for x in f:  # same fact from two pages (e.g. page variants) collapses; different values conflict
        seen.setdefault((x["p1_id"], x["field"], x["applicability"]), set()).add(x["value"].strip().lower())
    out, dedup = [], set()
    for x in f:
        k = (x["p1_id"], x["field"], x["applicability"])
        if (k, x["value"]) in dedup:
            continue
        dedup.add((k, x["value"]))
        if (x["p1_id"], x["field"]) in KNOWN_CONFLICTS and "hybrid" in x["applicability"].lower():
            x["status"], x["reason"] = "REWORK", KNOWN_CONFLICTS[(x["p1_id"], x["field"])]
        elif len(seen[k]) > 1 and x["status"] == "ACCEPT":
            x["status"], x["reason"] = "REWORK", "SP-1 CONFLICT: " + " vs ".join(sorted(seen[k]))
        out.append(x)
    return out


SP2_FIELDS = {"horsepower": "power_hp", "torque": "torque_nm", "engine_cc": "engine_cc", "seats": "seats", "length": "length_mm",
              "width": "width_mm", "height": "height_mm", "wheelbase": "wheelbase_mm", "ground_clearance": "ground_clearance_mm",
              "trunk": "boot_l", "fuel_tank": "fuel_tank_l", "battery_capacity": "battery_kwh"}


SP2_CATEGORICAL = {  # (site, label) -> (attribute, {site wording (lower) -> shared class})
    ("ContactCars", "vehicleTransmission"): ("transmission", {"automatic": "Automatic", "dual clutch": "DCT", "cvt": "CVT", "manual": "Manual"}),
    ("Hatla2ee", "Transmission"): ("transmission", {"automatic": "Automatic", "dsg": "DCT", "cvt": "CVT", "manual": "Manual"}),
    ("ContactCars", "Drivetrain Type"): ("drive", {"fwd (front-wheel drive)": "FWD", "rwd (rear-wheel drive)": "RWD",
                                                  "awd (all-wheel drive)": "AWD/4WD", "4wd (four-wheel drive)": "AWD/4WD"}),
    ("Hatla2ee", "Traction Type"): ("drive", {"front traction": "FWD", "back traction": "RWD", "four-wheel drive": "AWD/4WD"}),
    ("ContactCars", "fuelType"): ("powertrain_class", {"gas": "Petrol", "diesel": "Diesel", "electric": "Electric", "hybrid": "Hybrid",
                                                       "plug-in hybrid": "Plug-in hybrid"}),
    ("Hatla2ee", "Fuel Type"): ("powertrain_class", {"gas": "Petrol", "electric": "Electric", "hybrid": "Hybrid", "plug-in hybrid": "Plug-in hybrid",
                                                     "phev": "Plug-in hybrid"}),
}


def market_spec_facts():
    """SP-2: a numeric spec value is accepted for a model only when ContactCars AND Hatla2ee trim pages of the same model
    (latest U11 spec snapshot) state the identical value; one-site values are not promoted. Applicability = the trims
    carrying it on ContactCars."""
    snaps = sorted(glob.glob(os.path.join(ROOT, "snapshots", "US_*")))
    if not snaps:
        return []
    sa = sorted(glob.glob(os.path.join(ROOT, "snapshots", "USA_*")))  # universe-audit trim pages (models beyond the 283)
    return [f for s in [snaps[-1]] + sa[-1:] for f in market_spec_facts_one(s)]


def market_spec_facts_one(snap):
    snaps = [snap]
    own = url_owner()
    attr = {(r["source"], r["spec_label"]): r["attribute"] for r in read(os.path.join(ROOT, "crosswalk", "spec_fields.csv"))}
    vals = collections.defaultdict(lambda: collections.defaultdict(set))
    trims = collections.defaultdict(set)
    for r in read(os.path.join(snaps[-1], "specs_parsed.csv")):
        u = r["trim_url"]
        p1 = owner_of(own, u) if "contactcars" in u else own.get(u.rsplit("/", 1)[0])
        p1 = split_of(p1, r.get("trim_raw") or r.get("title", "")) if p1 else p1  # split identities take the trims they own (Hatla2ee: trim in title)
        a = SP2_FIELDS.get(attr.get((r["source"], r["spec_label"])))
        m = re.search(r"\d[\d,]*(\.\d+)?", r["value"] or "")
        if not (p1 and a and m):
            continue
        v = m.group(0).replace(",", "")
        v = v.rstrip("0").rstrip(".") if "." in v else v
        vals[(p1, a, v)][r["source"]].add(u)
        if r["source"] == "ContactCars" and r.get("trim_raw"):
            trims[(p1, a, v)].add(r["trim_raw"])
    # categorical SP-2: each site's wording normalized to one class; accepted only when both sites state the same class
    for r in read(os.path.join(snaps[-1], "specs_parsed.csv")):
        nz = SP2_CATEGORICAL.get((r["source"], r["spec_label"]))
        if not nz:
            continue
        u = r["trim_url"]
        p1 = owner_of(own, u) if "contactcars" in u else own.get(u.rsplit("/", 1)[0])
        p1 = split_of(p1, r.get("trim_raw") or r.get("title", "")) if p1 else p1
        v = nz[1].get((r["value"] or "").strip().lower())
        if p1 and v:
            vals[(p1, nz[0], v)][r["source"]].add(u)
            if r["source"] == "ContactCars" and r.get("trim_raw"):
                trims[(p1, nz[0], v)].add(r["trim_raw"])
    # warranty: ContactCars 'Basic Vehicle Warranty' text vs Hatla2ee years + km on trim pages of the same model
    words = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "ten": 10}
    hy, hk = {}, {}
    for r in read(os.path.join(snaps[-1], "specs_parsed.csv")):
        u = r["trim_url"]
        p1 = owner_of(own, u) if "contactcars" in u else own.get(u.rsplit("/", 1)[0])
        if not p1:
            continue
        if r["spec_label"] == "Basic Vehicle Warranty":
            t = r["value"].lower()
            y = re.search(r"(\d+|two|three|four|five|six|seven|eight|ten)\s*(years?|سنوات|سنة)", t)
            k = re.search(r"(\d[\d,]*)\s*(?:,000)?\s*(km|kms|ألف)", t)
            if y and k:
                yv = int(words.get(y.group(1), y.group(1)))
                kv = int(k.group(1).replace(",", ""))
                kv = kv * 1000 if kv < 1000 else kv
                vals[(p1, "warranty", f"{yv} years / {kv} km")]["ContactCars"].add(u)
        elif r["spec_label"] in ("Vehicle Warranty (Years)", "Vehicle Warranty (km)"):
            (hy if "Years" in r["spec_label"] else hk).setdefault(u, r["value"].replace(",", "").strip())
    for u, y in hy.items():
        p1 = own.get(u.rsplit("/", 1)[0])
        if p1 and y.isdigit() and hk.get(u, "").isdigit():
            vals[(p1, "warranty", f"{int(y)} years / {int(hk[u])} km")]["Hatla2ee"].add(u)
    out = []
    for (p1, a, v), by in sorted(vals.items()):
        if {"ContactCars", "Hatla2ee"} <= set(by):
            out.append(dict(p1_id=p1, field=a, value=v, unit="", tier="B", status="ACCEPT",
                            applicability="market trim pages: " + (", ".join(sorted(trims[(p1, a, v)]))[:120] or "model"),
                            source=" | ".join(sorted(by["ContactCars"]))[:300], issuer="ContactCars+Hatla2ee",
                            reason=f"SP-2 identical value on 2 sites ({os.path.basename(snaps[-1])})"))
    return out


def media_accepted():
    return read(os.path.join(ROOT, "registry", "media_accepted.csv"))


# ------------------------------------------------------------------ assemble

def price_view(rows):
    acc = [r for r in rows if r["status"] == "ACCEPT"]
    if not acc:
        return None
    trims = [r for r in acc if r.get("kind", "trim") == "trim"]
    years = [int(r["model_year"]) for r in trims if str(r["model_year"]).isdigit()]
    ly = max(years) if years else None
    cohort = [r for r in trims if ly is None or str(r["model_year"]) == str(ly)] or trims
    frm = [r for r in acc if r.get("kind") == "from"]
    base = min(cohort or frm, key=lambda r: r["price_egp"])
    return dict(price_from=base["price_egp"], model_year=ly, tier=base["tier"], effective_date=base["effective_date"] or None,
                date_basis=base["date_basis"], as_of=base["as_of"], issuer=base["issuer"], evidence_url=base["evidence_url"],
                trims=[dict(model_year=int(r["model_year"]) if str(r["model_year"]).isdigit() else None, label=r["trim_label"],
                            price_egp=r["price_egp"], tier=r["tier"], effective_date=r["effective_date"] or None,
                            date_basis=r["date_basis"], as_of=r["as_of"], issuer=r["issuer"], evidence_url=r["evidence_url"])
                       for r in sorted(trims, key=lambda r: (str(r["model_year"]), r["price_egp"]))])


def counts(models):
    return dict(models=len(models), id_accepted=sum(m["id_status"] == "ACCEPTED" for m in models),
                price_accepted=sum(bool(m["price"]) for m in models),
                price_tier_a=sum(bool(m["price"]) and m["price"]["tier"] == "A" for m in models),
                price_source_dated=sum(bool(m["price"]) and m["price"]["date_basis"] == "SOURCE_STATED" for m in models),
                market_status_official=sum(m["market_status"] == "official" for m in models),
                specs_accepted=sum(m["specs_accepted"] for m in models),
                warranty_accepted=sum(bool(m["warranty"]) for m in models),
                brochure_accepted=sum(bool(m["brochures"]) for m in models),
                hero_accepted=sum(bool(m["hero_image"]) for m in models),
                hero_accepted_hq=sum(bool(m["hero_image"]) and m["hero_image"]["quality_class"] == "HQ" for m in models),
                hero_limited_archive=sum(bool(m["hero_image_limited"]) and not m["hero_image"] for m in models),
                gallery_models=sum(bool(m["gallery"]) for m in models),
                logo_accepted=sum(bool(m["logo"]) for m in models),
                fully_enriched=sum(bool(m["price"] and m["specs_accepted"] and m["warranty"] and m["brochures"]
                                        and m["hero_image"] and m["logo"]) for m in models))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snap", default=None)
    ap.add_argument("--as-of", default=None)
    a = ap.parse_args()
    snap = a.snap or latest_snap()
    ids, U = identity()
    write(os.path.join(ROOT, "registry", "u11_models.csv"),
          ["model_id", "p1_id", "site_slug", "brand", "model", "brand_ar", "model_ar", "body", "on_sale_u11", "generation",
           "id_status", "id_rule", "identity_checks", "universe"], ids)
    ua = sorted(glob.glob(os.path.join(ROOT, "snapshots", "UA_*")))  # universe-audit pages (models beyond the 283)
    snaps = [x for x in (snap, ua[-1] if ua else None) if x]
    mobs, stated = market_obs(snaps)
    a_rows = tier_a(mobs, stated)
    rows = supersede(a_rows, tier_b(mobs, stated))
    byid = {r["p1_id"]: r for r in ids}
    for r in rows:
        r["model_id"] = byid.get(r["p1_id"], {}).get("model_id", "")
        r["price_id"] = hashlib.sha256(f'{r["p1_id"]}|{r["model_year"]}|{r["trim_key"]}|{r["price_egp"]}|{r["tier"]}|{r["issuer"]}'.encode()).hexdigest()[:12]
    rows.sort(key=lambda r: (r["p1_id"], r["tier"], str(r["model_year"]), r["price_egp"], r["issuer"]))
    write(os.path.join(ROOT, "registry", "u11_prices.csv"),
          ["price_id", "model_id", "p1_id", "model_year", "trim_label", "trim_key", "price_egp", "effective_date", "date_basis",
           "as_of", "issuer", "tier", "evidence_url", "evidence_ref", "observed_at", "confidence", "status", "reason", "sites"], rows)
    official_models = {r["p1_id"] for r in a_rows if r["tier"] == "A" and r["issuer"].endswith("_eg_web")}
    per = collections.defaultdict(list)
    for r in rows:
        per[r["p1_id"]].append(r)
    as_of = a.as_of or (os.path.basename(snap).split("_")[1] if snap else "")
    facts = spec_facts()
    write(os.path.join(ROOT, "registry", "u11_spec_facts.csv"),
          ["p1_id", "field", "value", "unit", "applicability", "issuer", "tier", "source", "status", "reason"],
          sorted(facts, key=lambda x: (x["p1_id"], x["field"], x["applicability"], x["value"])))
    fby = collections.defaultdict(list)
    for x in facts:
        fby[x["p1_id"]].append(x)
    bro = collections.defaultdict(list)
    for r in read(os.path.join(ROOT, "registry", "brochures.csv")):
        if r["status"] == "ACCEPT":
            bro[r["p1_id"]].append(dict(drive_id=r["drive_id"] or None, title=r["title"], issuer=r["issuer"], scope=r["variant_scope"],
                                        url=r.get("url") or f'https://drive.google.com/file/d/{r["drive_id"]}/view'))
    med = collections.defaultdict(list)
    for r in media_accepted():
        med[r["owner"]].append(r)
    models, cov = [], []
    for m in [r for r in ids if in_catalogue(r)]:
        pr = per.get(m["p1_id"], [])
        pv = price_view(pr)
        fx = fby.get(m["p1_id"], [])
        acc = [x for x in fx if x["status"] == "ACCEPT"]
        specs = {}
        for x in sorted(acc, key=lambda x: (x["field"], x["applicability"], x["value"])):
            specs.setdefault(x["field"], []).append(dict(value=x["value"], unit=x["unit"], applicability=x["applicability"],
                                                         issuer=x["issuer"], source=x["source"]))
        warranty = specs.pop("warranty", None)
        wpol = [w for w in (warranty or []) if w["applicability"] == "official brand warranty policy"]
        wown = [w for w in (warranty or []) if w["applicability"] != "official brand warranty policy"]
        policy_conflict = []
        if wpol and wown:  # brand policy only fills a gap; a differing model-specific term is a documented conflict
            if {w["value"].split(" / ")[0] for w in wpol} != {w["value"].split(" / ")[0] for w in wown} or \
               any("km" in w["value"] for w in wown) and {w["value"] for w in wpol} - {w["value"] for w in wown}:
                policy_conflict = [f'warranty: brand policy {wpol[0]["value"]} ({wpol[0]["issuer"]}) differs from model-specific {", ".join(sorted({w["value"] for w in wown}))}']
            warranty = wown
        spec_ok = len(CORE_SPECS & set(specs)) >= 3
        pts = {x["value"] for x in specs.get("powertrain_class", [])}
        if not pts:
            cfg = {d["id"]: d for d in market_universe()["identities"] if d["decision"] in ("ADDITION", "SPLIT")}.get(m["p1_id"], {})
            pts = set(cfg.get("powertrains", [])) if len(cfg.get("powertrains", [])) == 1 else set()
        if pv and len(pts) == 1:  # per-version powertrain: the model has one accepted powertrain (splits separate the others)
            pv = dict(pv, trims=[dict(t, powertrain=next(iter(pts))) for t in pv.get("trims", [])], powertrain_basis=
                      "model has a single accepted powertrain (specs powertrain_class or P2 identity decision)")
        def asset(x):  # IM-1: P5 serves local files only; src is set once the verified bytes are materialized
            d = {k: x[k] for k in ("asset_id", "sha256", "width", "height", "quality_class", "url", "page", "rights_basis", "status")}
            d["src"] = SERVE_PREFIX + x["local_path"].split("media/", 1)[1] if x.get("local_path") and os.path.exists(os.path.join(ROOT, x["local_path"])) else None
            d["credit"] = x.get("credit") or (re.sub(r"^https?://(www\.)?([^/]+).*$", r"\2", x["page"] or x["url"])
                                              if "drive.google" not in x["url"] else "CarIndex archive")
            return d
        logo = next((asset(x) for x in med.get(m["brand"], []) if x["kind"] == "logo" and x["status"] == "ACCEPT"), None)
        hero = next((asset(x) for x in med.get(m["p1_id"], []) if x["kind"] == "hero" and x["status"] == "ACCEPT"), None)
        hero_limited = next((asset(x) for x in med.get(m["p1_id"], []) if x["kind"] == "hero" and x["status"] == "ACCEPT_LIMITED"), None)
        gallery = [asset(x) for x in med.get(m["p1_id"], []) if x["kind"] == "gallery" and x["status"] == "ACCEPT"]
        conflicts = sorted(set(policy_conflict) | {r["reason"] for r in pr if r["status"] == "REWORK" and "CONFLICT" in r["reason"]} |
                           {f'{x["field"]}: {x["reason"]}' for x in fx if "CONFLICT" in x["reason"]})
        gaps = [g for g, ok in (("NO_ACCEPTED_PRICE", pv), ("NO_ACCEPTED_SPECS", spec_ok), ("NO_OFFICIAL_BROCHURE", bro.get(m["p1_id"])),
                                ("NO_VERIFIED_HERO_IMAGE", hero), ("NO_OFFICIAL_LOGO", logo), ("NO_VERIFIED_WARRANTY", warranty),
                                ("GENERATION_UNKNOWN", False)) if not ok]
        sc = size_class().get(m["p1_id"])
        if not sc and "length_mm" in specs:  # accepted length when no registration segment exists
            sc = dict(segment=None, length_mm=specs["length_mm"][0]["value"], basis="length_mm accepted (see specs)", confidence="HIGH")
        if not sc and single_length().get(m["p1_id"]):  # classification input only; never promoted to specs
            v, n, src = single_length()[m["p1_id"]]
            sc = dict(segment=None, length_mm=v, basis=f"single market source, {n} trim page(s) agree ({src})", confidence="MEDIUM_SINGLE_SOURCE")
        rec = dict(model_id=m["model_id"], p1_id=m["p1_id"], site_slug=m["site_slug"], brand=m["brand"], model=m["model"], size_class=sc,
                   id_status=m["id_status"], generation=None, market_status="official" if m["p1_id"] in official_models else "unverified",
                   market_status_basis="model listed on official Egypt OEM/importer page (O4)" if m["p1_id"] in official_models
                   else ("U11 on-sale (registrations + market listings); no official Egypt page captured yet" if m["universe"] == "U11_283"
                         else "P2 market-universe decision (config/market_universe.json); see review/market_universe_audit.csv"),
                   universe=m["universe"],
                   price=pv, specs=specs or None, specs_accepted=spec_ok, warranty=warranty, brochures=bro.get(m["p1_id"], []),
                   logo=logo, hero_image=hero, hero_image_limited=hero_limited, gallery=gallery,
                   conflicts=conflicts, gaps=gaps, rework_price_rows=sum(r["status"] == "REWORK" for r in pr))
        models.append(rec)
        cov.append(dict(model_id=m["model_id"], p1_id=m["p1_id"], brand=m["brand"], model=m["model"], universe=m["universe"], id_status=m["id_status"],
                        market_status=rec["market_status"],
                        price_status="ACCEPTED" if pv else ("REWORK" if pr else "NO_EVIDENCE"),
                        price_from_egp=pv["price_from"] if pv else "", price_model_year=(pv or {}).get("model_year") or "",
                        price_tier=pv["tier"] if pv else "", price_effective_date=(pv or {}).get("effective_date") or "",
                        price_date_basis=pv["date_basis"] if pv else "", accepted_trims=len(pv["trims"]) if pv else 0,
                        specs_status="ACCEPTED" if spec_ok else ("PARTIAL" if specs else "UNKNOWN"), spec_fields=len(specs),
                        brochure_status="ACCEPTED" if bro.get(m["p1_id"]) else "NONE", hero_status="ACCEPTED" if hero else ("ACCEPTED_LIMITED" if hero_limited else "NONE"),
                        hero_quality=(hero or hero_limited or {}).get("quality_class", ""),
                        gallery_count=len(gallery), logo_status="ACCEPTED" if logo else "NONE",
                        warranty=" | ".join(sorted({w["value"] for w in warranty})) if warranty else "",
                        evidence_links=(pv or {}).get("evidence_url", ""), conflicts=" | ".join(conflicts),
                        missing=";".join(gaps), last_verified=as_of))
    canon = dict(schema="carindex.p2.canonical/v1", generated_as_of=as_of, market_snapshot=os.path.relpath(snap, ROOT) if snap else None,
                 rules=__doc__.split("Acceptance rules")[1].strip(),
                 inputs={os.path.relpath(p, ROOT): sha(p) for p in sorted(glob.glob(os.path.join(IN, "**", "*.*"), recursive=True))
                         if not p.endswith(".md")},
                 counts=counts([m for m in models if m["universe"] == "U11_283"]),
                 counts_market_universe=counts(models),
                 market_snapshots=[os.path.relpath(x, ROOT) for x in snaps],
                 models=models)
    json.dump(canon, open(os.path.join(ROOT, "views", "canonical_u11.json"), "w"), indent=1, ensure_ascii=False, sort_keys=True)
    write(os.path.join(ROOT, "review", "u11_coverage.csv"), list(cov[0].keys()), cov)
    serving(canon)
    print(json.dumps(canon["counts"]))


def serving(canon):
    """Same contract as P5 RC1 (all RC1 entry fields kept, same order); accepted P2 data added as optional fields."""
    rc1 = json.load(open(os.path.join(IN, "catalogue-serving.RC1.json")))
    by = {m["p1_id"]: m for m in canon["models"]}
    mu = {d["id"]: d for d in sorted(market_universe()["identities"], key=lambda d: d["decision"] in ("ADDITION", "SPLIT"))}

    def pub(h, flags):  # P5 read-model p2Hero(): {src:'/media/...', credit, source_url}; it ignores flags
        return dict(src=h["src"], credit=h["credit"], source_url=h["page"] or h["url"], image_url=h["url"], flags=flags,
                    status=h["status"], quality_class=h["quality_class"], sha256=h["sha256"]) if h and h["src"] else None
    entries = []
    for e in rc1["entries"]:
        c = by[e["p1_id"]]
        e = dict(e, p2_model_id=c["model_id"], id_status="P2_ACCEPTED" if c["id_status"] == "ACCEPTED" else "P2_REWORK",
                 price_status="ACCEPTED" if c["price"] else e["price_status"] if e["evidence_state"] == "P2_S6_EVIDENCE" else "UNKNOWN",
                 missing_evidence=[g for g in c["gaps"]] + ([] if c["id_status"] == "ACCEPTED" else ["P2_ID_PENDING"]))
        e["accepted"] = dict(market_status=c["market_status"], size_class=c["size_class"], price=c["price"], specs=c["specs"], warranty=c["warranty"],
                             brochures=c["brochures"], logo=pub(c["logo"], []),
                             hero_image=pub(c["hero_image"], []),
                             hero_image_limited=pub(c["hero_image_limited"], ["PHOTO_NEEDS_ENRICHMENT", "ORIGIN_UNVERIFIED"]),
                             gallery=[g for g in c["gallery"] if g["src"]],
                             conflicts=c["conflicts"])
        entries.append(e)
    rel = dict(rc1, release_id=f"P2-CATALOGUE-U11-{canon['generated_as_of']}-RC2", state="VERIFYING",
               acceptance="P2_ACCEPTED_FIELDS_ONLY", generated_as_of=canon["generated_as_of"],
               evidence_authority=dict(schema=canon["schema"], path="vehicle-data/views/canonical_u11.json",
                                       market_snapshot=canon["market_snapshot"], counts=canon["counts"]),
               relation="Website on-sale set equals pinned U11 on-sale set (283). 'accepted' carries only P2-ACCEPTED values; "
                        "absent means UNKNOWN. P1 recommendation semantics unchanged.",
               counts=dict(rc1["counts"], price_accepted=canon["counts"]["price_accepted"], id_accepted=canon["counts"]["id_accepted"]),
               entries=entries,
               market_additions=[dict(p1_id=None, p2_model_id=c["model_id"], identity=c["p1_id"], site_slug=c["site_slug"], brand=c["brand"],
                                      model=c["model"], universe=c["universe"], parent=mu.get(c["p1_id"], {}).get("parent"),
                                      body=mu.get(c["p1_id"], {}).get("body"), powertrains=mu.get(c["p1_id"], {}).get("powertrains", []),
                                      evidence=mu.get(c["p1_id"], {}).get("evidence", []),
                                      accepted=dict(market_status=c["market_status"], size_class=c["size_class"], price=c["price"], specs=c["specs"],
                                                    warranty=c["warranty"], brochures=c["brochures"], logo=pub(c["logo"], []),
                                                    hero_image=pub(c["hero_image"], []), gallery=[g for g in c["gallery"] if g["src"]],
                                                    conflicts=c["conflicts"]),
                                      missing_evidence=c["gaps"])
                                 for c in canon["models"] if c["universe"] != "U11_283"])
    json.dump(rel, open(os.path.join(ROOT, "views", "catalogue-serving.release.json"), "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
