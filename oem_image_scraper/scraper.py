#!/usr/bin/env python3
"""
OEM / web reference-image scraper for CarIndex design reference.

Pulls car images from official OEM sites (Egypt distributor, regional MEA,
global HQ press/media) plus a general web image search fallback, for design
MOODBOARD / REFERENCE use only (Carousel Designer briefs, not for direct
posting or redistribution). No licensing/rights gate is applied by design --
this tool only dedupes and quality-filters, it does not decide what is safe
to publish. That call stays with whoever uses the downloaded images.

Usage:
    python3 scraper.py --brand toyota --model corolla-cross --out ./downloads
    python3 scraper.py --config sites.json --brand hyundai --model tucson --out ./downloads
"""
import argparse
import hashlib
import json
import re
import time
import urllib.parse
from dataclasses import dataclass, field, asdict
from pathlib import Path

import requests
from bs4 import BeautifulSoup

USER_AGENT = "CarIndexDesignRefBot/1.0 (+internal design reference; contact: design@carindex.internal)"
MIN_WIDTH = 480          # skip obvious icons/thumbnails
MIN_BYTES = 15_000       # skip tiny/placeholder images
REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 1.5  # seconds -- be a polite, identifiable crawler


@dataclass
class SiteConfig:
    """One OEM site's crawl recipe. Every OEM site's markup differs, so this
    stays a light per-site config rather than one universal selector."""
    name: str
    tier: str  # "egypt" | "regional" | "hq"
    listing_url_template: str   # "{base}/en/search?q={query}" etc, {query} filled from brand/model
    image_selector: str = "img"           # CSS selector for candidate <img> tags
    image_attr: str = "src"               # attribute holding the image URL (src / data-src / srcset)
    link_selector: str | None = None      # CSS selector for links to per-model gallery pages, if listing page is just an index
    base_url: str = ""


DEFAULT_SITES = [
    SiteConfig(
        name="Toyota Egypt Newsroom",
        tier="egypt",
        base_url="https://toyota.com.eg",
        listing_url_template="https://toyota.com.eg/en/newsroom/archive",
        image_selector="img",
        image_attr="src",
    ),
    SiteConfig(
        name="Hyundai Global Media",
        tier="hq",
        base_url="https://www.hyundai.com",
        listing_url_template="https://www.hyundai.com/worldwide/en/newsroom",
        image_selector="img",
        image_attr="src",
    ),
    # Add regional-MEA and other Egypt-distributor sites (e.g. Kasrawy for JAC,
    # Bavarian Auto Group for BMW, etc.) here in the same shape once their
    # markup is checked directly -- this file ships with two starting
    # examples, not a full brand roster.
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fetch(url: str, session: requests.Session) -> requests.Response | None:
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp
    except requests.RequestException as e:
        print(f"  [warn] fetch failed for {url}: {e}")
        return None


def extract_image_urls(html: str, base_url: str, selector: str, attr: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for tag in soup.select(selector):
        src = tag.get(attr) or tag.get("data-src") or tag.get("src")
        if not src:
            continue
        if src.startswith("data:"):
            continue
        full = urllib.parse.urljoin(base_url, src)
        urls.append(full)
    return urls


def download_image(url: str, out_dir: Path, session: requests.Session, source_name: str, source_tier: str,
                    query: str, page_url: str) -> dict | None:
    resp = fetch(url, session)
    if resp is None:
        return None
    content = resp.content
    if len(content) < MIN_BYTES:
        return None

    digest = hashlib.sha256(content).hexdigest()[:16]
    ext = ".jpg"
    ctype = resp.headers.get("Content-Type", "")
    if "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"

    filename = f"{slugify(query)}_{digest}{ext}"
    dest = out_dir / filename
    if dest.exists():
        return None  # already have this exact image (content-hash dedup)

    dest.write_bytes(content)

    return {
        "file": str(dest),
        "source_name": source_name,
        "source_tier": source_tier,
        "source_image_url": url,
        "source_page_url": page_url,
        "query": query,
        "bytes": len(content),
        "sha256_16": digest,
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def crawl_site(site: SiteConfig, query: str, out_dir: Path, session: requests.Session, max_images: int = 20) -> list[dict]:
    listing_url = site.listing_url_template.format(base=site.base_url, query=urllib.parse.quote(query))
    print(f"[{site.name}] listing: {listing_url}")
    resp = fetch(listing_url, session)
    if resp is None:
        return []

    image_urls = extract_image_urls(resp.text, site.base_url, site.image_selector, site.image_attr)
    print(f"[{site.name}] found {len(image_urls)} candidate <img> tags")

    results = []
    for img_url in image_urls[:max_images]:
        time.sleep(DELAY_BETWEEN_REQUESTS)
        record = download_image(img_url, out_dir, session, site.name, site.tier, query, listing_url)
        if record:
            results.append(record)
    return results


def general_web_image_search(query: str, out_dir: Path, session: requests.Session, max_images: int = 20,
                               search_api_url: str | None = None, search_api_key: str | None = None) -> list[dict]:
    """
    Fallback for general web sources beyond known OEM sites.

    This is a thin, pluggable wrapper -- point it at whatever image-search
    API you have access to (Bing Image Search, SerpAPI, etc.) by passing
    search_api_url / search_api_key (or setting them as env vars and reading
    them in your own wrapper script). Left unconfigured here since no search
    API credential is provisioned in this environment; wire it up before
    relying on this fallback.
    """
    if not search_api_url or not search_api_key:
        print("[general web search] no search_api_url/search_api_key configured -- skipping. "
              "Wire up an image-search API (Bing Image Search, SerpAPI, etc.) to enable this fallback.")
        return []

    try:
        resp = session.get(
            search_api_url,
            params={"q": query, "count": max_images},
            headers={"Ocp-Apim-Subscription-Key": search_api_key, "User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[general web search] request failed: {e}")
        return []

    image_urls = [item.get("contentUrl") for item in data.get("value", []) if item.get("contentUrl")]

    results = []
    for img_url in image_urls[:max_images]:
        time.sleep(DELAY_BETWEEN_REQUESTS)
        record = download_image(img_url, out_dir, session, "general-web-search", "web", query, search_api_url)
        if record:
            results.append(record)
    return results


def load_sites(config_path: str | None) -> list[SiteConfig]:
    if not config_path:
        return DEFAULT_SITES
    with open(config_path, encoding="utf-8") as f:
        raw = json.load(f)
    return [SiteConfig(**entry) for entry in raw]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brand", required=True, help="e.g. toyota")
    parser.add_argument("--model", required=True, help="e.g. corolla-cross")
    parser.add_argument("--out", default="./downloads", help="output directory")
    parser.add_argument("--config", default=None, help="path to a JSON site-config file (see DEFAULT_SITES shape)")
    parser.add_argument("--max-per-source", type=int, default=20)
    parser.add_argument("--search-api-url", default=None)
    parser.add_argument("--search-api-key", default=None)
    args = parser.parse_args()

    query = f"{args.brand} {args.model}"
    out_dir = Path(args.out) / slugify(args.brand) / slugify(args.model)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    sites = load_sites(args.config)

    manifest: list[dict] = []
    for site in sites:
        manifest.extend(crawl_site(site, query, out_dir, session, args.max_per_source))

    manifest.extend(general_web_image_search(
        query, out_dir, session, args.max_per_source,
        args.search_api_url, args.search_api_key,
    ))

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDone. {len(manifest)} images saved to {out_dir}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
