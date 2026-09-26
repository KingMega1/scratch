#!/usr/bin/env python3
"""Build the public buyer-test site: static app + only the data fields the app reads.
Nothing else from this repo is copied (no strategy docs, pipeline, registration rows, review queue, input hashes).
Usage: python3 tools/build_public.py <out_dir>
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPEC_KEYS = ["seats", "transmission", "engine_capacity", "horsepower", "drive_type", "warranty",
             "fuel_consumption", "trunk_capacity", "length", "electric_range"]
TRIM_KEYS = ["key", "label", "status", "sources", "min", "max", "observed_at", "urls", "powertrain", "plugin", "powertrain_basis", "changes"]
META_KEYS = ["slice", "generated_as_of", "models_in_slice", "budget_anchor_egp", "band", "not_in_data"]


def sanitize(u):
    models = []
    for m in u["models"]:
        models.append({
            "id": m["id"], "slug": m["slug"], "brand": m["brand"], "model": m["model"], "model_year": m["model_year"],
            "powertrains": m["powertrains"],
            "trims": [{k: t[k] for k in TRIM_KEYS} for t in m["trims"]],
            "specs": {k: m["specs"].get(k) for k in SPEC_KEYS},
            "warranty_years_max": m["warranty_years_max"],
            # model-level aggregates only (first licences), as shown in the app
            "registration": {k: m["registration"].get(k) for k in ("count", "rank", "of", "last12", "alias_pending_review")},
            "freshness": {"price_snapshots": [{"observed_at": s["observed_at"]} for s in m["freshness"]["price_snapshots"]]},
            "gaps": m["gaps"],
        })
    return {"meta": {k: u["meta"][k] for k in META_KEYS}, "models": models}


def main(out):
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "app"))
    os.makedirs(os.path.join(out, "data"))
    u = json.load(open(os.path.join(ROOT, "data", "p2_view.v1.json"), encoding="utf-8"))
    open(os.path.join(out, "data", "view.js"), "w", encoding="utf-8").write(
        "window.CI_UNIVERSE = " + json.dumps(sanitize(u), ensure_ascii=False, separators=(",", ":")) + ";\n")
    for f in ("styles.css", "i18n.js", "engine.js", "track.js", "app.js"):
        shutil.copy(os.path.join(ROOT, "app", f), os.path.join(out, "app", f))
    html = open(os.path.join(ROOT, "app", "index.html"), encoding="utf-8").read()
    html = html.replace('../data/p2_view.v1.js', '../data/view.js')
    # test deployment: no event sending, not indexed by search engines
    html = re.sub(r'<!-- auto = .*?-->\n<meta name="ci-track-endpoint" content="auto">',
                  '<meta name="ci-track-endpoint" content="">\n<meta name="robots" content="noindex, nofollow">', html)
    assert 'content="auto"' not in html and 'view.js' in html
    open(os.path.join(out, "app", "index.html"), "w", encoding="utf-8").write(html)
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(
        '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">'
        '<title>CarIndex</title><script>location.replace("app/index.html"+location.search+location.hash)</script>'
        '<a href="app/index.html">CarIndex — Find My Car</a>\n')
    open(os.path.join(out, "robots.txt"), "w").write("User-agent: *\nDisallow: /\n")
    open(os.path.join(out, ".nojekyll"), "w").write("")
    open(os.path.join(out, "README.md"), "w").write(
        "# CarIndex — Find My Car (buyer test)\n\nStatic test build. Open `index.html` or the GitHub Pages link.\n")
    print("built", out, sorted(os.listdir(out)))


if __name__ == "__main__":
    main(sys.argv[1])
