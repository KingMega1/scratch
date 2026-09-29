"""Live synthetic canary THROUGH the canonical GitHub branch (both legs: Drive mirror + live n8n consumer).

Commits 4 NON-PRODUCTION versions of vehicle-data/sync_canary/p2_sync_canary.json to the canonical branch
(A=v1, B=v2, C=malformed JSON, D=missing required keys), runs the full test sequence through both consumers,
then removes the canary with a 5th commit and verifies the post-cleanup state. The token is read from
.claude/settings.local.json (P2_SYNC_GITHUB_TOKEN) and never printed.

  python3 run_synthetic_canary.py <drive-root>
"""
import base64, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); SYNC = os.path.dirname(HERE); REPO_DIR = os.path.dirname(SYNC)
DRIVE = sys.argv[1]
REPO, BRANCH, P = 'KingMega1/scratch', 'claude/carindex-buyer-vehicle-data-97yinp', 'vehicle-data/sync_canary/p2_sync_canary.json'
AID = f'github:{REPO}:{P}'
TOK = json.load(open(os.path.join(REPO_DIR, '.claude/settings.local.json')))['env']['P2_SYNC_GITHUB_TOKEN']
AUTH = ['-c', 'http.extraHeader=Authorization: Basic ' + base64.b64encode(f'x-access-token:{TOK}'.encode()).decode()]
sha = lambda b: hashlib.sha256(b).hexdigest()
FILES = {k: open(os.path.join(HERE, f'p2_sync_canary.{v}.json'), 'rb').read()
         for k, v in (('A', 'v1'), ('B', 'v2'), ('C', 'malformed'), ('D', 'missing_keys'))}


def git(*a, cwd):
    return subprocess.run(['git', *AUTH, *a], cwd=cwd, check=True, capture_output=True, text=True,
                          env=dict(os.environ, GIT_TERMINAL_PROMPT='0')).stdout.strip()


def drive(ref, rid, expected=None):
    a = ['python3', os.path.join(SYNC, 'github_to_drive.py'), 'sync', '--drive-root', DRIVE, '--ref', ref, '--path', P, '--request-id', rid]
    if expected: a += ['--expected-sha256', expected]
    return json.loads(subprocess.run(a, capture_output=True, text=True, check=True).stdout)


def n8n_ledger():
    t = subprocess.run(['ssh', '-o', 'BatchMode=yes', 'carindex-vm', 'docker exec n8n n8n export:workflow --id=P2SyncProbe00001 '
                        '--output=/tmp/p.json >/dev/null 2>&1; docker exec n8n cat /tmp/p.json'], capture_output=True, text=True).stdout
    return json.loads(t[t.find('['):])[0]['staticData']['global']['p2sync']


def n8n(ref, rid, expected=None):
    body = {'ref': ref, 'path': P, 'request_id': rid, **({'expected_sha256': expected} if expected else {})}
    out = subprocess.run([os.path.join(SYNC, 'run_n8n.sh'), json.dumps(body)], capture_output=True, text=True).stdout
    if out.strip():
        return json.loads(out)
    # CLI output lost in transit: read the decision n8n actually recorded (never re-execute)
    led = n8n_ledger(); ev = [e for e in led['events'] if e['request_id'] == rid]
    if not ev:
        raise RuntimeError(f'n8n recorded nothing for {rid}')
    e = ev[-1]; entry = led['artifacts'].get(e['artifact_id'])
    return dict(decision=e['decision'], artifact_id=e['artifact_id'], commit=e['commit'], sha256=e['sha256'],
                git_blob_sha=None, reason=e.get('reason'), ledger_entry=entry, _source='n8n ledger (CLI output lost)')


