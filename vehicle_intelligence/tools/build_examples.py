#!/usr/bin/env python3
"""Build Vehicle Intelligence v1 example records from the existing CarIndex data.

Inputs : _src/carindex_master.csv, _src/vehicle_candidates.csv (Drive snapshot 2026-09-17,
         collection_date 2026-09-10), contract/field_registry.json
Output : examples/<variant>.json, reports/computability.json

Everything below the RAW layer is produced by the deterministic rules in this file.
No value is typed by hand. The only hand-written inputs are:
  - which vehicles to build (EXAMPLES) and which raw trim spellings are the same trim
  - two external press observations for the Tiggo 7 Pro (found by web search on 2026-09-24),
    flagged verification='search_snippet'
Editorial layer is left empty on purpose: it needs a CarIndex editor.
"""
import csv
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, '_src')
AS_OF = '2026-09-24'
SNAPSHOT = {'dataset': 'carindex_master.csv + vehicle_candidates.csv (Drive, 2026-09-17)', 'collection_date': '2026-09-10'}
REG = json.load(open(os.path.join(ROOT, 'contract', 'field_registry.json'), encoding='utf-8'))
MASTER = list(csv.DictReader(open(os.path.join(SRC, 'carindex_master.csv'), encoding='utf-8')))
CANDS = list(csv.DictReader(open(os.path.join(SRC, 'vehicle_candidates.csv'), encoding='utf-8')))
TIER_RANK = {'A': 4, 'B': 3, 'C': 2, 'D': 1}
CONF_ORDER = ['unknown', 'low', 'medium', 'high']

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
from vehicle_common.parse import *  # noqa: F401,F403  (source_info, sid, p_* parsers, COLUMN_FACTS)
TIME_SENSITIVE = {k for k, v in REG['facts'].items() if v.get('time_sensitive')}

# ------------------------------------------------------------------ the 5 test vehicles
EXAMPLES = [
    {'model_id': 'toyota-corolla', 'brand': 'Toyota', 'model': 'Corolla', 'cohort': '2026', 'trim': 'Active',
     'aliases': {'Active'}, 'year_filter': {'2026'}, 'why': 'best-covered car: 4 sources agree on price, full EgyCar spec sheet'},
    {'model_id': 'mg-zs', 'brand': 'MG', 'model': 'ZS', 'cohort': '2026-27', 'trim': 'Comfort',
     'aliases': {'Comfort'}, 'year_filter': {'2026', '2027'}, 'why': 'model-year conflict between sources (2026 vs 2027) with identical price'},
    {'model_id': 'chery-tiggo-7-pro', 'brand': 'Chery', 'model': 'Tiggo 7 Pro', 'cohort': '2027-ckd', 'trim': 'Comfort',
     'aliases': {'CKD Comfort'}, 'year_filter': {'2027'}, 'why': 'price changed after the snapshot; candidate layer disagrees with master; almost no specs',
     'cohort_rows': [('Hatla2ee(summary)', '(range, 2 classes)')],
     'external': [
        {'source': {'name': 'Masrawy', 'publisher': 'Masrawy', 'type': 'press_reporting_official', 'tier': 'B', 'url': 'https://www.masrawy.com/autos/autos_news/details/2026/9/20/3051042/'},
         'attribute': 'official_price_egp', 'raw_value': '1,080,000', 'observed_at': '2026-09-20', 'record_ref': 'web search 2026-09-24 (article page blocked by egress)', 'verification': 'search_snippet'},
        {'source': {'name': 'Auto Express EG', 'publisher': 'Auto Express EG', 'type': 'press_reporting_official', 'tier': 'B', 'url': 'https://www.autoexpress-eg.com/2026/09/23/'},
         'attribute': 'official_price_egp', 'raw_value': '1,080,000', 'observed_at': '2026-09-23', 'record_ref': 'web search 2026-09-24 (article page blocked by egress)', 'verification': 'search_snippet'}]},
    {'model_id': 'mg-4', 'brand': 'MG', 'model': '4', 'cohort': '2026', 'trim': 'Luxury',
     'aliases': {'Luxury'}, 'year_filter': {'2026'}, 'why': 'battery-electric: battery and range present, consumption absent'},
    {'model_id': 'baic-u5-plus', 'brand': 'Baic', 'model': 'U5 Plus', 'cohort': '2026', 'trim': 'Manual',
     'aliases': {'Manual'}, 'year_filter': {'2026'}, 'why': 'sparse record: price and one free-text note only',
     'cohort_rows': [('Hatla2ee(summary)', '(range, 3 classes)')]},
]

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def rows_for(ex):
    out, cohort = [], []
    for i, r in enumerate(MASTER):
        if r['brand_normalized'].lower() != ex['brand'].lower() or r['model_normalized'].lower() != ex['model'].lower():
            continue
        if r['model_year'] not in ex['year_filter']:
            continue
        if r['variant_raw'] in ex['aliases']:
            out.append((i + 2, r))  # +2: header line + 1-based
        for src, frag in ex.get('cohort_rows', []):
            if r['source'] == src and frag in r['variant_raw'] and 'second cohort' not in r['variant_raw']:
                cohort.append((i + 2, r))
    return out, cohort

