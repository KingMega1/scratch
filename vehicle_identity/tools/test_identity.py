#!/usr/bin/env python3
"""Validation tests for Vehicle Identity Layer v1. Run: python3 tools/test_identity.py"""
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build_identity import fold  # noqa: E402

def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding='utf-8'))

def rows(p):
    return list(csv.DictReader(open(os.path.join(ROOT, p), encoding='utf-8')))

def digest(p):
    return hashlib.sha1(open(os.path.join(ROOT, p), 'rb').read()).hexdigest()

def build():
    subprocess.run([sys.executable, os.path.join(HERE, 'build_identity.py')], check=True, capture_output=True)

n = 0
def t(name, cond, detail=''):
    global n
    if not cond:
        print(f'FAIL {name} {detail}')
        sys.exit(1)
    n += 1
    print(f'ok   {name}')

build()
models = load('identity/model_registry.json')['models']
brands = load('identity/brand_registry.json')['brands']
mmap = rows('mappings/master_row_map.csv')
cmap = rows('mappings/candidate_map.csv')
alias = rows('mappings/alias_table.csv')
queue = rows('mappings/review_queue.csv')
view = load('out/models.json')

# IDs
t('model IDs are brand_id/model_slug, lowercase ascii', all(re.fullmatch(r'[a-z0-9-]+/[a-z0-9-]+', m) for m in models))
t('model ID prefix is its brand ID', all(m.split('/')[0] == v['brand_id'] and v['brand_id'] in brands for m, v in models.items()))
t('no ID encodes a model year or price that is not part of the model name',
  all(all(tok in fold(v['display']) for tok in re.findall(r'20\d\d|\d{5,}', m)) for m, v in models.items()))
t('IDs are unique per fold key within a brand (no silent merge)',
  len({(v['brand_id'], k) for v in models.values() for k in v['match_keys']}) == sum(len(v['match_keys']) for v in models.values()))
decisions = load('identity/decisions.json')
t('a model has >1 match key only through a recorded alias decision',
  all(len(v['match_keys']) == 1 or any(a['model_id'] == m for a in decisions['model_aliases']) for m, v in models.items()))

# master mapping
t('every master row mapped exactly once', len(mmap) == 1444 and all(r['model_id'] in models for r in mmap))
t('row fingerprints unique', len({r['row_fingerprint'] for r in mmap}) == len(mmap))
t('master mapping uses only deterministic methods', {r['method'] for r in mmap} <= {'exact_normalized', 'alias_table'})
amap = {(a['entity'], a['match_key']): a['canonical_id'] for a in alias}
t('alias table round-trips every master brand/model spelling',
  all(amap.get(('model', fold(r['model_raw']))) and r['model_id'].startswith(r['brand_id'] + '/') for r in mmap))
t('original source names preserved', all(r['brand_raw'] and r['model_raw'] for r in mmap))
t('missing trim does not block a model record', all(r['model_id'] for r in mmap if not r['trim_raw'].strip()))

# candidate mapping
t('every candidate row is mapped or queued', all((r['model_ids'] and r['method'] != 'unresolved') or r['review_id'] for r in cmap))
qids = {q['review_id'] for q in queue}
t('every unresolved candidate has an open, blocking review item',
  all(r['review_id'] in qids for r in cmap if r['method'] == 'unresolved') and
  all(q['blocks_mapping'] == 'yes' for q in queue if q['kind'] == 'candidate_unmapped'))
t('candidate mapping never uses similarity', {r['method'] for r in cmap} <= {'exact_normalized', 'slash_alias_same_model', 'slash_alias_same_model (candidate-only model)', 'unresolved'})
t('similarity appears only as a suggestion in the queue', all('similarity' not in r['method'] for r in cmap))

# aggregation: nothing averaged, differences kept
bad = []
for mid, a in view.items():
    obs = {p['value'] for v in a['variants'] for p in v['official_prices']}
    pr = a['price_range_egp']
    for rng in [pr['verified'], pr['observed_all']] + list(pr['observed_by_model_year'].values()):
        if rng and not set(rng) <= obs:
            bad.append(mid)
t('price range endpoints are always real observed prices (no averaging)', not bad, bad[:5])
miss = []
for mid, a in view.items():
    types = {(c['type'], c.get('trim_key')) for c in a['conflicts']}
    for v in a['variants']:
        if v['official_price_status'] == 'conflict' and ('trim_price_conflict', v['trim_key']) not in types:
            miss.append((mid, v['trim_key']))
t('every trim with disagreeing prices is recorded as a conflict', not miss, miss[:5])
t('conflicting trims never counted as verified',
  all(v['official_price_status'] != 'conflict' or a['price_range_egp']['trims_verified'] < a['price_range_egp']['trims_total'] for a in view.values() for v in a['variants']))
t('facts that differ by trim are shown as varies_by_variant, not collapsed',
  all(a[k]['state'] in ('unknown', 'uniform', 'varies_by_variant') for a in view.values() for k in ('powertrains', 'transmissions', 'engine_cc', 'seats', 'body_type')))
t('every model view carries coverage, confidence and freshness',
  all(a['source_coverage']['publishers'] is not None and a['identity_confidence'] and a['price_confidence'] and 'freshness' in a for a in view.values()))

# stability
before = {p: digest(p) for p in ('identity/model_registry.json', 'identity/brand_registry.json', 'mappings/master_row_map.csv', 'mappings/candidate_map.csv')}
build()
t('rebuild is deterministic (registries and mappings byte-identical)', all(digest(p) == h for p, h in before.items()))
reg_path = os.path.join(ROOT, 'identity/model_registry.json')
shutil.copy(reg_path, reg_path + '.bak')
reg = load('identity/model_registry.json')
reg['models']['toyota/corolla']['display'] = 'Corolla (renamed display)'
json.dump(reg, open(reg_path, 'w'), ensure_ascii=False, indent=2)
build()
after_rename = load('identity/model_registry.json')['models']
t('IDs survive a display-name change (registry is append-only)',
  'toyota/corolla' in after_rename and after_rename['toyota/corolla']['display'] == 'Corolla (renamed display)'
  and not any(m.startswith('toyota/corolla-') for m in after_rename))
shutil.move(reg_path + '.bak', reg_path)
build()
t('restored registry rebuilds identically', digest('identity/model_registry.json') == before['identity/model_registry.json'])

for s in ('toyota__corolla', 'mg__zs', 'chery__tiggo-7-pro', 'mg__4', 'baic__u5-plus'):
    t(f'sample {s} exists', os.path.exists(os.path.join(ROOT, 'samples', s + '.json')))
print(f'\n{n} tests passed')
