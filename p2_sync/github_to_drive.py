"""GitHub (canonical) -> Google Drive (read-only mirror) for P2 vehicle-data artifacts.

Same decision rules as the n8n consumer (sync_core.js) and SYNC_CONTRACT.md:
  ACCEPTED_NEW | UPDATED | DUPLICATE_NO_CHANGE | REJECTED_STALE | REJECTED_DIVERGED |
  REJECTED_NOT_ON_CANONICAL_BRANCH | REJECTED_SOURCE_NOT_FOUND | REJECTED_INTEGRITY |
  REJECTED_MALFORMED | REJECTED_UNSUPPORTED_SCHEMA | REJECTED_NOT_ALLOWED

Writes only inside --drive-root (a Drive-for-desktop folder). Never deletes; the previous version is kept
under versions/<version>_<commit7>/ so a mirror can always be rolled back. Stdlib only.

  python3 github_to_drive.py sync   --drive-root <dir> [--ref <commit|branch>] [--path <repo path>] [--expected-sha256 X]
  python3 github_to_drive.py verify --drive-root <dir>      # re-hash the mirror against its ledger
"""
import argparse, datetime as dt, hashlib, json, os, re, sys, urllib.error, urllib.parse, urllib.request

REPO = 'KingMega1/scratch'
BRANCH = 'claude/carindex-buyer-vehicle-data-97yinp'
DEFAULT_PATH = 'vehicle-data/views/p1_suv_2m.json'
ALLOW = [re.compile(r'^vehicle-data/views/[a-z0-9_]+\.json$'), re.compile(r'^vehicle-data/sync_canary/[a-z0-9_]+\.json$')]
SCHEMAS = {'carindex.p1.buyer_view/v2': ['schema', 'generated_as_of', 'models'],
           'carindex.sync_canary/v1': ['schema', 'artifact_id', 'generated_as_of', 'payload']}
UA = {'User-Agent': 'carindex-p2-sync/1', 'Accept': 'application/vnd.github+json'}


def get(url, binary=False):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            b = r.read()
            return r.status, (b if binary else json.loads(b))
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


def transient(st):
    return st == 0 or st in (403, 429) or st >= 500     # GitHub rate limit = 403/429


def git_blob_sha(b):
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()


def atomic_write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.partial'
    with open(tmp, 'wb') as f:
        f.write(data); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)


def load_ledger(root):
    p = os.path.join(root, 'SYNC_LEDGER.json')
    return json.load(open(p)) if os.path.exists(p) else {'contract': 'carindex.p2.sync/v1', 'artifacts': {}, 'events': []}


def save_ledger(root, led):
    atomic_write(os.path.join(root, 'SYNC_LEDGER.json'), json.dumps(led, indent=1, sort_keys=True).encode())