def candidate_for(ex):
    for c in CANDS:
        if c['brand'].lower() == ex['brand'].lower() and c['model'].lower() == ex['model'].lower():
            if ex['trim'].lower() in c['variant_normalized'].lower() or '/' in c['variant_normalized'] or 'trims' in c['variant_normalized']:
                return c
    return None

# ------------------------------------------------------------------ confidence + resolution
def cap(conf, ceiling):
    return CONF_ORDER[min(CONF_ORDER.index(conf), CONF_ORDER.index(ceiling))]

def down(conf):
    i = CONF_ORDER.index(conf)
    return CONF_ORDER[max(1, i - 1)] if i > 0 else conf

def fact_from(attr, obs_list, sources, parsed):
    """obs_list: observations for one attribute. parsed: obs_id -> (value, reason, qualifiers, from_free_text)."""
    reg = REG['facts'].get(attr, {})
    base = {'unit': reg.get('unit'), 'level': reg.get('level'), 'observation_ids': [o['obs_id'] for o in obs_list]}
    good = [o for o in obs_list if parsed[o['obs_id']][0] is not None]
    if not good:
        reasons = {parsed[o['obs_id']][1] for o in obs_list}
        reason = 'no_observation' if not obs_list else ('placeholder_only' if reasons == {'placeholder_only'} else 'unparseable')
        return {**base, 'value': None, 'status': 'unknown', 'confidence': 'unknown', 'valid_as_of': None, 'unknown_reason': reason}
    groups = defaultdict(list)
    for o in good:
        groups[json.dumps(parsed[o['obs_id']][0])].append(o)
    merge_notes = []
    # R1 specificity: 'automatic' is compatible with exactly one specific automatic type
    if attr == 'transmission' and '"automatic"' in groups:
        specific = [k for k in groups if k in ('"cvt"', '"dct"', '"dht"', '"single_speed"')]
        if len(specific) == 1:
            groups[specific[0]].extend(groups.pop('"automatic"'))
            merge_notes.append(f'R1 specificity: "automatic" observations counted as support for {json.loads(specific[0])}')
    # R0 tolerance: prices within max(1,000 EGP, 0.1%) are the same value (rounding), representative = strongest/newest
    if reg.get('unit') == 'EGP' and len(groups) > 1:
        def close(a, b):
            a, b = (a if isinstance(a, list) else [a]), (b if isinstance(b, list) else [b])
            return len(a) == len(b) and all(abs(x - y) <= max(1000, 0.001 * max(x, y)) for x, y in zip(a, b))
        keys = list(groups)
        for i, ka in enumerate(keys):
            for kb in keys[i + 1:]:
                if ka in groups and kb in groups and close(json.loads(ka), json.loads(kb)):
                    rank = lambda k: max((TIER_RANK[sources[o['source_id']]['tier']], o['observed_at']) for o in groups[k])
                    keep, drop = (ka, kb) if rank(ka) >= rank(kb) else (kb, ka)
                    merge_notes.append(f'R0 tolerance: {json.loads(drop)} treated as rounding of {json.loads(keep)}')
                    groups[keep].extend(groups.pop(drop))
    cand = [{'value': json.loads(v), 'observation_ids': [o['obs_id'] for o in os_]} for v, os_ in groups.items()]
    qualifiers = next((parsed[o['obs_id']][2] for o in good if parsed[o['obs_id']][2]), None)

    def support(os_):
        pubs = {sources[o['source_id']]['publisher'] for o in os_}
        best = max(TIER_RANK[sources[o['source_id']]['tier']] for o in os_)
        return pubs, best

    def conf_for(os_):
        pubs, best = support(os_)
        if best == 4 or len(pubs) >= 2 and best >= 2:
            c = 'high'
        elif best >= 2:
            c = 'medium'
        else:
            c = 'low'
        if any(o.get('verification') == 'search_snippet' for o in os_):
            c = cap(c, 'medium')
        if any(parsed[o['obs_id']][3] for o in os_):
            c = cap(c, 'low')
        if attr in TIME_SENSITIVE:
            newest = max(o['observed_at'] for o in os_)
            age = (_d(AS_OF) - _d(newest))
            if age > reg.get('freshness_days', 10**6):
                c = down(c)
        return c

    newest_date = lambda os_: max(o['observed_at'] for o in os_)
    if len(groups) == 1:
        os_ = good
        pubs, _ = support(os_)
        status = 'agreed' if len(pubs) >= 2 else 'single_source'
        out = {**base, 'value': json.loads(next(iter(groups))), 'qualifiers': qualifiers or {}, 'status': status, 'confidence': conf_for(os_),
               'valid_as_of': newest_date(os_)}
        if merge_notes:
            out.update({'candidates': cand, 'resolution': {'rule': '; '.join(merge_notes), 'decided_by': 'rule'}})
        return out
    # --- conflict handling
    ranked = sorted(groups.values(), key=lambda os_: (newest_date(os_), max(TIER_RANK[sources[o['source_id']]['tier']] for o in os_)), reverse=True)
    top, rest = ranked[0], ranked[1:]
    top_tier = max(TIER_RANK[sources[o['source_id']]['tier']] for o in top)
    rest_tier = max(TIER_RANK[sources[o['source_id']]['tier']] for os_ in rest for o in os_)
    if attr in TIME_SENSITIVE and newest_date(top) > max(newest_date(os_) for os_ in rest) and top_tier >= min(rest_tier, 3):
        rule = 'R2 time_supersession: newer observation from an equal-or-stronger tier (>= B) replaces older values; older kept as history'
    elif top_tier == 4 and rest_tier < 4:
        rule = 'R3 tier_precedence: official/OEM value beats aggregator values'
        top = max(groups.values(), key=lambda os_: max(TIER_RANK[sources[o['source_id']]['tier']] for o in os_))
    else:
        return {**base, 'value': None, 'status': 'conflict', 'confidence': 'unknown', 'valid_as_of': None,
                'candidates': cand, 'unknown_reason': 'unresolved_conflict',
                'resolution': {'rule': 'R4 no automatic winner: sources of equal standing disagree; needs CarIndex check', 'decided_by': 'rule'}}
    v = parsed[top[0]['obs_id']][0]
    return {**base, 'value': v, 'qualifiers': qualifiers or {}, 'status': 'resolved', 'confidence': down(conf_for(top)),
            'valid_as_of': newest_date(top), 'candidates': cand, 'resolution': {'rule': rule, 'decided_by': 'rule'}}

