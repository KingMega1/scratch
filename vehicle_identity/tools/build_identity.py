#!/usr/bin/env python3
"""CarIndex Vehicle Identity Layer v1 — canonical BRAND -> MODEL identity.

Inputs (read-only, never modified):
  vehicle_intelligence/_src/carindex_master.csv, vehicle_candidates.csv   (Drive snapshot 2026-09-17)
  vehicle_identity/identity/*.json   (persisted registry + human decisions)

Outputs:
  identity/brand_registry.json, identity/model_registry.json     stable IDs (append-only)
  mappings/alias_table.csv          every raw brand/model spelling -> canonical ID       [committed]
  mappings/master_row_map.csv       master row fingerprint -> model_id                  [committed]
  mappings/candidate_map.csv        candidate row -> model_id(s)                        [committed]
  mappings/review_queue.csv         ambiguous / unresolved items for a human            [committed, no prices]
  reports/integrity_metrics.json    before/after                                        [committed]
  reports/investigations.json       the 6 investigations (counts + examples, no price tables)
  out/models.json                   model-level aggregated view, ALL models (prices)    [git-ignored]
  samples/*.json                    aggregated view for the 5 test models               [committed]

Identity decisions are made only by (1) exact match after case/space/punctuation/accent
normalization, (2) the persisted alias table, or (3) a recorded human decision. Similarity
scores are used only to SUGGEST review items, never to merge.
"""
import csv
import datetime
import hashlib
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
sys.path.insert(0, REPO)
from vehicle_common.parse import source_info, p_int_price, p_range_price, p_fuel, p_trans, p_body, p_number, p_cm_to_mm, p_warranty, p_torque  # noqa: E402

SRC = os.path.join(REPO, 'vehicle_intelligence', '_src')
AS_OF = '2026-09-24'
ID_DIR, MAP_DIR, REP_DIR, OUT_DIR, SAMPLE_DIR = (os.path.join(ROOT, d) for d in ('identity', 'mappings', 'reports', 'out', 'samples'))
SAMPLE_MODELS = ['toyota/corolla', 'mg/zs', 'chery/tiggo-7-pro', 'mg/4', 'baic/u5-plus']
TIER_RANK = {'A': 4, 'B': 3, 'C': 2, 'D': 1}


# ------------------------------------------------------------------ normalization (deterministic, no similarity)
def fold(s):
    """Match key: accents removed, lowercase, only a-z0-9. 'CR-V'=='CRV', 'XC 60'=='XC60', 'Citroën'=='Citroen'."""
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', s.lower())


