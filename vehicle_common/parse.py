"""Shared raw-value parsers and source registry for CarIndex vehicle data tools.

Used by vehicle_intelligence/tools/build_examples.py and vehicle_identity/tools/build_identity.py
so both apply identical parsing. Parsers return (value, unknown_reason); they never guess.
"""
import re

# ------------------------------------------------------------------ source registry
def source_info(name):
    base = name.split('(')[0]
    sub = name[len(base):]
    if name.startswith('Official-'):
        return {'name': name, 'publisher': name, 'type': 'official_distributor', 'tier': 'A'}
    if sub in ('(summary)', '(Lineup)', '(pricetable)'):
        return {'name': name, 'publisher': base, 'type': 'aggregator_summary', 'tier': 'D'}
    if sub == '(classified)':
        return {'name': name, 'publisher': base, 'type': 'aggregator_classified', 'tier': 'D'}
    return {'name': name, 'publisher': base, 'type': 'aggregator_listing', 'tier': 'C'}

def sid(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

# ------------------------------------------------------------------ parsers (raw -> typed)
PLACEHOLDER = re.compile(r'(not available|unavailable|coming soon|n/?a|^-$|not published)', re.I)

def p_int_price(s):
    s = s.strip()
    if not s or PLACEHOLDER.search(s):
        return None, 'placeholder_only' if s else 'no_observation'
    if re.fullmatch(r'\d{1,3}(,\d{3})+|\d{5,}', s):
        return int(s.replace(',', '')), None
    return None, 'unparseable'

def p_range_price(s):
    m = re.fullmatch(r'\s*(\d[\d,]+)\s*-\s*(\d[\d,]+)\s*', s or '')
    return ([int(m.group(1).replace(',', '')), int(m.group(2).replace(',', ''))], None) if m else (None, 'unparseable')

def p_number(s, unit_rx=''):
    s = (s or '').strip()
    if not s:
        return None, 'no_observation'
    if re.search(r'range|-\d|/', s) and not unit_rx:
        return None, 'unparseable'
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*' + unit_rx, s, re.I)
    return (float(m.group(1)), None) if m else (None, 'unparseable')

def p_cm_to_mm(s):
    v, r = p_number(s, r'cm')
    return (int(round(v * 10)), None) if v is not None else (None, r)

def p_torque(s):
    m = re.fullmatch(r'(\d+(?:\.\d+)?)(?:/(\d+)(?:-(\d+))?)?', (s or '').strip())
    if not m:
        return (None, 'no_observation' if not s else 'unparseable'), {}
    q = {}
    if m.group(2):
        q['rpm_from'] = int(m.group(2))
        q['rpm_to'] = int(m.group(3) or m.group(2))
    return (float(m.group(1)), None), q

def p_warranty(s):
    s = (s or '').strip()
    if not s:
        return (None, 'no_observation'), (None, 'no_observation')
    main = re.split(r'\(', s)[0]
    y = re.search(r'(\d+)\s*(?:years?|yrs?|yr)', main, re.I) or re.search(r'(?:years?|yr)\s*(\d+)', main, re.I)
    k = re.search(r'(\d{1,3}(?:,\d{3})+|\d{5,})\s*(?:km)?', main, re.I)
    years = (float(y.group(1)), None) if y else (None, 'unparseable')
    km = (int(k.group(1).replace(',', '')), None) if k else (None, 'unparseable')
    return years, km

FUEL_MAP = [(r'plug-?in|phev|dm-?i', 'phev'), (r'range.?ext|erev|reev', 'erev'), (r'mild', 'mhev'),
            (r'hybrid', 'hev'), (r'electric|^ev$|bev', 'bev'), (r'diesel', 'diesel'), (r'gas|petrol|benzine', 'petrol')]
def p_fuel(s):
    s = (s or '').strip().lower()
    if not s:
        return None, 'no_observation'
    if ',' in s:
        return None, 'unparseable'  # e.g. "Petrol, Hybrid" describes a whole lineup
    for rx, v in FUEL_MAP:
        if re.search(rx, s):
            return v, None
    return None, 'unparseable'

TRANS_MAP = [(r'dual|dct|dsg', 'dct'), (r'cvt', 'cvt'), (r'manual|m/t', 'manual'), (r'dht', 'dht'), (r'automatic|a/t|auto', 'automatic')]
def p_trans(s):
    s = (s or '').strip().lower()
    if not s:
        return None, 'no_observation'
    for rx, v in TRANS_MAP:
        if re.search(rx, s):
            return v, None
    return None, 'unparseable'

BODY_MAP = {'suv': 'suv', 'sedan': 'sedan', 'hatchback': 'hatchback', 'coupe': 'coupe', 'convertible': 'convertible',
            'pickup': 'pickup', 'mpv': 'mpv', 'minivans': 'mpv', 'van': 'van', 'gran coupe': 'coupe', 'cabriolet-coupe': 'convertible',
            'hatchback/wagon': 'hatchback', 'sedan/fastback': 'sedan'}
def p_body(s):
    s = (s or '').strip()
    if not s or s == 'NOT_AVAILABLE':
        return None, 'placeholder_only' if s else 'no_observation'
    key = re.sub(r'\s*\(.*\)', '', s).strip().lower()
    return (BODY_MAP[key], None) if key in BODY_MAP else (None, 'unparseable')

# column -> (fact, parser)
COLUMN_FACTS = [
    ('model_year', 'model_year', lambda s: (int(s), None) if re.fullmatch(r'20\d\d', s or '') else (None, 'unparseable')),
    ('body_type_normalized', 'body_type', p_body),
    ('official_price', 'official_price_egp', p_int_price),
    ('market_price', 'market_price_egp', p_int_price),
    ('fuel_type_raw', 'fuel_type', p_fuel),
    ('engine_capacity', 'engine_displacement_cc', lambda s: (lambda v: (int(v[0]), None) if v[0] else v)(p_number(s, r'cc'))),
    ('horsepower', 'power_hp', lambda s: p_number(s)),
    ('transmission', 'transmission', p_trans),
    ('drive_type', 'drivetrain', lambda s: ((s.strip().lower(), None) if (s or '').strip().lower() in ('fwd', 'rwd', 'awd', '4wd') else ((None, 'unparseable') if s else (None, 'no_observation')))),
    ('battery_capacity', 'battery_kwh', lambda s: p_number(s, r'kwh')),
    ('electric_range', 'electric_range_km', lambda s: p_number(s, r'km')),
    ('seats', 'seats', lambda s: (lambda v: (int(v[0]), None) if v[0] else v)(p_number(s))),
    ('length', 'length_mm', p_cm_to_mm), ('width', 'width_mm', p_cm_to_mm), ('height', 'height_mm', p_cm_to_mm), ('wheelbase', 'wheelbase_mm', p_cm_to_mm),
    ('trunk_capacity', 'trunk_l', lambda s: (lambda v: (int(v[0]), None) if v[0] else v)(p_number(s, r'l'))),
    ('fuel_consumption', 'fuel_consumption_l_100km', lambda s: p_number(s, r'l/100km')),
]
