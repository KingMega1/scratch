# OEM / web reference-image scraper

Pulls car images from OEM sites (Egypt distributor, regional MEA, global HQ
press/media) plus a pluggable general-web-image-search fallback, for design
reference only -- moodboarding the Carousel Designer brief, not for direct
posting. **No licensing/rights gate is applied, by direction** -- this tool
dedupes (content hash) and quality-filters (min size/bytes) but does not
decide what is safe to publish; that stays a human call downstream.

## Status

Independent of the CarIndex pipeline fixes in the repo root -- does not
touch or depend on `CarIndex_Workflow.json`.

This tool could **not** be live-tested against real OEM sites from this
session: the sandbox's outbound HTTPS proxy returns a policy `403` on every
host outside the org's allowlist (confirmed against `stellantis.com`,
`toyota.com.eg`, `hyundai.com` -- see `curl -sS $HTTPS_PROXY/__agentproxy/status`
in this session's history). Per the proxy's own guidance this is an org
egress policy denial, not a bug to route around. Run and test this in an
environment with normal outbound internet access.

## Usage

```
pip install -r requirements.txt
python3 scraper.py --brand toyota --model corolla-cross --out ./downloads
python3 scraper.py --config sites.example.json --brand hyundai --model tucson --out ./downloads
```

Output: `./downloads/<brand>/<model>/*.jpg|png|webp` plus a `manifest.json`
recording, per image: source site name + tier (egypt/regional/hq/web), the
image URL, the listing page it came from, byte size, and a short content
hash (also used for dedup).

## Extending site coverage

`sites.example.json` ships with two starting examples (Toyota Egypt, Hyundai
global media) built from their real, current URL structure. Every OEM site's
markup differs, so add one `SiteConfig` entry per site you want covered
(Egypt distributor sites -- Kasrawy, Bavarian Auto Group, etc. -- and each
brand's regional-MEA and global-HQ press/media pages) after checking that
site's actual `<img>`/gallery markup; the generic `img[src]` selector in the
two shipped examples is a reasonable default but won't fit every site
(some lazy-load into `data-src`, some paginate galleries behind JS).

## General web search fallback

`general_web_image_search()` is a thin wrapper you point at an image-search
API (Bing Image Search, SerpAPI, etc.) via `--search-api-url`/`--search-api-key`
-- no API credential is provisioned in this environment, so it's a no-op
until you wire one up.