def slug(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def trim_key(s):
    """Groups trim spellings WITHIN one model only ('Smart with Sunroof' == 'SMART / Sun Roof'). Not an identity."""
    s = (s or '').lower()
    s = re.sub(r'\bwith\b|\bw/|[+/&]', ' ', s)
    s = s.replace('sun roof', 'sunroof')
    return fold(s)


def fingerprint(*parts):
    return hashlib.sha1('|'.join(parts).encode('utf-8')).hexdigest()[:12]


def load_json(path, default):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else default


def dump_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(obj, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(path, 'a').write('\n')


def write_csv(path, rows, cols):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)


# ------------------------------------------------------------------ suffix classes for "one name extends another"
GEN_OR_ASSEMBLY = re.compile(r'^(facelift|new|ckd|cbu|mce|gen\d*|[a-z]{1,2}\d{0,2}[a-z]?|nx4e|cn7|hci|neueklasse)$')
POWERTRAIN = re.compile(r'^(ev|electric|etron|hev|phev|dmi|emi|hybrid|iq|iql|e)$')


def classify_extension(base_disp, ext_disp):
    base_tokens = re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKD', base_disp).encode('ascii', 'ignore').decode().lower())
    ext_tokens = re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKD', ext_disp).encode('ascii', 'ignore').decode().lower())
    if ext_tokens[:len(base_tokens)] != base_tokens:
        return 'name_prefix_only'  # e.g. Seal -> Sealion, iX -> iX3: different words, different models
    suffix = ''.join(ext_tokens[len(base_tokens):])
    if POWERTRAIN.match(suffix):
        return 'powertrain_suffix'
    if suffix in ('facelift', 'new', 'ckd', 'cbu', 'mce') or re.fullmatch(r'(ad|cn7|nx4e|hci|rb|a8|neueklasse)', suffix):
        return 'generation_or_assembly_suffix'
    return 'nameplate_suffix'  # Pro, Max, Plus, Sport, Coupe, Aircross, GT, X ...


# ------------------------------------------------------------------ build
def main():
    master = list(csv.DictReader(open(os.path.join(SRC, 'carindex_master.csv'), encoding='utf-8')))
    cands = list(csv.DictReader(open(os.path.join(SRC, 'vehicle_candidates.csv'), encoding='utf-8')))
    brand_reg = load_json(os.path.join(ID_DIR, 'brand_registry.json'), {'brands': {}})
    model_reg = load_json(os.path.join(ID_DIR, 'model_registry.json'), {'models': {}})
    decisions = load_json(os.path.join(ID_DIR, 'decisions.json'), {'display_overrides': {}, 'model_aliases': [], 'cohort_exceptions': []})

    # ---- BEFORE metrics
    before = {
        'master_rows': len(master), 'candidate_rows': len(cands),
        'distinct_brand_strings (master+candidates)': len({r['brand_normalized'] for r in master} | {c['brand'] for c in cands}),
        'distinct_brand+model_strings (master+candidates)': len({(r['brand_normalized'], r['model_normalized']) for r in master} | {(c['brand'], c['model']) for c in cands}),
        'master rows where model_normalized differs from model_raw': sum(r['model_raw'] != r['model_normalized'] for r in master),
        'candidates linkable to master by exact brand+model+year strings': 0,
        'candidates linkable to master by exact brand+model+year+trim strings': 0,
        'duplicate candidate keys (brand, model, year, trim)': sum(n - 1 for n in Counter((c['brand'], c['model'], c['model_year'], c['variant_normalized']) for c in cands).values() if n > 1),
        'stable vehicle ID on any row': 0,
    }
    mk = {(r['brand_normalized'], r['model_normalized'], r['model_year']) for r in master}
    mkv = {(r['brand_normalized'], r['model_normalized'], r['model_year'], r['variant_raw']) for r in master}
    before['candidates linkable to master by exact brand+model+year strings'] = sum((c['brand'], c['model'], c['model_year']) in mk for c in cands)
    before['candidates linkable to master by exact brand+model+year+trim strings'] = sum((c['brand'], c['model'], c['model_year'], c['variant_normalized']) in mkv for c in cands)

    review = []
    def queue(kind, key, detail, suggestion, blocking):
        review.append({'review_id': f'R-{fingerprint(kind, key)}', 'kind': kind, 'key': key, 'detail': detail,
                       'suggestion': suggestion, 'blocks_mapping': 'yes' if blocking else 'no', 'status': 'open'})

    # ---- BRANDS: group spellings by fold key
    brand_spell = defaultdict(Counter)
    for r in master:
        brand_spell[fold(r['brand_normalized'])][r['brand_normalized']] += 1
    for c in cands:
        brand_spell[fold(c['brand'])][c['brand']] += 1
    brand_by_key = {}
    for bkey, spells in sorted(brand_spell.items()):
        existing = next((bid for bid, b in brand_reg['brands'].items() if bkey in b['match_keys']), None)
        display = decisions['display_overrides'].get(f'brand:{bkey}') or sorted(spells.items(), key=lambda x: (-x[1], x[0]))[0][0]
        if existing is None:
            bid = slug(display)
            assert bid not in brand_reg['brands'], f'brand id collision {bid}'
            brand_reg['brands'][bid] = {'brand_id': bid, 'display': display, 'match_keys': [bkey], 'created': AS_OF, 'status': 'active'}
            existing = bid
        brand_reg['brands'][existing]['display'] = display
        brand_reg['brands'][existing]['spellings'] = dict(spells)
        brand_by_key[bkey] = existing
        if len(spells) > 1:
            queue('brand_spelling_normalized', f'brand:{bkey}', f'spellings {dict(spells)} -> "{display}" ({existing})',
                  'confirm display name', False)

    # ---- MODELS: group (brand_id, fold(model)) — exact after normalization
    model_spell = defaultdict(Counter)
    for r in master:
        model_spell[(brand_by_key[fold(r['brand_normalized'])], fold(r['model_normalized']))][r['model_normalized']] += 1
    alias_rules = {(a['brand_id'], a['match_key']): a['model_id'] for a in decisions['model_aliases']}

    def register_model(bid, mkey, spells, origin):
        for mid, m in model_reg['models'].items():
            if m['brand_id'] == bid and mkey in m['match_keys']:
                return mid
        if (bid, mkey) in alias_rules:
            mid = alias_rules[(bid, mkey)]
            model_reg['models'][mid]['match_keys'].append(mkey)
            return mid
        display = decisions['display_overrides'].get(f'model:{bid}/{mkey}') or sorted(spells.items(), key=lambda x: (-x[1], x[0]))[0][0]
        mid = f'{bid}/{slug(display)}'
        n = 2
        while mid in model_reg['models']:
            mid = f'{bid}/{slug(display)}-{n}'
            n += 1
        model_reg['models'][mid] = {'model_id': mid, 'brand_id': bid, 'display': display, 'match_keys': [mkey],
                                    'created': AS_OF, 'origin': origin, 'status': 'active', 'merged_into': None}
        return mid

    model_by_key = {}
    for (bid, mkey), spells in sorted(model_spell.items()):
        mid = register_model(bid, mkey, spells, 'carindex_master.csv')
        model_by_key[(bid, mkey)] = mid
        model_reg['models'][mid]['spellings'] = dict(spells)
        if len(spells) > 1:
            queue('model_spelling_normalized', mid, f'spellings {dict(spells)}', f'display "{model_reg["models"][mid]["display"]}"; confirm', False)

    # ---- brand / sub-brand overlap and the same model key under two brands (never merged automatically)
    for b1 in brand_reg['brands'].values():
        for b2 in brand_reg['brands'].values():
            if b1 is not b2 and fold(b2['display']).startswith(fold(b1['display'])):
                shared = sorted({k for (bid, k) in model_spell if bid == b1['brand_id']} & {k for (bid, k) in model_spell if bid == b2['brand_id']})
                queue('brand_sub_brand_overlap', f'{b1["brand_id"]} | {b2["brand_id"]}',
                      f'"{b2["display"]}" looks like a sub-brand of "{b1["display"]}"; model keys under both: {shared or "none"}',
                      'decide: sub-brand as its own brand, or brand alias (then duplicate models merge via model_aliases)', bool(shared))

    # ---- MASTER ROW MAP
    master_map = []
    seen_fp = Counter()
    for i, r in enumerate(master):
        bid = brand_by_key[fold(r['brand_normalized'])]
        mid = model_by_key[(bid, fold(r['model_normalized']))]
        fp = fingerprint(r['source'], r['source_url'], r['brand_raw'], r['model_raw'], r['variant_raw'], r['model_year'])
        seen_fp[fp] += 1
        if seen_fp[fp] > 1:
            fp = f'{fp}-{seen_fp[fp]}'
        master_map.append({'row_fingerprint': fp, 'master_line': i + 2, 'source': r['source'], 'brand_raw': r['brand_raw'], 'model_raw': r['model_raw'],
                           'trim_raw': r['variant_raw'], 'model_year_raw': r['model_year'], 'brand_id': bid, 'model_id': mid,
                           'method': 'exact_normalized' if r['model_normalized'] in model_reg['models'][mid]['spellings'] else 'alias_table',
                           'trim_key': trim_key(r['variant_raw']), 'is_summary_row': 'yes' if source_info(r['source'])['type'] in ('aggregator_summary',) else 'no'})

    # ---- "one name extends another" pairs within a brand: never merged, classified for review
    by_brand = defaultdict(list)
    for mid, m in model_reg['models'].items():
        by_brand[m['brand_id']].append(m)
    for bid, ms in by_brand.items():
        for a in ms:
            for b in ms:
                ka, kb = a['match_keys'][0], b['match_keys'][0]
                if a is b or not kb.startswith(ka) or ka == kb:
                    continue
                cls = classify_extension(a['display'], b['display'])
                if cls in ('powertrain_suffix', 'generation_or_assembly_suffix'):
                    queue(f'same_model_or_separate:{cls}', f'{a["model_id"]} | {b["model_id"]}',
                          f'"{b["display"]}" extends "{a["display"]}"; kept as separate models',
                          'merge as alias (default for trims/assembly/facelift) OR keep separate / cohort exception (different generation or architecture)', False)

    # ---- CANDIDATE MAP
    cand_map = []
    for i, c in enumerate(cands):
        bkey = fold(c['brand'])
        bid = brand_by_key.get(bkey)
        fp = fingerprint('cand', c['brand'], c['model'], c['model_year'], c['variant_normalized'], str(i))
        row = {'candidate_fingerprint': fp, 'candidate_line': i + 2, 'brand_raw': c['brand'], 'model_raw': c['model'], 'model_year_raw': c['model_year'],
               'trim_raw': c['variant_normalized'], 'status_raw': c['status'], 'brand_id': bid, 'model_ids': '', 'method': '', 'review_id': ''}
        mkey = fold(c['model'])
        if (bid, mkey) in model_by_key:
            row.update(model_ids=model_by_key[(bid, mkey)], method='exact_normalized')
        else:
            parts = [p.strip() for p in re.split(r'\s*/\s*', c['model']) if p.strip()]
            hits = sorted({model_by_key[(bid, fold(p))] for p in parts if (bid, fold(p)) in model_by_key})
            unmatched = [p for p in parts if (bid, fold(p)) not in model_by_key]
            if len(parts) > 1 and len(hits) == 1 and not unmatched:
                row.update(model_ids=hits[0], method='slash_alias_same_model')
            elif len(parts) > 1 and all(fold(p) == fold(parts[0]) for p in parts):
                mid = register_model(bid, fold(parts[0]), Counter({parts[0]: 1}), 'vehicle_candidates.csv')
                model_by_key[(bid, fold(parts[0]))] = mid
                row.update(model_ids=mid, method='slash_alias_same_model (candidate-only model)')
            else:
                rid = 'R-' + fingerprint('candidate_unmapped', c['brand'] + ' | ' + c['model'])
                row.update(model_ids=';'.join(hits), method='unresolved', review_id=rid)
                sugg = []
                for p in unmatched:
                    best = max(((SequenceMatcher(None, fold(p), m['match_keys'][0]).ratio(), m['model_id']) for m in by_brand.get(bid, [])), default=(0, ''))
                    if best[0] >= 0.75:
                        sugg.append(f'"{p}" ~ {best[1]} (similarity {best[0]:.2f}, suggestion only)')
                queue('candidate_unmapped', f'{c["brand"]} | {c["model"]}',
                      f'covers {len(parts)} name(s); matched {hits or "none"}; unmatched {unmatched}',
                      ('; '.join(sugg) or 'split candidate row per model, or map to an existing model') , True)
        cand_map.append(row)

    # candidate duplicates
    dups = Counter((c['brand'], c['model'], c['model_year'], c['variant_normalized']) for c in cands)
    for k, n in dups.items():
        if n > 1:
            queue('duplicate_candidate', ' | '.join(k), f'{n} identical candidate rows', 'keep one; rows compared in investigations.json', False)

    # ---- AGGREGATED MODEL VIEW
    rows_by_model = defaultdict(list)
    for mm, r in zip(master_map, master):
        rows_by_model[mm['model_id']].append((mm, r))
    cands_by_model = defaultdict(list)
    for cm, c in zip(cand_map, cands):
        for mid in filter(None, cm['model_ids'].split(';')):
            cands_by_model[mid].append((cm, c))

    def price_status(vals):
        """vals: [(value, source_name, date)] for one trim. R0 tolerance: within max(1000, 0.1%)."""
        if not vals:
            return 'none', None
        groups = []
        for v, s, d, y in vals:
            g = next((g for g in groups if abs(g['v'] - v) <= max(1000, 0.001 * max(g['v'], v))), None)
            if g:
                g['obs'].append((v, s, d, y))
            else:
                groups.append({'v': v, 'obs': [(v, s, d, y)]})
        if len(groups) > 1:
            year_sets = [{o[3] for o in g['obs']} for g in groups]
            disjoint = all(not (a & b) for i, a in enumerate(year_sets) for b in year_sets[i + 1:])
            return ('varies_by_model_year' if disjoint else 'conflict'), groups
        pubs = {source_info(s)['publisher'] for _, s, _, _ in groups[0]['obs']}
        tiers = {source_info(s)['tier'] for _, s, _, _ in groups[0]['obs']}
        if 'A' in tiers:
            return 'official_source', groups
        return ('agreed' if len(pubs) >= 2 else 'single_source'), groups

    models_out = {}
    variant_material = []
    for mid, m in sorted(model_reg['models'].items()):
        rows = rows_by_model.get(mid, [])
        trims = defaultdict(lambda: {'labels': defaultdict(set), 'years': set(), 'official': [], 'market': [], 'fuel': Counter(), 'trans': Counter(),
                                     'cc': Counter(), 'hp': Counter(), 'seats': Counter(), 'body': Counter(), 'body_src': defaultdict(set)})
        summary_ranges = []
        classified = []
        body_obs = defaultdict(set)
        years = defaultdict(set)
        sources = Counter()
        pubs = set()
        latest_price_date = None
        for mm, r in rows:
            info = source_info(r['source'])
            sources[r['source']] += 1
            pubs.add(info['publisher'])
            b, _ = p_body(r['body_type_normalized'])
            if b:
                body_obs[b].add(r['source'])
            years[r['model_year']].add(r['source'])
            if r['price_date']:
                latest_price_date = max(latest_price_date or '', r['price_date'])
            if info['type'] == 'aggregator_classified':
                classified.append({'source': r['source'], 'label': r['variant_raw'], 'market_price': p_int_price(r['market_price'])[0], 'fuel': p_fuel(r['fuel_type_raw'])[0]})
                continue
            if info['type'] == 'aggregator_summary' or re.search(r'range|class', r['variant_raw'], re.I):
                rng, _ = p_range_price(r['official_price'])
                one, _ = p_int_price(r['official_price'])
                summary_ranges.append({'source': r['source'], 'label': r['variant_raw'], 'model_year': r['model_year'],
                                       'range': rng or ([one, one] if one else None), 'raw': r['official_price']})
                continue
            t = trims[mm['trim_key'] or '(no trim)']
            t['labels'][r['source']].add(r['variant_raw'] or '(none)')
            t['years'].add(r['model_year'])
            op, _ = p_int_price(r['official_price'])
            if op:
                t['official'].append((op, r['source'], r['price_date'] or r['collection_date'], r['model_year']))
            mp, _ = p_int_price(r['market_price'])
            if mp:
                t['market'].append((mp, r['source'], r['price_date'] or r['collection_date']))
            for key, col, fn in (('fuel', 'fuel_type_raw', p_fuel), ('trans', 'transmission', p_trans), ('body', 'body_type_normalized', p_body)):
                v, _ = fn(r[col])
                if v:
                    t[key][v] += 1
                    if key == 'body':
                        t['body_src'][v].add(r['source'])
            cc, _ = p_number(r['engine_capacity'], r'(cc)?')
            if cc:
                t['cc'][int(cc)] += 1
            hp, _ = p_number(r['horsepower'])
            if hp:
                t['hp'][hp] += 1
            st, _ = p_number(r['seats'])
            if st:
                t['seats'][int(st)] += 1

        variants = []
        verified_prices, all_prices, conflicts = [], [], []
        by_year = defaultdict(list)
        for t in trims.values():
            for v, _, _, y in t['official']:
                by_year[y].append(v)
        for tk, t in sorted(trims.items()):
            status, groups = price_status(t['official'])
            entry = {'trim_key': tk, 'labels_by_source': {s: sorted(v) for s, v in t['labels'].items()}, 'model_years': sorted(t['years']),
                     'official_price_status': status,
                     'official_prices': [{'value': v, 'source': s, 'date': d, 'model_year': y} for v, s, d, y in t['official']],
                     'market_prices': [{'value': v, 'source': s, 'date': d} for v, s, d in t['market']],
                     'fuel_types': sorted(t['fuel']), 'transmissions': sorted(t['trans']), 'engine_cc': sorted(t['cc']), 'power_hp': sorted(t['hp']), 'seats': sorted(t['seats'])}
            variants.append(entry)
            all_prices += [v for v, _, _, _ in t['official']]
            if status in ('agreed', 'official_source'):
                verified_prices.append(groups[0]['v'] if status == 'agreed' else max(groups[0]['obs'], key=lambda o: TIER_RANK[source_info(o[1])['tier']])[0])
            if status == 'conflict':
                conflicts.append({'type': 'trim_price_conflict', 'trim_key': tk, 'values': sorted({g['v'] for g in groups})})
            if status == 'varies_by_model_year':
                conflicts.append({'type': 'trim_price_differs_by_model_year', 'trim_key': tk,
                                  'values': {'/'.join(sorted({o[3] for o in g['obs']})): g['v'] for g in groups}})
            if len(t['years']) > 1:
                conflicts.append({'type': 'model_year_disagreement', 'trim_key': tk, 'values': sorted(t['years'])})
            if len(t['body']) > 1:
                conflicts.append({'type': 'body_type_conflict', 'trim_key': tk, 'values': {b: sorted(src) for b, src in t['body_src'].items()}})

        def model_level(key):
            vals = Counter()
            unknown = 0
            for t in trims.values():
                tv = set(t[key])
                if key == 'trans' and 'automatic' in tv and len(tv & {'cvt', 'dct', 'dht', 'single_speed'}) == 1:
                    tv.discard('automatic')  # R1 specificity within one trim
                if tv:
                    for v in tv:
                        vals[v] += 1
                else:
                    unknown += 1
            if not vals:
                return {'state': 'unknown'}
            if len(vals) == 1:
                return {'state': 'uniform', 'value': next(iter(vals)), 'trims_reporting': sum(vals.values()), 'trims_unknown': unknown}
            return {'state': 'varies_by_variant', 'values': {str(k): n for k, n in vals.items()}, 'trims_unknown': unknown}

        agg = {
            'model_id': mid, 'brand_id': m['brand_id'], 'display': m['display'],
            'brand_display': brand_reg['brands'][m['brand_id']]['display'],
            'aliases': sorted({(mm['source'], mm['brand_raw'], mm['model_raw']) for mm, _ in rows}) + sorted({('vehicle_candidates.csv', cm['brand_raw'], cm['model_raw']) for cm, _ in cands_by_model.get(mid, [])}),
            'price_range_egp': {
                'verified': [min(verified_prices), max(verified_prices)] if verified_prices else None,
                'verified_basis': 'trims whose official price is agreed by >=2 publishers or given by an official source',
                'observed_all': [min(all_prices), max(all_prices)] if all_prices else None,
                'observed_by_model_year': {y: [min(v), max(v)] for y, v in sorted(by_year.items())},
                'summary_rows': summary_ranges,
                'trims_verified': len(verified_prices), 'trims_priced': sum(1 for v in variants if v['official_prices']), 'trims_total': len(variants)},
            'powertrains': model_level('fuel'),
            'transmissions': model_level('trans'),
            'engine_cc': model_level('cc'),
            'power_hp': model_level('hp'),
            'seats': model_level('seats'),
            'body_type': model_level('body'),
            'model_years_observed': {y: sorted(s) for y, s in sorted(years.items())},
            'variants': variants,
            'conflicts': conflicts,
            'source_coverage': {'publishers': sorted(pubs), 'rows_by_source': dict(sources), 'candidate_rows': len(cands_by_model.get(mid, []))},
            'identity_confidence': 'high' if len(pubs) >= 2 else ('medium' if pubs else 'low'),
            'price_confidence': None,
            'freshness': {'collection_date': '2026-09-10' if rows else None, 'latest_price_date': latest_price_date,
                          'age_days_at_' + AS_OF: (datetime.date.fromisoformat(AS_OF) - datetime.date(2026, 9, 10)).days if rows else None},
            'candidate_status_raw': sorted({c['status'] for _, c in cands_by_model.get(mid, [])}),
        }
        if any(c['type'] == 'body_type_conflict' for c in conflicts):
            agg['body_type']['conflict_within_trim'] = True
        agg['classified_observations'] = classified
        # corroborated range: an independent publisher's summary range equals the trim-level min/max (R0 tolerance)
        obs_rng = agg['price_range_egp']['observed_all']
        trim_pubs = {source_info(s)['publisher'] for t in trims.values() for _, s, _, _ in t['official']}
        corr = [x for x in summary_ranges if x['range'] and obs_rng and source_info(x['source'])['publisher'] not in trim_pubs
                and all(abs(a - b) <= max(1000, 0.001 * a) for a, b in zip(x['range'], obs_rng))]
        agg['price_range_egp']['corroborated_by_summary'] = [x['source'] + ' ' + x['label'] for x in corr]
        agg['price_range_egp']['range_status'] = ('verified_trims' if agg['price_range_egp']['verified'] else
                                                  'corroborated_by_independent_summary' if corr else
                                                  'single_source' if obs_rng else 'unknown')
        for key in ('powertrains', 'engine_cc', 'seats', 'body_type'):
            if agg[key]['state'] == 'varies_by_variant':
                variant_material.append({'model_id': mid, 'fact': key, 'values': agg[key]['values']})
        agg['price_confidence'] = {'verified_trims': 'high', 'corroborated_by_independent_summary': 'medium', 'single_source': 'low', 'unknown': 'unknown'}[agg['price_range_egp']['range_status']]
        models_out[mid] = agg
        if not rows:
            agg['note'] = 'candidate-only model: no master rows'

    # ---- INVESTIGATIONS
    inv = {}
    # (1) candidate prices not in master
    disc = []
    for cm, c in zip(cand_map, cands):
        mids = [x for x in cm['model_ids'].split(';') if x]
        nums = [int(x.replace(',', '')) for x in re.findall(r'\d[\d,]{5,}', c['prices'])]
        if not nums or len(mids) != 1:
            continue
        mprices = sorted({v for mm, r in rows_by_model[mids[0]] for v in [p_int_price(r['official_price'])[0], p_int_price(r['market_price'])[0]] if v} |
                         {x for mm, r in rows_by_model[mids[0]] for x in (p_range_price(r['official_price'])[0] or [])})
        missing = [n for n in nums if n not in mprices]
        if not missing or not mprices:
            continue
        near = [min(mprices, key=lambda p: abs(p - n)) for n in missing]
        deltas = [n - p for n, p in zip(missing, near)]
        if all(abs(d) <= max(1000, 0.001 * n) for d, n in zip(deltas, missing)):
            cls = 'rounding (<= max(1,000 EGP, 0.1%))'
        elif len(set(deltas)) == 1 and len(deltas) > 1:
            cls = f'constant offset {deltas[0]:+,} on every candidate price'
        elif all(d > 0 for d in deltas):
            cls = 'all candidate prices higher than nearest master price'
        elif all(d < 0 for d in deltas):
            cls = 'all candidate prices lower than nearest master price'
        else:
            cls = 'mixed / unexplained'
        disc.append({'model_id': mids[0], 'candidate_line': cm['candidate_line'], 'candidate_prices': nums, 'missing_in_master': missing,
                     'nearest_master': near, 'delta': deltas, 'classification': cls, 'candidate_status_raw': c['status']})
    inv['1_candidate_master_price_discrepancies'] = {
        'count': len(disc), 'by_classification': dict(Counter(d['classification'].split(' on ')[0] if d['classification'].startswith('constant') else d['classification'] for d in disc)),
        'by_brand': dict(Counter(d['model_id'].split('/')[0] for d in disc)), 'cases': disc}
    for d in disc:
        queue('candidate_price_not_in_master', f'{d["model_id"]} (candidate line {d["candidate_line"]})', d['classification'],
              'regenerate candidate prices from master, or record the source/date the candidate price came from', False)

    # (2) MG 4 body
    mg4 = models_out.get('mg/4', {})
    inv['2_mg4_body_type'] = {'model_id': 'mg/4', 'body_type': mg4.get('body_type'), 'rows': [(mm['source'], mm['trim_raw'], r['body_type_raw'], r['body_type_normalized']) for mm, r in rows_by_model.get('mg/4', [])],
                              'finding': 'Only ContactCars gives a body type (SUV); the Hatla2ee summary row has NOT_AVAILABLE. No second source to confirm or contradict. Kept as sourced; queued for a human check against the distributor.'}
    queue('suspect_value', 'mg/4 body_type', 'single source (ContactCars) says SUV; no corroboration', 'check MG Egypt / Mansour listing for the body type', False)

    # (3) normalization problems
    inv['3_normalization'] = {
        'brand_multi_spelling': {b['brand_id']: b['spellings'] for b in brand_reg['brands'].values() if len(b.get('spellings', {})) > 1},
        'model_multi_spelling_count': sum(1 for m in model_reg['models'].values() if len(m.get('spellings', {})) > 1),
        'model_multi_spelling_examples': [m['spellings'] for m in model_reg['models'].values() if len(m.get('spellings', {})) > 1][:30],
        'model_raw_equals_model_normalized_on_all_master_rows': before['master rows where model_normalized differs from model_raw'] == 0,
        'body_type_not_available_rows': sum(1 for r in master if r['body_type_normalized'] == 'NOT_AVAILABLE'),
        'candidate_rows_naming_several_models': sum(1 for x in cand_map if x['method'] == 'unresolved'),
    }
    # (4) model-year conflicts
    yc = [(mid, c) for mid, a in models_out.items() for c in a['conflicts'] if c['type'] == 'model_year_disagreement']
    inv['4_model_year_conflicts'] = {'trims_with_year_disagreement': len(yc), 'models_affected': len({m for m, _ in yc}),
                                     'examples': [{'model_id': m, **c} for m, c in yc[:15]],
                                     'candidate_rows_with_multi_year_label': sum(1 for c in cands if re.search(r'/|older|\(', c['model_year'])),
                                     'rule': 'model year is an attribute; disagreement is reported, not used to split the model'}
    # (5) duplicates / aliases
    inv['5_duplicates_and_aliases'] = {
        'duplicate_candidate_keys': [{'key': k, 'count': n} for k, n in dups.items() if n > 1],
        'spelling_groups_merged_by_normalization': inv['3_normalization']['model_multi_spelling_count'],
        'extension_pairs_queued': sum(1 for x in review if x['kind'].startswith('same_model_or_separate')),
        'extension_pairs_by_class': dict(Counter(x['kind'].split(':')[1] for x in review if x['kind'].startswith('same_model_or_separate'))),
        'candidate_rows_unmapped': sum(1 for x in cand_map if x['method'] == 'unresolved')}
    # (6) variants that change a model-level fact
    inv['6_variants_changing_model_facts'] = {'count': len(variant_material), 'by_fact': dict(Counter(v['fact'] for v in variant_material)), 'cases': variant_material,
                                              'rule': 'shown as varies_by_variant at model level; a cohort exception is created only by a recorded human decision'}
    for mid, a in models_out.items():
        for c in a['conflicts']:
            if c['type'] == 'trim_price_conflict':
                queue('trim_price_conflict', f'{mid} / {c["trim_key"]}', f'{len(c["values"])} different official prices for the same trim and model year',
                      'check which source is current; never averaged', False)
    for v in variant_material:
        if v['fact'] == 'body_type':
            queue('body_type_check', v['model_id'], f'trims carry different body types: {v["values"]}',
                  'legitimate body styles (keep as variant observations) OR misclassification (correct at source mapping)', False)
        if v['fact'] == 'powertrains':
            queue('cohort_exception_candidate', v['model_id'], f'trims differ in powertrain: {v["values"]}',
                  'keep as variant observations (default) OR approve a cohort exception if the architecture differs', False)
    # cohort hints in candidate notes
    for cm, c in zip(cand_map, cands):
        if re.search(r'second cohort|separate .* cohort|older cohort|different generation', c['notes'] + ' ' + c['variant_normalized'] + ' ' + c['model_year'], re.I):
            queue('cohort_exception_candidate', f'{cm["model_ids"] or c["model"]} (candidate line {cm["candidate_line"]})',
                  'candidate notes describe a separate cohort/generation', 'decide: same model (attribute) or cohort exception', False)

    # ---- AFTER metrics
    mapped_master = sum(1 for x in master_map if x['model_id'])
    after = {
        'canonical_brands': len(brand_reg['brands']),
        'canonical_models': len(model_reg['models']),
        'models_with_master_rows': sum(1 for mid in model_reg['models'] if rows_by_model.get(mid)),
        'candidate_only_models': sum(1 for mid in model_reg['models'] if not rows_by_model.get(mid)),
        'master_rows_mapped_to_model_id': f'{mapped_master}/{len(master)}',
        'candidates_mapped_to_one_model_id': sum(1 for x in cand_map if x['model_ids'] and ';' not in x['model_ids'] and x['method'] != 'unresolved'),
        'candidates_unresolved (queued)': sum(1 for x in cand_map if x['method'] == 'unresolved'),
        'models_with_verified_price_range': sum(1 for a in models_out.values() if a['price_range_egp']['verified']),
        'models_with_any_official_price': sum(1 for a in models_out.values() if a['price_range_egp']['observed_all']),
        'models_with_trim_price_conflict': sum(1 for a in models_out.values() if any(c['type'] == 'trim_price_conflict' for c in a['conflicts'])),
        'trims_with_price_conflict': sum(1 for a in models_out.values() for c in a['conflicts'] if c['type'] == 'trim_price_conflict'),
        'trims_with_price_differing_by_model_year': sum(1 for a in models_out.values() for c in a['conflicts'] if c['type'] == 'trim_price_differs_by_model_year'),
        'models_with_body_type_conflict_within_trim': sum(1 for a in models_out.values() if a['body_type'].get('conflict_within_trim')),
        'models_with_body_type_varying_by_trim': sum(1 for a in models_out.values() if a['body_type']['state'] == 'varies_by_variant'),
        'models_price_range_status': dict(Counter(a['price_range_egp']['range_status'] for a in models_out.values())),
        'review_items_open': len(review),
        'review_items_blocking': sum(1 for x in review if x['blocks_mapping'] == 'yes'),
        'ids_encoding_a_model_year_or_price_not_in_the_model_name': sum(
            1 for mid, m in model_reg['models'].items()
            if any(tok not in fold(m['display']) for tok in re.findall(r'20\d\d|\d{5,}', mid))),
    }

    # ---- WRITE
    dump_json(os.path.join(ID_DIR, 'brand_registry.json'), brand_reg)
    dump_json(os.path.join(ID_DIR, 'model_registry.json'), model_reg)
    if not os.path.exists(os.path.join(ID_DIR, 'decisions.json')):
        dump_json(os.path.join(ID_DIR, 'decisions.json'), decisions)
    alias_rows = []
    for b in brand_reg['brands'].values():
        for sp, n in b.get('spellings', {}).items():
            alias_rows.append({'entity': 'brand', 'canonical_id': b['brand_id'], 'canonical_display': b['display'], 'alias_raw': sp, 'match_key': fold(sp), 'occurrences': n, 'origin': 'master+candidates', 'method': 'exact_normalized'})
    for m in model_reg['models'].values():
        for sp, n in m.get('spellings', {}).items():
            alias_rows.append({'entity': 'model', 'canonical_id': m['model_id'], 'canonical_display': m['display'], 'alias_raw': sp, 'match_key': fold(sp), 'occurrences': n, 'origin': m['origin'], 'method': 'exact_normalized'})
    for x in cand_map:
        if x['method'].startswith('slash_alias'):
            alias_rows.append({'entity': 'model', 'canonical_id': x['model_ids'], 'canonical_display': model_reg['models'][x['model_ids']]['display'], 'alias_raw': x['model_raw'], 'match_key': fold(x['model_raw']), 'occurrences': 1, 'origin': 'vehicle_candidates.csv', 'method': x['method']})
    write_csv(os.path.join(MAP_DIR, 'alias_table.csv'), sorted(alias_rows, key=lambda r: (r['entity'], r['canonical_id'], r['alias_raw'])),
              ['entity', 'canonical_id', 'canonical_display', 'alias_raw', 'match_key', 'occurrences', 'origin', 'method'])
    write_csv(os.path.join(MAP_DIR, 'master_row_map.csv'), master_map,
              ['row_fingerprint', 'master_line', 'source', 'brand_raw', 'model_raw', 'trim_raw', 'model_year_raw', 'brand_id', 'model_id', 'method', 'trim_key', 'is_summary_row'])
    write_csv(os.path.join(MAP_DIR, 'candidate_map.csv'), cand_map,
              ['candidate_fingerprint', 'candidate_line', 'brand_raw', 'model_raw', 'model_year_raw', 'trim_raw', 'status_raw', 'brand_id', 'model_ids', 'method', 'review_id'])
    write_csv(os.path.join(MAP_DIR, 'review_queue.csv'), sorted({r['review_id']: r for r in review}.values(), key=lambda r: (r['blocks_mapping'] != 'yes', r['kind'], r['key'])),
              ['review_id', 'kind', 'key', 'detail', 'suggestion', 'blocks_mapping', 'status'])
    dump_json(os.path.join(REP_DIR, 'integrity_metrics.json'), {'as_of': AS_OF, 'before': before, 'after': after})
    public_inv = json.loads(json.dumps(inv))
    for c in public_inv['1_candidate_master_price_discrepancies']['cases']:
        for k in ('candidate_prices', 'missing_in_master', 'nearest_master'):
            c.pop(k, None)  # prices stay in out/ (public repo)
    dump_json(os.path.join(REP_DIR, 'investigations.json'), public_inv)
    dump_json(os.path.join(OUT_DIR, 'investigations_full.json'), inv)
    dump_json(os.path.join(OUT_DIR, 'models.json'), models_out)
    for mid in SAMPLE_MODELS:
        dump_json(os.path.join(SAMPLE_DIR, mid.replace('/', '__') + '.json'), models_out[mid])
    print(json.dumps({'before': before, 'after': after}, indent=2))


if __name__ == '__main__':
    main()
