"""Offline test of github_to_drive.py (exact code) with a mocked GitHub serving the synthetic canary files."""
import hashlib, json, os, re, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import github_to_drive as g
H = os.path.dirname(os.path.abspath(__file__))
C = {'A': 'a' * 40, 'B': 'b' * 40, 'M': 'd' * 40, 'K': 'e' * 40}
F = {'A': 'v1', 'B': 'v2', 'M': 'malformed', 'K': 'missing_keys'}
ORDER = 'ABMK'
data = lambda k: open(f'{H}/synthetic_canary/p2_sync_canary.{F[k]}.json', 'rb').read()
key = lambda s: next(k for k, v in C.items() if v.startswith(s))
def fake(url, binary=False):
    m = re.search(r'compare/([^.]+)\.\.\.([0-9a-f]+)$', url)
    if m:
        if 'claude' in m.group(1):
            return 200, {'status': 'behind', 'merge_base_commit': {'sha': C[key(m.group(2))], 'commit': {'committer': {'date': '2026-09-28T00:00:00Z'}}}}
        a, b = ORDER.index(key(m.group(1))), ORDER.index(key(m.group(2)))
        return 200, {'status': 'ahead' if b > a else 'behind' if b < a else 'identical'}
    m = re.search(r'contents/.*\?ref=([0-9a-f]+)', url)
    if m: return 200, {'sha': g.git_blob_sha(data(key(m.group(1))))}
    m = re.search(r'raw\.githubusercontent\.com/[^/]+/[^/]+/([0-9a-f]+)/', url)
    if m: return 200, data(key(m.group(1)))
    return 404, None
g.get = fake
root = tempfile.mkdtemp(); P = 'vehicle-data/sync_canary/p2_sync_canary.json'; ok = True
for name, k, want in [('new', 'A', 'ACCEPTED_NEW'), ('rerun', 'A', 'DUPLICATE_NO_CHANGE'), ('update', 'B', 'UPDATED'),
                      ('stale', 'A', 'REJECTED_STALE'), ('malformed', 'M', 'REJECTED_MALFORMED'), ('missing_keys', 'K', 'REJECTED_MALFORMED')]:
    r = g.sync(root, C[k], P, request_id=name); ok &= r['decision'] == want
    print(f"{name:13} {want:22} {r['decision']:22} {(r.get('reason') or '')[:50]} {'PASS' if r['decision'] == want else 'FAIL'}")
# drift repair: edit the Drive copy, rerun the same version
cur = os.path.join(root, 'current', P); open(cur, 'a').write('tampered')
r = g.sync(root, C['B'], P, request_id='repair'); ok &= r['decision'] == 'REPAIRED_MIRROR'
print(f"{'drift_repair':13} {'REPAIRED_MIRROR':22} {r['decision']:22} {'PASS' if r['decision'] == 'REPAIRED_MIRROR' else 'FAIL'}")
v = g.verify(root); ok &= all(x['ok'] for x in v) and hashlib.sha256(open(cur, 'rb').read()).hexdigest() == hashlib.sha256(data('B')).hexdigest()
files = sorted(os.path.relpath(os.path.join(a, f), root) for a, _, fs in os.walk(root) for f in fs)
print('files', files); print('ALL PASS' if ok else 'FAILURES'); sys.exit(0 if ok else 1)
