#!/usr/bin/env python3
"""Negative tests: each mutation must be caught by validate.check(). Run: python3 tools/test_contract.py"""
import copy, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate import check
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = json.load(open(os.path.join(ROOT, 'examples', 'toyota-corolla__2026__active.json'), encoding='utf-8'))

def mutated(fn):
    r = copy.deepcopy(base); fn(r)
    p = tempfile.mktemp(suffix='.json'); json.dump(r, open(p, 'w'), ensure_ascii=False)
    return check(p)[1]

cases = {
  'invented value without provenance': lambda r: r['facts']['curb_weight_kg'].update(value=1300, status='single_source', confidence='medium', observation_ids=[]),
  'unknown fact carrying a value': lambda r: r['facts']['seats'].update(status='unknown', value=5),
  'conflict silently picking a value': lambda r: r['facts']['model_year'].update(status='conflict', value=2026, candidates=[{'value': 2026}, {'value': 2027}]),
  'resolved without a named rule': lambda r: r['facts']['official_price_egp'].update(status='resolved', resolution={}),
  'derived value from unknown input': lambda r: r['derived'].update(footprint_m2={'value': 8.2, 'formula': 'D-FOOTPRINT@1', 'inputs': {'l': 'facts.curb_weight_kg'}, 'confidence': 'low'}),
  'absence of evidence scored as zero': lambda r: r['signals']['reliability_evidence'].update(value=0, state='known', inputs_used=['brand_years_in_egypt']),
  'unknown signal with a value': lambda r: r['signals']['safety_evidence'].update(value=2),
  'editorial-required signal without approved editorial': lambda r: r['signals']['comfort'].update(value=4, state='known'),
  'editorial without evidence': lambda r: r['editorial'].append({'editorial_id': 'e1', 'topic': 'comfort', 'stance': 'strength', 'claim': {'key': 'x'}, 'cites': [], 'status': 'draft', 'author': 'x'}),
  'LLM editorial approved with no human': lambda r: r['editorial'].append({'editorial_id': 'e2', 'topic': 'comfort', 'stance': 'strength', 'claim': {'key': 'x'}, 'cites': ['facts.wheelbase_mm'], 'status': 'approved', 'author': 'llm', 'drafted_by': 'llm'}),
  'Arabic text stored in intelligence layer': lambda r: r['signals']['price_position'].update(note='رخيصة'),
  'registry fact dropped from record': lambda r: r['facts'].pop('turning_circle_m'),
}
failed = 0
for name, fn in cases.items():
    errs = mutated(fn)
    print(('ok    ' if errs else 'MISSED') + ' ' + name + (f'  -> {errs[0]}' if errs else ''))
    failed += not errs
print(f'\n{len(cases) - failed}/{len(cases)} violations caught')
sys.exit(1 if failed else 0)