def gh_api(path):
    req = urllib.request.Request(f'https://api.github.com/repos/{REPO}/{path}', headers={'Authorization': f'Bearer {TOK}',
                                                                                     'User-Agent': 'carindex-p2-sync'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, None


RESUME = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None   # {"run_id":..,"base":..,"commits":{A..D},"start":"S4_stale"}
run_id = RESUME['run_id'] if RESUME else time.strftime('syn-%Y%m%dT%H%M%SZ', time.gmtime())
work = tempfile.mkdtemp()
git('clone', '-q', '--branch', BRANCH, '--single-branch', f'https://github.com/{REPO}.git', 'r', cwd=work)
repo = os.path.join(work, 'r'); base = git('rev-parse', 'HEAD', cwd=repo)
git('config', 'user.name', 'Claude', cwd=repo); git('config', 'user.email', 'noreply@anthropic.com', cwd=repo)
os.makedirs(os.path.join(repo, os.path.dirname(P)), exist_ok=True)
C = {}
if RESUME:
    base, C = RESUME['base'], dict(RESUME['commits'])
    git('config', 'user.name', 'Claude', cwd=repo)
for k, msg in [] if RESUME else (('A', 'v1'), ('B', 'v2 (update)'), ('C', 'malformed JSON'), ('D', 'missing required keys')):
    open(os.path.join(repo, P), 'wb').write(FILES[k])
    git('add', P, cwd=repo)
    git('commit', '-q', '-m', f'sync canary {k}: {msg} [NON-PRODUCTION, synthetic, removed after test]\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', cwd=repo)
    C[k] = git('rev-parse', 'HEAD', cwd=repo)
if not RESUME: git('push', '-q', 'origin', f'HEAD:{BRANCH}', cwd=repo)
print('canary commits', {k: v[:7] for k, v in C.items()}, 'on top of', base[:7])

CASES = [('S1_new', C['A'], None, 'ACCEPTED_NEW', 'ACCEPTED_NEW', 'A'),
         ('S2_rerun_idempotent', C['A'], None, 'DUPLICATE_NO_CHANGE', 'DUPLICATE_NO_CHANGE', 'A'),
         ('S3_update', C['B'], None, 'UPDATED', 'UPDATED', 'B'),
         ('S4_stale', C['A'], None, 'REJECTED_STALE', 'REJECTED_STALE', 'B'),
         ('S5_integrity_expected_hash', C['B'], '0' * 64, 'REJECTED_INTEGRITY', 'REJECTED_INTEGRITY', 'B'),
         ('S6_malformed_json', C['C'], None, 'REJECTED_MALFORMED', 'REJECTED_MALFORMED', 'B'),
         ('S7_missing_required_keys', C['D'], None, 'REJECTED_MALFORMED', 'REJECTED_MALFORMED', 'B'),
         ('S8_drive_drift_repair', C['B'], None, 'REPAIRED_MIRROR', 'DUPLICATE_NO_CHANGE', 'B')]
res, ok_all = [], True
if RESUME:
    CASES = CASES[[c[0] for c in CASES].index(RESUME['start']):]
for cid, ref, exp, want_d, want_n, cur in CASES:
    if cid == 'S8_drive_drift_repair':   # someone edits the Drive copy by hand
        with open(os.path.join(DRIVE, 'current', P), 'ab') as f: f.write(b'\n// hand edit')
    d, n = drive(ref, f'{run_id}:{cid}', exp), n8n(ref, f'{run_id}:{cid}', exp)
    cd, cn = (d.get('ledger_entry') or {}), (n.get('ledger_entry') or {})
    same = all(d.get(k) == n.get(k) for k in ('artifact_id', 'commit', 'sha256') + (('git_blob_sha',) if n.get('git_blob_sha') else ()))
    ok = d['decision'] == want_d and n['decision'] == want_n and cd.get('sha256') == sha(FILES[cur]) == cn.get('sha256') and same
    ok_all &= ok
    res.append(dict(case=cid, commit=ref, expected=[want_d, want_n], drive=d['decision'], n8n=n['decision'],
                    sha256=d.get('sha256'), git_blob_sha=d.get('git_blob_sha'), schema=d.get('schema'),
                    current_version=[cd.get('version'), cn.get('version')], current_sha256=cd.get('sha256'),
                    identity_equal=same, reason=d.get('reason') or n.get('reason'), pass_=ok))
    print(f"{cid:28} drive={d['decision']:28} n8n={n['decision']:28} v={cd.get('version')}/{cn.get('version')} {'PASS' if ok else 'FAIL'}")

# ---- cleanup: remove the canary from the canonical branch
git('pull', '-q', '--ff-only', 'origin', BRANCH, cwd=repo)
git('rm', '-q', P, cwd=repo)
git('commit', '-q', '-m', 'sync canary: remove synthetic artifact [NON-PRODUCTION]\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', cwd=repo)
C['E'] = git('rev-parse', 'HEAD', cwd=repo)
git('push', '-q', 'origin', f'HEAD:{BRANCH}', cwd=repo)
# ---- post-cleanup verification
st_head, _ = gh_api(f'contents/{P}?ref={BRANCH}')
st_dir, _ = gh_api(f'contents/vehicle-data/sync_canary?ref={BRANCH}')
d, n = drive(BRANCH, f'{run_id}:post_cleanup'), n8n(BRANCH, f'{run_id}:post_cleanup')
tree_diff = git('diff', '--stat', base, C['E'], cwd=repo)
post = dict(canary_file_at_head_http=st_head, canary_dir_at_head_http=st_dir, net_tree_diff_vs_base=tree_diff or '(none)',
            drive_decision=d['decision'], n8n_decision=n['decision'],
            drive_current=(d.get('ledger_entry') or {}).get('sha256'), n8n_current=(n.get('ledger_entry') or {}).get('sha256'))
post_ok = (st_head == 404 and st_dir == 404 and not tree_diff and d['decision'] == n['decision'] == 'REJECTED_SOURCE_NOT_FOUND'
           and post['drive_current'] == post['n8n_current'] == sha(FILES['B']))
ok_all &= post_ok
print('post-cleanup', json.dumps(post), 'PASS' if post_ok else 'FAIL')
out = dict(run_id=run_id, base_commit=base, commits=C, all_pass=ok_all, results=res, post_cleanup=dict(post, pass_=post_ok),
           file_sha256={k: sha(v) for k, v in FILES.items()})
json.dump(out, open(os.path.join(SYNC, 'evidence', f'{run_id}.json'), 'w'), indent=1)
print('ALL PASS' if ok_all else 'FAILURES PRESENT', run_id)