def _d(s):
    y, m, d = map(int, s.split('-'))
    import datetime
    return (datetime.date(y, m, d) - datetime.date(2000, 1, 1)).days

# ------------------------------------------------------------------ peer sets (whole snapshot)
def build_peer_sets():
    seen = {}
    for r in MASTER:
        price, _ = p_int_price(r['official_price'])
        body, _ = p_body(r['body_type_normalized'])
        if price is None:
            continue
        key = (r['brand_normalized'].lower(), r['model_normalized'].lower(), r['model_year'], r['variant_raw'].strip().lower())
        seen.setdefault(key, {'price': price, 'body': body, 'row': r})
    by_body = defaultdict(list)
    for v in seen.values():
        if v['body']:
            by_body[v['body']].append(v['price'])
    warr = []
    wseen = set()
    for r in MASTER:
        (y, _), _k = p_warranty(r['warranty'])
        key = (r['brand_normalized'].lower(), r['model_normalized'].lower(), r['model_year'], r['variant_raw'].strip().lower())
        if y is not None and key not in wseen:
            wseen.add(key)
            warr.append(y)
    return {k: sorted(v) for k, v in by_body.items()}, sorted(warr), len(seen)

PEERS_BODY, PEERS_WARRANTY, N_PRICED_VARIANTS = build_peer_sets()

def percentile(value, peers):
    below = sum(1 for p in peers if p < value)
    equal = sum(1 for p in peers if p == value)
    return round(100.0 * (below + 0.5 * equal) / len(peers), 1)

