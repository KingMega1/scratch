"""Export the accepted recommendation view (the exact projection the published site serves as data/view.js) as a
versioned dataset snapshot for the server transport, plus a manifest with its integrity hash.
The transport never reads Sheets, staging or scraping output: only a dataset with this shape + manifest.
Usage: python3 tools/export_dataset.py   (writes datasets/<universe_version>/recommendation_view.json + manifest.json)"""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_public import sanitize, ROOT

raw = open(os.path.join(ROOT, "data", "p11_client.js"), encoding="utf-8").read()
u = sanitize(json.loads(raw[raw.index("=") + 1:].strip().rstrip(";")))
body = json.dumps(u, ensure_ascii=False, separators=(",", ":"))
ver = u["meta"]["version"]
d = os.path.join(ROOT, "datasets", ver)
os.makedirs(d, exist_ok=True)
open(os.path.join(d, "recommendation_view.json"), "w", encoding="utf-8").write(body + "\n")
view_js = "window.CI_UNIVERSE = " + body + ";\n"
manifest = {
    "schema": "ci.dataset.v1",
    "dataset_id": f"{ver}/recommendation_view",
    "universe_version": ver,
    "kind": "accepted recommendation view (pinned launch snapshot)",
    "file": "recommendation_view.json",
    "sha256": hashlib.sha256((body + "\n").encode("utf-8")).hexdigest(),
    "content_sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
    "published_view_js_sha256": hashlib.sha256(view_js.encode("utf-8")).hexdigest(),
    "models": len(u["models"]),
    "models_in_universe": sum(1 for m in u["models"] if m.get("u")),
    "registry": {"snapshot_id": None, "registration_months": u["meta"].get("registration_months"), "last12_window": u["meta"].get("last12_window"),
                 "note": "registration figures are embedded in this snapshot; no separate registry snapshot id exists for U11"},
    "derived_from": "data/p11_client.js via tools/build_public.py sanitize() — byte-identical content to the published data/view.js",
}
open(os.path.join(d, "manifest.json"), "w", encoding="utf-8").write(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
print(json.dumps(manifest, indent=1))
