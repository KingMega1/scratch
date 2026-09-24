#!/usr/bin/env python3
"""Check Vehicle Intelligence records against the v1 contract rules. Exit 1 on any violation.

Usage: python3 tools/validate.py [examples/*.json]
Also renders every explanation in Arabic and English to prove presentation needs no duplicated data.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG = json.load(open(os.path.join(ROOT, 'contract', 'field_registry.json'), encoding='utf-8'))
I18N = json.load(open(os.path.join(ROOT, 'contract', 'i18n_labels.json'), encoding='utf-8'))
AR = re.compile(r'[؀-ۿ]')
LAYERS_WITH_NO_STORED_TEXT = ('facts', 'derived', 'signals', 'editorial', 'buyer_fit')


def render(msg, lang):
    tpl = I18N['messages'][msg['key']][lang]
    params = {}
    for k, v in (msg.get('params') or {}).items():
        enum = I18N['enums'].get(k, {})
        params[k] = enum.get(v, {}).get(lang, v) if isinstance(v, str) else (f'{v:,}' if isinstance(v, int) and v > 9999 else v)
    return tpl.format(**params)


def check(path):
    rec = json.load(open(path, encoding='utf-8'))
    errs = []
    e = errs.append
    obs = {o['obs_id']: o for o in rec['observations']}

    for o in rec['observations']:
        for f in ('obs_id', 'entity_ref', 'attribute', 'raw_value', 'source_id', 'observed_at', 'record_ref'):
            if not o.get(f):
                e(f'observation {o.get("obs_id")} missing {f}')
        if o['source_id'] not in rec['sources']:
            e(f'observation {o["obs_id"]} cites unknown source {o["source_id"]}')

    missing_registry = set(REG['facts']) - set(rec['facts'])
    if missing_registry:
        e(f'facts missing from record (must be present, even if unknown): {sorted(missing_registry)}')
    for a, f in rec['facts'].items():
        if a not in REG['facts']:
            e(f'fact {a} not declared in field_registry')
        if f['status'] == 'unknown':
            if f['value'] is not None or not f.get('unknown_reason'):
                e(f'fact {a}: unknown must have value null and an unknown_reason')
        elif f['status'] == 'conflict':
            if f['value'] is not None or len(f.get('candidates', [])) < 2:
                e(f'fact {a}: conflict must keep value null and >=2 candidates')
        else:
            if f['value'] is None:
                e(f'fact {a}: status {f["status"]} but no value')
            if not f['observation_ids'] or any(i not in obs for i in f['observation_ids']):
                e(f'fact {a}: value without valid observations (provenance)')
            if f['confidence'] == 'unknown':
                e(f'fact {a}: known value with unknown confidence')
            if f['status'] == 'resolved' and not f.get('resolution', {}).get('rule'):
                e(f'fact {a}: resolved without a named rule')

    for a, d in rec['derived'].items():
        if d['value'] is None:
            if not d.get('unknown_reason'):
                e(f'derived {a}: null without unknown_reason')
            continue
        if not d.get('formula') or not d.get('inputs'):
            e(f'derived {a}: value without formula/inputs (not explainable)')
        for ref in d['inputs'].values():
            if isinstance(ref, str) and ref.startswith(('facts.', 'derived.')):
                layer, name = ref.split('.', 1)
                if rec[layer].get(name, {}).get('value') is None:
                    e(f'derived {a}: input {ref} is unknown, value must be null')

    for x in rec['editorial']:
        if not x.get('cites'):
            e(f'editorial {x.get("editorial_id")}: no evidence cited')
        if x.get('drafted_by') == 'llm' and x.get('status') == 'approved' and not x.get('approved_by'):
            e(f'editorial {x.get("editorial_id")}: LLM draft approved without a human approver')

    for dim, s in rec['signals'].items():
        if dim not in REG['signals']:
            e(f'signal {dim} not declared in field_registry')
        if s['state'] == 'unknown' and s['value'] is not None:
            e(f'signal {dim}: unknown must have value null (absence of evidence is not a score)')
        if s['value'] is not None and not s['inputs_used']:
            e(f'signal {dim}: value without inputs')
        if s['value'] is not None and REG['signals'][dim]['editorial_required'] and not any(
                x['topic'] == dim and x['status'] == 'approved' for x in rec['editorial']):
            e(f'signal {dim}: needs approved editorial before it can carry a value')
        if isinstance(s['value'], (int, float)) and s['value'] <= 0:
            e(f'signal {dim}: zero/negative value is not allowed as a stand-in for missing evidence')
        if s['value'] is not None and s['rule']['status'] != 'approved':
            s.setdefault('_note', 'rule not approved: scorer must ignore')

    def scan(node, where):
        if isinstance(node, dict):
            for k, v in node.items():
                scan(v, f'{where}.{k}')
        elif isinstance(node, list):
            for i, v in enumerate(node):
                scan(v, f'{where}[{i}]')
        elif isinstance(node, str) and AR.search(node):
            e(f'language-specific text stored in intelligence layer at {where}')
    for layer in LAYERS_WITH_NO_STORED_TEXT:
        scan(rec.get(layer), layer)

    msgs = [d['explanation'] for d in rec['derived'].values() if d.get('explanation')] + \
           [s['explanation'] for s in rec['signals'].values() if s.get('explanation')]
    rendered = []
    for m in msgs:
        if m['key'] not in I18N['messages']:
            e(f'message key {m["key"]} missing in i18n_labels')
            continue
        rendered.append((render(m, 'en'), render(m, 'ar')))
    return rec, errs, rendered


if __name__ == '__main__':
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'examples', '*.json')))
    bad = 0
    for f in files:
        rec, errs, rendered = check(f)
        print(f'\n{os.path.basename(f)}: {"OK" if not errs else f"{len(errs)} VIOLATIONS"}')
        for x in errs:
            print('  !', x)
        bad += len(errs)
        sig = rec['signals']['price_position']
        if sig.get('explanation'):
            print('  EN:', render(sig['explanation'], 'en'))
            print('  AR:', render(sig['explanation'], 'ar'))
    sys.exit(1 if bad else 0)
