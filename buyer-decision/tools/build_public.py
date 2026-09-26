#!/usr/bin/env python3
"""Build the public buyer-test site: static app + only the data fields the app reads.
Nothing else from this repo is copied (no strategy docs, pipeline, registration rows, review queue, input hashes).
Usage: python3 tools/build_public.py <out_dir>
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL_KEYS = ["id", "brand_id", "brand", "model", "ar", "origin", "chinese", "body", "segment", "powertrains", "seats",
              "warranty", "warranty_years", "warranty_verified", "hp", "distributor", "model_year", "image", "reg", "u"]
TRIM_KEYS = ["label", "min", "year", "official", "date", "pt", "plugin"]  # no source names: provenance stays internal
REG_KEYS = ["since_2021", "last12", "trend", "first_month", "yearly", "rank_in_body_last12", "of_body"]
META_KEYS = ["version", "built", "registration_months", "last12_window", "models_in_universe"]


def sanitize(u):
    models = []
    for m in u["models"]:
        o = {k: m.get(k) for k in MODEL_KEYS if m.get(k) not in (None, [], {})}
        o["trims"] = [{k: t.get(k) for k in TRIM_KEYS} for t in m["trims"]]
        if m.get("reg"):
            o["reg"] = {k: m["reg"].get(k) for k in REG_KEYS}
        models.append(o)
    return {"meta": {k: u["meta"][k] for k in META_KEYS}, "models": models}


def main(out):
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "app"))
    os.makedirs(os.path.join(out, "data"))
    raw = open(os.path.join(ROOT, "data", "p11_client.js"), encoding="utf-8").read()
    u = json.loads(raw[raw.index("=") + 1:].strip().rstrip(";"))
    open(os.path.join(out, "data", "view.js"), "w", encoding="utf-8").write(
        "window.CI_UNIVERSE = " + json.dumps(sanitize(u), ensure_ascii=False, separators=(",", ":")) + ";\n")
    for f in ("styles.css", "i18n.js", "brief.js", "engine.js", "track.js", "app.js"):
        shutil.copy(os.path.join(ROOT, "app", f), os.path.join(out, "app", f))
    html = open(os.path.join(ROOT, "app", "index.html"), encoding="utf-8").read()
    html = html.replace('../data/p11_client.js', '../data/view.js')
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
