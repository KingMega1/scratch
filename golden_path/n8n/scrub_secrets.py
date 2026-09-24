#!/usr/bin/env python3
"""Remove hardcoded secrets from an n8n workflow export, in place.

- media-render X-Api-Key header  -> n8n credential (Header Auth) "CarIndex Media Render API"
- Telegram bot token in a URL     -> {{ $env.TELEGRAM_BOT_TOKEN }} (env var on the n8n container)

Then scans the file and exits non-zero if any known secret pattern is still present.
Never prints secret values.

Usage: python3 scrub_secrets.py <workflow.json> [...]
"""
import json
import re
import sys

MEDIA_RENDER_CREDENTIAL = {'httpHeaderAuth': {'id': 'SET_AFTER_CREATING_CREDENTIAL', 'name': 'CarIndex Media Render API'}}
TG_TOKEN_IN_URL = re.compile(r'api\.telegram\.org/bot\d{6,12}:[A-Za-z0-9_-]{30,}/')
SECRET_PATTERNS = {
    'telegram bot token': re.compile(r'\d{6,12}:AA[A-Za-z0-9_-]{30,}'),
    'hardcoded X-Api-Key value': re.compile(r'"name":\s*"X-Api-Key",\s*"value":\s*"[^"={][^"]*"'),
    '48-hex key': re.compile(r'\b[a-f0-9]{48}\b'),
    'NVIDIA key': re.compile(r'nvapi-[A-Za-z0-9_-]{20,}'),
    'Google API key': re.compile(r'AIza[0-9A-Za-z_-]{35}'),
    'Notion token': re.compile(r'\b(secret_|ntn_)[A-Za-z0-9]{20,}'),
    'Tavily key': re.compile(r'tvly-[A-Za-z0-9]{10,}'),
    'sk- key': re.compile(r'\bsk-[A-Za-z0-9_-]{20,}'),
}


def scrub(wf):
    changed = []
    node_lists = [wf.get('nodes', [])]
    if isinstance(wf.get('activeVersion'), dict):  # exports embed the published version too
        node_lists.append(wf['activeVersion'].get('nodes', []))
    for n in [n for lst in node_lists for n in lst]:
        p = n.get('parameters', {})
        hp = p.get('headerParameters', {}).get('parameters')
        if isinstance(hp, list) and any(h.get('name') == 'X-Api-Key' for h in hp):
            rest = [h for h in hp if h.get('name') != 'X-Api-Key']
            if rest:
                p['headerParameters']['parameters'] = rest
            else:
                p.pop('headerParameters', None)
                p['sendHeaders'] = False
            p['authentication'] = 'genericCredentialType'
            p['genericAuthType'] = 'httpHeaderAuth'
            n.setdefault('credentials', {}).update(MEDIA_RENDER_CREDENTIAL)
            changed.append(f'{n["name"]}: X-Api-Key header -> credential "CarIndex Media Render API"')
        url = p.get('url')
        if isinstance(url, str) and TG_TOKEN_IN_URL.search(url):
            new = TG_TOKEN_IN_URL.sub('api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/', url)
            p['url'] = new if new.startswith('=') else '=' + new
            changed.append(f'{n["name"]}: Telegram token in URL -> $env.TELEGRAM_BOT_TOKEN')
    return changed


def scan(text):
    return [name for name, rx in SECRET_PATTERNS.items() if rx.search(text)]


if __name__ == '__main__':
    bad = False
    for path in sys.argv[1:]:
        wf = json.load(open(path, encoding='utf-8'))
        for c in scrub(wf):
            print(f'{path}: {c}')
        text = json.dumps(wf, ensure_ascii=False, indent=2)
        open(path, 'w', encoding='utf-8').write(text + '\n')
        left = scan(text)
        if left:
            bad = True
            print(f'{path}: STILL CONTAINS: {", ".join(left)}')
        else:
            print(f'{path}: no known secret patterns left')
    sys.exit(1 if bad else 0)
