"""End-to-end canary: runs the SAME request sequence through the Drive mirror (github_to_drive.py) and the
live n8n consumer (run_n8n.sh), from a clean ledger on both, and checks every expected decision.
Writes canary_results.json. GitHub is only read."""
import json, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
DRIVE = sys.argv[1]
H = {'v1': '5b54e3ba1998503988661e5fc1f545abc35f289d4b639678f80745edb7fe891a',   # 60bbcc5
     'v2': 'a01ff925b99ae2f004ec7177ee1a12f70464f705e915dbeeb5d7fab2e82e86ad'}   # 19dd248 == d475768 (HEAD)
CASES = [  # (id, request, expected decision, expected current sha256 after the step)
 ('T1_initial',          {'ref': '60bbcc5'},                         'ACCEPTED_NEW',        H['v1']),
 ('T2_rerun_same',       {'ref': '60bbcc5'},                         'DUPLICATE_NO_CHANGE', H['v1']),
 ('T3_update',           {'ref': '19dd248'},                         'UPDATED',             H['v2']),
 ('T4_newer_commit_same_content', {'ref': 'd475768'},                'DUPLICATE_NO_CHANGE', H['v2']),
 ('T5_stale_older',      {'ref': '579f775'},                         'REJECTED_STALE',      H['v2']),
 ('T6_branch_head',      {},                                         'DUPLICATE_NO_CHANGE', H['v2']),
 ('T7_drive_drift_repair', {'ref': 'd475768', '_tamper_drive': True}, ('REPAIRED_MIRROR', 'DUPLICATE_NO_CHANGE'), H['v2']),
 ('M1_unsupported_schema_v1', {'ref': 'f6f6d18'},                    'REJECTED_UNSUPPORTED_SCHEMA', H['v2']),
 ('M2_path_not_allowed', {'ref': '19dd248', 'path': 'README.md'},    'REJECTED_NOT_ALLOWED', None),
 ('M3_unknown_commit',   {'ref': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'}, 'REJECTED_SOURCE_NOT_FOUND', H['v2']),
 ('M4_commit_off_canonical_branch', {'ref': 'ad06669'},              'REJECTED_NOT_ON_CANONICAL_BRANCH', H['v2']),
 ('M5_hash_mismatch',    {'ref': '19dd248', 'expected_sha256': '0' * 64}, 'REJECTED_INTEGRITY', H['v2']),
 ('M6_missing_file',     {'ref': '19dd248', 'path': 'vehicle-data/views/does_not_exist.json'}, 'REJECTED_SOURCE_NOT_FOUND', None),
]
# expected current sha256 None = the rejected request must not create a ledger entry for its own artifact_id

def drive(req, rid):
    args = ['python3', os.path.join(HERE, 'github_to_drive.py'), 'sync', '--drive-root', DRIVE, '--request-id', rid]
    if 'ref' in req: args += ['--ref', req['ref']]
    if 'path' in req: args += ['--path', req['path']]
    if 'expected_sha256' in req: args += ['--expected-sha256', req['expected_sha256']]
    return json.loads(subprocess.run(args, capture_output=True, text=True, check=True).stdout)

def n8n(req, rid, reset=False):
    body = dict(req, request_id=rid, **({'reset_ledger': True} if reset else {}))
    r = subprocess.run([os.path.join(HERE, 'run_n8n.sh'), json.dumps(body)], capture_output=True, text=True)
    return json.loads(r.stdout)

run_id = time.strftime('canary-%Y%m%dT%H%M%SZ', time.gmtime())
results, ok_all = [], True
for i, (cid, req, want, want_cur) in enumerate(CASES):
    rid = f'{run_id}:{cid}'
    if req.pop('_tamper_drive', False):   # simulate someone editing the Drive mirror by hand
        with open(os.path.join(DRIVE, 'current', 'vehicle-data/views/p1_suv_2m.json'), 'ab') as fh: fh.write(b'\n//edited')
    want_d, want_n = want if isinstance(want, tuple) else (want, want)
    d = drive(req, rid)
    n = n8n(req, rid, reset=(i == 0))
    cur_d = (d.get('ledger_entry') or {}).get('sha256')
    cur_n = (n.get('ledger_entry') or {}).get('sha256')
    ok = d['decision'] == want_d and n['decision'] == want_n and cur_d == want_cur and cur_n == want_cur
    same = all(d.get(k) == n.get(k) for k in ('artifact_id', 'commit', 'sha256', 'git_blob_sha', 'schema'))
    ok_all &= ok and same
    results.append(dict(case=cid, request=req, expected=want, drive=d['decision'], n8n=n['decision'],
                        commit=d.get('commit'), sha256=d.get('sha256'), schema=d.get('schema'),
                        identity_equal_across_systems=same, drive_current=cur_d, n8n_current=cur_n,
                        drive_version=(d.get('ledger_entry') or {}).get('version'),
                        n8n_version=(n.get('ledger_entry') or {}).get('version'), reason=d.get('reason') or n.get('reason'),
                        n8n_execution=n.get('_execution'), pass_=ok and same))
    print(f"{cid:34} want={str(want):34} drive={d['decision']:34} n8n={n['decision']:34} v={results[-1]['drive_version']}/{results[-1]['n8n_version']} {'PASS' if ok and same else 'FAIL'}")
# unparseable request file (n8n only; the Drive agent takes CLI args, not a request file)
r = subprocess.run(['ssh', '-o', 'BatchMode=yes', 'carindex-vm',
                    "docker exec n8n sh -c 'printf \"{not json\" > /home/node/.n8n-files/p2sync/request.json' && "
                    "docker exec -e N8N_RUNNERS_BROKER_PORT=5699 n8n n8n execute --id=P2SyncProbe00001 --rawOutput"],
                   capture_output=True, text=True)
t = r.stdout; d7 = json.loads(t[t.find('{'):])['data']['resultData']['runData']['Sync From GitHub'][0]['data']['main'][0][0]['json']
ok7 = d7['decision'] == 'REJECTED_NOT_ALLOWED'; ok_all &= ok7
results.append(dict(case='M7_unparseable_request_n8n', expected='REJECTED_NOT_ALLOWED', n8n=d7['decision'],
                    n8n_current=(d7.get('ledger_entry') or {}).get('sha256'), pass_=ok7))
print(f"{'M7_unparseable_request_n8n':34} want=REJECTED_NOT_ALLOWED n8n={d7['decision']} {'PASS' if ok7 else 'FAIL'}")
# ---- final state, read back independently from each system
MAIN = 'github:KingMega1/scratch:vehicle-data/views/p1_suv_2m.json'
exp = subprocess.run(['ssh', '-o', 'BatchMode=yes', 'carindex-vm',
     'docker exec n8n n8n export:workflow --id=P2SyncProbe00001 --output=/tmp/p2s.json >/dev/null 2>&1; docker exec n8n cat /tmp/p2s.json'],
     capture_output=True, text=True).stdout
wf = json.loads(exp[exp.find('['):])[0]
nled = (wf.get('staticData') or {}).get('global', {}).get('p2sync', {})
dled = json.load(open(os.path.join(DRIVE, 'SYNC_LEDGER.json')))
files = sorted(os.path.relpath(os.path.join(r, f), DRIVE) for r, _, fs in os.walk(DRIVE) for f in fs)
ver = json.loads(subprocess.run(['python3', os.path.join(HERE, 'github_to_drive.py'), 'verify', '--drive-root', DRIVE],
                                capture_output=True, text=True).stdout)
final = dict(
  n8n_workflow=dict(id=wf['id'], versionId=wf.get('versionId'), active=wf.get('active'), updatedAt=wf.get('updatedAt')),
  n8n_artifacts=list(nled.get('artifacts', {})), drive_artifacts=list(dled['artifacts']),
  n8n_main={k: nled['artifacts'][MAIN].get(k) for k in ('version', 'commit', 'sha256', 'git_blob_sha', 'schema', 'last_seen_commit', 'previous', 'consumed')},
  drive_main={k: dled['artifacts'][MAIN].get(k) for k in ('version', 'commit', 'sha256', 'git_blob_sha', 'schema', 'last_seen_commit', 'previous', 'drive_relpath')},
  n8n_events=len(nled.get('events', [])), drive_events=len(dled['events']), drive_files=files, drive_verify=ver)
checks = dict(
  one_artifact_each=final['n8n_artifacts'] == [MAIN] and final['drive_artifacts'] == [MAIN],
  same_version_commit_hash=all(final['n8n_main'][k] == final['drive_main'][k] for k in ('version', 'commit', 'sha256', 'git_blob_sha', 'schema')),
  current_is_v2=final['drive_main']['sha256'] == H['v2'] and final['drive_main']['version'] == 2,
  drive_hash_verified=all(v['ok'] for v in ver),
  no_duplicate_files=sum(1 for f in files if f.endswith('p1_suv_2m.json')) == 2)   # current + versions/1_*
final['checks'] = checks; ok_all &= all(checks.values())
print(json.dumps(checks))
json.dump(dict(run_id=run_id, all_pass=ok_all, results=results, final=final), open(os.path.join(HERE, 'evidence', f'{run_id}.json'), 'w'), indent=1)
print('ALL PASS' if ok_all else 'FAILURES PRESENT', run_id)