def sync(root, ref, path, expected=None, request_id=None):
    now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    led = load_ledger(root)
    aid = f'github:{REPO}:{path}'
    out = {'request_id': request_id, 'artifact_id': aid, 'path': path, 'ref': ref, 'decided_at': now}

    def decide(decision, **kw):
        out.update(kw, decision=decision)
        led['events'].append({k: out.get(k) for k in ('decided_at', 'request_id', 'artifact_id', 'decision', 'commit', 'sha256', 'reason')})
        led['events'] = led['events'][-200:]
        save_ledger(root, led)
        out['ledger_entry'] = led['artifacts'].get(aid)
        return out

    if not any(rx.match(path) for rx in ALLOW):
        return decide('REJECTED_NOT_ALLOWED', reason='path not in allowlist')
    st, lin = get(f'https://api.github.com/repos/{REPO}/compare/{urllib.parse.quote(BRANCH, safe="")}...{urllib.parse.quote(ref, safe="")}')
    if transient(st):
        return decide('DEFERRED_SOURCE_UNAVAILABLE', reason=f'GitHub HTTP {st} (rate limit / outage): retry later, state unchanged')
    if st in (404, 422):
        return decide('REJECTED_SOURCE_NOT_FOUND', reason=f'ref not found (HTTP {st})')
    if st != 200 or lin['status'] not in ('identical', 'behind'):
        return decide('REJECTED_NOT_ON_CANONICAL_BRANCH', reason=f'compare branch...ref = {lin and lin["status"]} (HTTP {st})')
    mb = lin['merge_base_commit']      # for identical/behind the merge base IS the requested commit
    commit = mb['sha']; out.update(commit=commit, commit_date=mb['commit']['committer']['date'])
    st, meta = get(f'https://api.github.com/repos/{REPO}/contents/{path}?ref={commit}')
    if transient(st):
        return decide('DEFERRED_SOURCE_UNAVAILABLE', reason=f'GitHub HTTP {st}: retry later, state unchanged')
    if st != 200 or not meta:
        return decide('REJECTED_SOURCE_NOT_FOUND', reason=f'contents HTTP {st}')
    st, data = get(f'https://raw.githubusercontent.com/{REPO}/{commit}/{path}', binary=True)
    if transient(st):
        return decide('DEFERRED_SOURCE_UNAVAILABLE', reason=f'raw HTTP {st}: retry later, state unchanged')
    if st != 200:
        return decide('REJECTED_SOURCE_NOT_FOUND', reason=f'raw HTTP {st}')
    sha, blob = hashlib.sha256(data).hexdigest(), git_blob_sha(data)
    out.update(sha256=sha, git_blob_sha=blob, bytes=len(data))
    if blob != meta['sha']:
        return decide('REJECTED_INTEGRITY', reason=f'git blob {blob} != GitHub {meta["sha"]}')
    if expected and expected != sha:
        return decide('REJECTED_INTEGRITY', reason='sha256 != expected_sha256')
    try:
        doc = json.loads(data.decode('utf-8'))
    except Exception as e:
        return decide('REJECTED_MALFORMED', reason=f'not UTF-8 JSON: {str(e)[:120]}')
    if not isinstance(doc, dict):
        return decide('REJECTED_MALFORMED', reason='top level is not an object')
    out['schema'] = doc.get('schema')
    keys = SCHEMAS.get(doc.get('schema'))
    if keys is None:
        return decide('REJECTED_UNSUPPORTED_SCHEMA', reason=f'schema {doc.get("schema")!r} not supported')
    miss = [k for k in keys if k not in doc]
    if miss:
        return decide('REJECTED_MALFORMED', reason=f'missing keys {",".join(miss)}')

    cur = led['artifacts'].get(aid)
    rel = os.path.join('current', path)
    def entry(version):
        return dict(artifact_id=aid, version=version, schema=doc['schema'], commit=commit, commit_date=out['commit_date'],
                    git_blob_sha=blob, sha256=sha, bytes=len(data), canonical_url=f'https://github.com/{REPO}/blob/{commit}/{path}',
                    drive_relpath=rel, mirrored_at=now)
    def write_current():
        dst = os.path.join(root, rel)
        atomic_write(dst, data)
        back = hashlib.sha256(open(dst, 'rb').read()).hexdigest()   # read-back verification
        if back != sha:
            raise RuntimeError(f'read-back hash mismatch {back}')
    if cur is None:
        write_current(); led['artifacts'][aid] = entry(1)
        return decide('ACCEPTED_NEW')
    if cur['sha256'] == sha:
        cur['last_seen_commit'] = commit; cur['last_seen_at'] = now
        dst = os.path.join(root, rel)
        on_disk = hashlib.sha256(open(dst, 'rb').read()).hexdigest() if os.path.exists(dst) else None
        if on_disk != sha:   # mirror drifted (edited/deleted in Drive): restore from canonical, same version
            write_current()
            return decide('REPAIRED_MIRROR', reason=f'Drive copy hash {on_disk} != version {cur["version"]}; restored from GitHub')
        return decide('DUPLICATE_NO_CHANGE', reason=f'content identical to version {cur["version"]}')
    st, order = get(f'https://api.github.com/repos/{REPO}/compare/{cur["commit"]}...{commit}')
    if transient(st):
        return decide('DEFERRED_SOURCE_UNAVAILABLE', reason=f'GitHub HTTP {st}: retry later, state unchanged')
    s = order['status'] if st == 200 else f'HTTP {st}'
    if s == 'ahead':
        # keep the superseded version (never delete), then replace current
        old = os.path.join(root, rel)
        keep = os.path.join(root, 'versions', f'{cur["version"]}_{cur["commit"][:7]}', path)
        if os.path.exists(old) and not os.path.exists(keep):
            atomic_write(keep, open(old, 'rb').read())
        write_current()
        led['artifacts'][aid] = dict(entry(cur['version'] + 1), previous={k: cur[k] for k in ('version', 'commit', 'sha256')})
        return decide('UPDATED')
    if s == 'behind':
        return decide('REJECTED_STALE', reason=f'commit is older than current version {cur["version"]} ({cur["commit"][:7]})')
    return decide('REJECTED_DIVERGED', reason=f'compare current...candidate = {s}')


def verify(root):
    led = load_ledger(root); res = []
    for aid, e in led['artifacts'].items():
        p = os.path.join(root, e['drive_relpath'])
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None
        res.append(dict(artifact_id=aid, version=e['version'], expected=e['sha256'], actual=h, ok=h == e['sha256']))
    return res


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['sync', 'verify'])
    ap.add_argument('--drive-root', required=True)
    ap.add_argument('--ref', default=BRANCH); ap.add_argument('--path', default=DEFAULT_PATH)
    ap.add_argument('--expected-sha256'); ap.add_argument('--request-id')
    a = ap.parse_args()
    r = sync(a.drive_root, a.ref, a.path, a.expected_sha256, a.request_id) if a.cmd == 'sync' else verify(a.drive_root)
    print(json.dumps(r, indent=1))
    sys.exit(0)