def band(pct):
    return ['entry', 'lower', 'middle', 'upper', 'top'][min(4, int(pct // 20))]

# ------------------------------------------------------------------ record builder
def build(ex):
    rows, cohort_rows = rows_for(ex)
    model_id = ex['model_id']
    cohort_id = f"{model_id}@{ex['cohort']}"
    variant_id = f"{cohort_id}/{slug(ex['trim'])}"
    sources, observations, parsed = {}, [], {}
    obs_by_attr = defaultdict(list)

    def add_obs(attr, raw, src_name, src_info, url, date, ref, entity, value_reason, qualifiers=None, free_text=False, verification=None):
        s_id = sid(src_name)
        sources.setdefault(s_id, {**src_info, 'url': src_info.get('url') or url})
        oid = f"o{len(observations) + 1:03d}"
        o = {'obs_id': oid, 'entity_ref': entity, 'attribute': attr, 'raw_value': raw, 'source_id': s_id,
             'source_url': url, 'observed_at': date, 'record_ref': ref}
        if verification:
            o['verification'] = verification
        observations.append(o)
        parsed[oid] = (value_reason[0], value_reason[1], qualifiers or {}, free_text)
        obs_by_attr[attr].append(o)

    for line, r in rows:
        info = source_info(r['source'])
        date = r['price_date'] or r['collection_date']
        for col, attr, fn in COLUMN_FACTS:
            raw = r[col]
            if not raw.strip():
                continue
            level = REG['facts'][attr]['level']
            entity = variant_id if level == 'variant' else (cohort_id if level == 'cohort' else model_id)
            add_obs(attr, raw, r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:{col}', entity, fn(raw))
        if r['torque'].strip():
            (v, reason), q = p_torque(r['torque'])
            add_obs('torque_nm', r['torque'], r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:torque', variant_id, (v, reason), q)
        if r['warranty'].strip():
            yv, kv = p_warranty(r['warranty'])
            add_obs('warranty_years', r['warranty'], r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:warranty', variant_id, yv)
            add_obs('warranty_km', r['warranty'], r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:warranty', variant_id, kv)
        m = re.search(r'assembled\s+([A-Z][a-z]+)', r['notes'], re.I)
        if m:
            add_obs('assembly_country', r['notes'], r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:notes', cohort_id, (m.group(1), None), free_text=True)
        if r['notes'].strip():
            # free-text notes stay raw: equipment extraction is not done by this builder
            add_obs('equipment', r['notes'], r['source'], info, r['source_url'], date, f'carindex_master.csv:{line}:notes', variant_id, (None, 'unparseable'))

    for line, r in cohort_rows:
        info = source_info(r['source'])
        add_obs('price_range_egp', r['official_price'], r['source'], info, r['source_url'], r['collection_date'],
                f'carindex_master.csv:{line}:official_price', cohort_id, p_range_price(r['official_price']))

    cand = candidate_for(ex)
    if cand:
        info = {'name': 'CarIndex vehicle_candidates.csv', 'publisher': 'CarIndex internal', 'type': 'carindex_internal', 'tier': 'D'}
        rng = re.search(r'(\d[\d,]{5,})\s*-\s*(\d[\d,]{5,})', cand['prices'])
        if rng:
            add_obs('price_range_egp', cand['prices'], 'CarIndex vehicle_candidates.csv', info, '', SNAPSHOT['collection_date'],
                    'vehicle_candidates.csv:prices', cohort_id, p_range_price(f'{rng.group(1)}-{rng.group(2)}'))

    for e in ex.get('external', []):
        add_obs(e['attribute'], e['raw_value'], e['source']['name'], e['source'], e['source']['url'], e['observed_at'],
                e['record_ref'], variant_id, p_int_price(e['raw_value']), verification=e['verification'])

    # ---- NORMALIZED FACTS (every registry fact is present, unknown if no evidence)
    facts = {}
    for attr in REG['facts']:
        facts[attr] = fact_from(attr, obs_by_attr.get(attr, []), sources, parsed)
    facts['equipment']['note'] = 'free-text notes kept as raw observations; structured extraction not done yet'

    # ---- DERIVED
    derived = {}
    def unk(formula, inputs, reason):
        return {'value': None, 'formula': formula, 'inputs': inputs, 'confidence': 'unknown', 'unknown_reason': reason}
    def dconf(*fs):
        cs = [f['confidence'] for f in fs]
        return CONF_ORDER[min(CONF_ORDER.index(c) for c in cs)]

    price, body = facts['official_price_egp'], facts['body_type']
    if price['value'] is not None and body['value'] is not None:
        peers = PEERS_BODY[body['value']]
        pct = percentile(price['value'], peers)
        derived['price_percentile_in_body_type'] = {
            'value': pct, 'formula': 'D-PRICE-PCTL-BODY@1', 'inputs': {'price': 'facts.official_price_egp', 'body': 'facts.body_type'},
            'peer_set': {'id': f"body:{body['value']}@2026-09-10", 'size': len(peers), 'definition': 'one official price per brand/model/year/trim in carindex_master.csv, same body type'},
            'confidence': dconf(price, body),
            'explanation': {'key': 'derived.price_percentile', 'params': {'pct': pct, 'body': body['value'], 'n': len(peers)}}}
        derived['price_band_in_body_type'] = {
            'value': band(pct), 'formula': 'D-PRICE-BAND@1', 'inputs': {'pct': 'derived.price_percentile_in_body_type'},
            'confidence': dconf(price, body), 'explanation': {'key': 'derived.price_band', 'params': {'band': band(pct), 'body': body['value']}}}
    else:
        miss = [n for n, f in (('official_price_egp', price), ('body_type', body)) if f['value'] is None]
        derived['price_percentile_in_body_type'] = unk('D-PRICE-PCTL-BODY@1', {}, 'missing ' + ', '.join(miss))
        derived['price_band_in_body_type'] = unk('D-PRICE-BAND@1', {}, 'missing ' + ', '.join(miss))

    # trim position: all trims of the same cohort from the same source/date as the resolved price
    trims = sorted({p_int_price(r['official_price'])[0] for r in MASTER
                    if r['brand_normalized'].lower() == ex['brand'].lower() and r['model_normalized'].lower() == ex['model'].lower()
                    and r['model_year'] in ex['year_filter'] and r['source'] == 'ContactCars' and p_int_price(r['official_price'])[0]})
    snap_price = next((parsed[o['obs_id']][0] for o in obs_by_attr['official_price_egp'] if o['source_id'] == 'contactcars' and parsed[o['obs_id']][0]), None)
    if trims and snap_price in trims:
        pos = 'only_trim' if len(trims) == 1 else ('entry' if snap_price == trims[0] else ('top' if snap_price == trims[-1] else 'middle'))
        derived['trim_position_in_model'] = {'value': pos, 'formula': 'D-TRIM-POSITION@1',
            'inputs': {'trim_prices': f'ContactCars official prices, {len(trims)} trims, 2026-09-10'}, 'confidence': 'medium',
            'explanation': {'key': 'derived.trim_position', 'params': {'pos': pos, 'n': len(trims)}}}
    else:
        derived['trim_position_in_model'] = unk('D-TRIM-POSITION@1', {}, 'no single-source trim ladder')

    # market premium: same source + same date only
    prem = None
    for o in obs_by_attr['market_price_egp']:
        mv = parsed[o['obs_id']][0]
        ov = next((parsed[x['obs_id']][0] for x in obs_by_attr['official_price_egp'] if x['source_id'] == o['source_id'] and x['observed_at'] == o['observed_at']), None)
        if mv and ov:
            prem = (round(100.0 * (mv - ov) / ov, 1), o, ov, mv)
            break
    if prem:
        derived['market_premium_pct'] = {'value': prem[0], 'formula': 'D-MARKET-PREMIUM@1',
            'inputs': {'official': f"{prem[1]['source_id']} {prem[2]} @ {prem[1]['observed_at']}", 'market': f"{prem[1]['obs_id']} {prem[3]}"},
            'confidence': 'low' if (_d(AS_OF) - _d(prem[1]['observed_at'])) > 30 else 'medium',
            'explanation': {'key': 'derived.market_premium', 'params': {'pct': prem[0], 'date': prem[1]['observed_at']}}}
    else:
        derived['market_premium_pct'] = unk('D-MARKET-PREMIUM@1', {}, 'no same-source, same-date official + market pair')

    if price['value'] is not None:
        sup = {sources[o['source_id']]['publisher'] for o in obs_by_attr['official_price_egp'] if parsed[o['obs_id']][0] == price['value']}
        derived['price_source_agreement'] = {'value': len(sup), 'formula': 'D-SOURCE-AGREEMENT@1', 'inputs': {'publishers': sorted(sup)}, 'confidence': 'high'}
    else:
        derived['price_source_agreement'] = unk('D-SOURCE-AGREEMENT@1', {}, 'price unknown')

    L, W, S = facts['length_mm'], facts['width_mm'], facts['seats']
    if L['value'] is not None:
        lc = 'under_4200' if L['value'] < 4200 else '4200_4499' if L['value'] < 4500 else '4500_4799' if L['value'] < 4800 else '4800_plus'
        derived['length_class'] = {'value': lc, 'formula': 'D-LENGTH-CLASS@1', 'inputs': {'length': 'facts.length_mm'}, 'confidence': L['confidence']}
    else:
        derived['length_class'] = unk('D-LENGTH-CLASS@1', {}, 'missing length_mm')
    derived['footprint_m2'] = ({'value': round(L['value'] * W['value'] / 1e6, 2), 'formula': 'D-FOOTPRINT@1', 'inputs': {'length': 'facts.length_mm', 'width': 'facts.width_mm'}, 'confidence': dconf(L, W)}
                               if L['value'] and W['value'] else unk('D-FOOTPRINT@1', {}, 'missing length_mm/width_mm'))
    derived['third_row'] = ({'value': S['value'] >= 6, 'formula': 'D-THIRD-ROW@1', 'inputs': {'seats': 'facts.seats'}, 'confidence': S['confidence']}
                            if S['value'] is not None else unk('D-THIRD-ROW@1', {}, 'missing seats'))
    wy = facts['warranty_years']
    if wy['value'] is not None:
        wp = percentile(wy['value'], PEERS_WARRANTY)
        derived['warranty_years_percentile'] = {'value': wp, 'formula': 'D-WARRANTY-PCTL@1', 'inputs': {'years': 'facts.warranty_years'},
            'peer_set': {'id': 'warranty_years@2026-09-10', 'size': len(PEERS_WARRANTY), 'definition': 'variants with a parseable warranty in carindex_master.csv'},
            'confidence': wy['confidence']}
    else:
        derived['warranty_years_percentile'] = unk('D-WARRANTY-PCTL@1', {}, 'missing warranty_years')
    for name in ('power_to_weight_hp_per_t', 'fuel_cost_egp_per_100km', 'energy_cost_egp_per_100km', 'ev_range_percentile_in_bev', 'registrations_trend', 'price_trend'):
        spec = REG['derived'][name]
        derived[name] = unk(spec['formula'], {}, 'missing ' + ', '.join(spec['inputs']))

    # ---- SIGNALS (rules marked 'proposed': a scorer must ignore non-approved rules)
    def have(key):
        if key.startswith('editorial:'):
            return False  # no approved editorial exists yet
        if '|' in key:
            return any(have(k) for k in key.split('|'))
        base = key.split(' ')[0]
        if base.startswith('equipment.'):
            return False
        if base in derived:
            return derived[base]['value'] is not None
        if base in facts:
            return facts[base]['value'] is not None
        return False
    signals = {}
    for dim, spec in REG['signals'].items():
        req, opt = spec['inputs_required'], spec.get('inputs_optional', [])
        used = [k for k in req + opt if have(k)]
        missing = [k for k in req + opt if not have(k)]
        if spec['editorial_required']:
            missing.append(f'editorial:{dim} (approved)')
        cov = round(len(used) / (len(req) + len(opt) + (1 if spec['editorial_required'] else 0)), 2)
        sig = {'state': 'unknown', 'value': None, 'rule': {'id': f'S-{dim.upper()}@1', 'status': 'proposed'},
               'inputs_used': used, 'inputs_missing': missing, 'evidence_coverage': cov, 'confidence': 'unknown'}
        req_ok = all(have(k) for k in req) and not spec['editorial_required']
        if dim == 'price_position' and req_ok:
            sig.update({'state': 'known', 'value': derived['price_band_in_body_type']['value'], 'scale': 'entry|lower|middle|upper|top (price quintile within body type; says nothing about value for money)',
                        'confidence': derived['price_band_in_body_type']['confidence'],
                        'explanation': {'key': 'signal.price_position', 'params': {'band': derived['price_band_in_body_type']['value'], 'body': facts['body_type']['value'], 'pct': derived['price_percentile_in_body_type']['value']}}})
        elif dim == 'service_warranty' and req_ok:
            wv = derived['warranty_years_percentile']['value']
            sig.update({'state': 'partial', 'value': band(wv), 'scale': 'entry|lower|middle|upper|top (warranty length quintile; service network unknown)',
                        'confidence': cap(derived['warranty_years_percentile']['confidence'], 'medium'),
                        'explanation': {'key': 'signal.warranty', 'params': {'years': facts['warranty_years']['value'], 'km': facts['warranty_km']['value']}}})
        elif used:
            sig['state'] = 'partial'
            sig['explanation'] = {'key': 'signal.partial_no_value', 'params': {'missing': len(missing)}}
        else:
            sig['explanation'] = {'key': 'signal.unknown', 'params': {}}
        signals[dim] = sig

    entity = {'model_id': model_id, 'cohort_id': cohort_id, 'variant_id': variant_id, 'brand': ex['brand'], 'model': ex['model'], 'trim': ex['trim'],
              'trim_aliases': sorted({(o['source_id'], r['variant_raw']) for _, r in rows for o in observations if False}) or
                              [{'source_id': sid(r['source']), 'raw': r['variant_raw']} for _, r in rows],
              'selection_reason': ex['why']}
    if cand:
        entity['candidate_layer'] = cand
    return {'contract_version': '1.0.0-draft', 'generated_at': f'{AS_OF}T00:00:00Z', 'snapshot': SNAPSHOT, 'entity': entity,
            'sources': sources, 'observations': observations, 'facts': facts, 'derived': derived, 'editorial': [],
            'signals': signals, 'buyer_fit': []}

# ------------------------------------------------------------------ computability over the whole snapshot
def computability():
    variants = {}
    for r in MASTER:
        key = (r['brand_normalized'].lower(), r['model_normalized'].lower(), r['model_year'], r['variant_raw'].strip().lower())
        v = variants.setdefault(key, defaultdict(bool))
        for col, attr, fn in COLUMN_FACTS:
            if r[col].strip() and fn(r[col])[0] is not None:
                v[attr] = True
        if p_warranty(r['warranty'])[0][0] is not None:
            v['warranty_years'] = True
        if p_torque(r['torque'])[0][0] is not None:
            v['torque_nm'] = True
        if r['market_price'].strip() and p_int_price(r['market_price'])[0] and p_int_price(r['official_price'])[0]:
            v['_market_pair'] = True
    n = len(variants)
    share = lambda f: round(sum(1 for v in variants.values() if f(v)) / n, 3)
    return {
        'distinct_variants_in_master (brand/model/year/trim)': n,
        'price_position (official price + body type)': share(lambda v: v['official_price_egp'] and v['body_type']),
        'market_premium (official + market price, same row)': share(lambda v: v['_market_pair']),
        'service_warranty (warranty years parsed)': share(lambda v: v['warranty_years']),
        'powertrain facts (fuel type + transmission)': share(lambda v: v['fuel_type'] and v['transmission']),
        'family_practicality inputs (seats + trunk)': share(lambda v: v['seats'] and v['trunk_l']),
        'city size input (length)': share(lambda v: v['length_mm']),
        'performance input (power)': share(lambda v: v['power_hp']),
        'energy_efficiency input (fuel consumption)': share(lambda v: v['fuel_consumption_l_100km']),
        'EV range': share(lambda v: v['electric_range_km']),
        'reliability / resale / safety / running cost / comfort inputs': 0.0,
    }

if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'examples'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'reports'), exist_ok=True)
    for ex in EXAMPLES:
        rec = build(ex)
        fn = rec['entity']['variant_id'].replace('@', '__').replace('/', '__') + '.json'
        json.dump(rec, open(os.path.join(ROOT, 'examples', fn), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        known = [d for d, s in rec['signals'].items() if s['state'] == 'known']
        partial = [d for d, s in rec['signals'].items() if s['state'] == 'partial']
        kf = [a for a, f in rec['facts'].items() if f['value'] is not None]
        conf = [a for a, f in rec['facts'].items() if f['status'] in ('conflict', 'resolved')]
        print(f"{fn}: {len(rec['observations'])} obs, {len(kf)}/{len(rec['facts'])} facts known, conflicts/resolved={conf}, signals known={known}, partial={partial}")
    comp = computability()
    json.dump(comp, open(os.path.join(ROOT, 'reports', 'computability.json'), 'w'), indent=2)
    print(json.dumps(comp, indent=2))
