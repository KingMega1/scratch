#!/usr/bin/env python3
"""Official lineup discovery/change detection. Existing P2 worker; stage only, no model/price promotion."""
import argparse, hashlib, json, re, time
from pathlib import Path
from html import unescape
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

def extract(source, html):
    # Source-specific URL matching; never infer canonical IDs from display names.
    kind = source["kind"]
    links = re.findall(r'href=["\']([^"\']+)["\']', html, re.I)
    candidates = {}
    if kind == "smart":
        for key in set(re.findall(r"smart\s*(?:#|&#35;)([135])", unescape(html), re.I)):
            candidates[key] = source["url"]
    else:
        pattern = r"/vehicles/new/([^/.]+)\.html" if kind == "nissan" else r"/vehicle-models/([^/?#]+)"
        for link in links:
            absolute = urljoin(source["url"], unescape(link))
            if urlparse(absolute).hostname != urlparse(source["url"]).hostname:
                continue
            match = re.search(pattern, urlparse(absolute).path)
            if match:
                candidates[match.group(1)] = absolute
    return [{"source_key":key,"p1_id":source.get("aliases",{}).get(key),
             "source_url":url,"brand":source["brand"],
             "identity_state":"EXPLICIT_ALIAS" if key in source.get("aliases",{}) else "P2_IDENTITY_REVIEW"}
            for key,url in sorted(candidates.items())]

def changes(current, previous):
    events = []
    old_sources = {s["url"]:s for s in previous.get("sources",[])}
    for source in current["sources"]:
        prev = old_sources.get(source["url"])
        if source["status"] != "OK":
            events.append({"event":"SOURCE_HEALTH","source_url":source["url"],"status":source["status"]})
            continue  # A failed/empty fetch cannot mean delisting.
        old = {m["source_key"]:m for m in (prev or {}).get("models",[])}
        now = {m["source_key"]:m for m in source["models"]}
        healthy_previous = prev and prev.get("status") == "OK"
        for key,m in now.items():
            if not healthy_previous or key not in old:
                events.append(dict(m,event="NEW_OFFICIAL_LINEUP_ENTRY" if healthy_previous else "OFFICIAL_BASELINE_ENTRY"))
        if healthy_previous:
            for key,m in old.items():
                if key not in now: events.append(dict(m,event="OFFICIAL_LINEUP_ENTRY_MISSING_REVIEW"))
            if source["sha256"] != prev.get("sha256"):
                events.append({"event":"OFFICIAL_PAGE_CHANGED","source_url":source["url"],
                               "previous_sha256":prev.get("sha256"),"sha256":source["sha256"]})
    return events

def enrichment_queue(events, registry_ids, u11=None):
    models = {m["id"]:m for m in (u11 or {}).get("models",[])}
    output = []
    for e in events:
        if "source_key" not in e: continue
        id = e.get("p1_id")
        state = "P2_IDENTITY_REVIEW" if not id else "P2_ID_MAPPING_REQUIRED" if id not in registry_ids else "P2_EVIDENCE_REFRESH"
        if id in models and models[id].get("u") is not True:
            state = "OFFICIAL_U11_AVAILABILITY_CONFLICT"
        output.append(dict(e,queue_state=state,authority="STAGE_ONLY",
                           next_action="P2 verify current availability, exact identity, prices/specs/brochure; no automatic canonical or P1 change"))
    return output

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config",default="vehicle-data/config/official_lineups.json")
    ap.add_argument("--out",required=True)
    ap.add_argument("--u11",help="optional accepted U11 local JSON; never fetched or rewritten implicitly")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True,exist_ok=True)
    previous_path = out/"latest.json"
    prev = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    current = {"schema":"carindex.p2.official-discovery/v1","observed_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
               "authority":"STAGE_ONLY","llm_calls":0,"sources":[]}
    for src in json.loads(Path(a.config).read_text())["sources"]:
        row = {"url":src["url"],"brand":src["brand"],"status":"ERROR","models":[]}
        try:
            request = Request(src["url"],headers={"User-Agent":"CarIndexEvidence/1.0","Accept-Language":"en,ar"})
            with urlopen(request,timeout=30) as response:
                body = response.read(8*1024*1024+1)
                if len(body)>8*1024*1024: raise ValueError("source exceeds 8 MiB")
            row["sha256"] = hashlib.sha256(body).hexdigest()
            html = body.decode("utf-8","replace")
            row["models"] = extract(src,html)
            row["status"] = "OK" if row["models"] else "EMPTY_EXTRACTION"
            # Evidence bytes persist with hash; repeated runs never overwrite different evidence.
            (out/(row["sha256"]+".html")).write_bytes(body)
        except Exception as exc:
            row["error"] = str(exc)
        current["sources"].append(row)
        time.sleep(1)
    events = changes(current,prev)
    registry = Path("vehicle-data/crosswalk/p1_catalogue_ids.AT51.csv")
    # P2 registry is read-only; serving IDs are not backfilled from names.
    import csv
    registry_ids = set()
    if registry.exists():
        for r in csv.DictReader(registry.read_text().splitlines()):
            registry_ids.add(r.get("p1_id")) if r.get("p1_id") else None
    u = json.loads(Path(a.u11).read_text()) if a.u11 else None
    if u is None:
        identity_url = json.loads(Path(a.config).read_text()).get("u11_source")
        if identity_url:
            try:
                with urlopen(Request(identity_url,headers={"User-Agent":"CarIndexEvidence/1.0"}),timeout=30) as response:
                    identity_bytes = response.read(2*1024*1024+1)
                if len(identity_bytes)>2*1024*1024: raise ValueError("identity source exceeds 2 MiB")
                u = json.loads(identity_bytes)
                current["identity_source"] = {"url":identity_url,"sha256":hashlib.sha256(identity_bytes).hexdigest(),"version":u["meta"]["version"]}
            except Exception as exc:
                current["identity_source_error"] = str(exc)
                # Missing identity input is explicit; never silently approve availability.

    current["events"] = events
    current["enrichment_queue"] = enrichment_queue(events,registry_ids,u)
    (out/"latest.json").write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n")
    (out/(current["observed_at"].replace(":","-")+".json")).write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"observed_at":current["observed_at"],"sources":len(current["sources"]),
                     "healthy":sum(s["status"]=="OK" for s in current["sources"]),
                     "events":len(events),"queue":len(current["enrichment_queue"]),"llm_calls":0}))
    if not any(s["status"]=="OK" for s in current["sources"]): raise SystemExit(2)
if __name__=="__main__": main()
