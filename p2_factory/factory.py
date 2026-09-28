"""P2 Data Readiness Factory v0.1: non-production staging, deterministic recipes, readiness.

Nothing here writes canonical automotive data, the P1 universe, n8n, or any Drive dataset.
All inputs are LOCAL COPIES (the Drive FUSE mount is unreliable, LIVING_DATA_ARCHITECTURE §1.3.12).

  python factory.py run --work <local dir> --out <run export dir> \
      --master carindex_master.csv --universe view.js --reg reg_raw.csv [--refetch]

Stages (each idempotent; observation ids are deterministic hashes):
  1. init        schema.sql + sources.csv
  2. legacy      carindex_master.csv rows  -> observations (extraction_kind=legacy_unknown)
  3. baseline    readiness BEFORE the batch
  4. nissan      Tier-1 recipe: en.nissan.com.eg VLP price JSON + spec pages + official brochures
  5. reconcile   identity, trim matching, conflicts, promotion candidates, exceptions
  6. after       readiness AFTER the batch (staging vs consumer/canonical, reported separately)
  7. export      CSV/JSON evidence pack
"""
import argparse, csv, datetime as dt, hashlib, html, json, os, re, sqlite3, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BATCH = 'B001_nissan_eg_2026-09-28'
AS_OF = dt.date(2026, 9, 28)
UA = 'CarIndex-P2-factory/0.1 (research; contact via carindex)'
NOW = lambda: dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = lambda b: hashlib.sha256(b).hexdigest()
hid = lambda *p: hashlib.sha256('|'.join(str(x) for x in p).encode()).hexdigest()[:20]

# ---------------------------------------------------------------- identity helpers
def slug(s):
    s = s.lower().replace('+', ' plus').replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

MODEL_SYNONYMS = {('nissan', 'allnewpatrol'): 'patrol', ('nissan', 'new-patrol'): 'patrol', ('nissan', 'new-qashqai'): 'qashqai',
                  ('nissan', 'new-juke'): 'juke', ('nissan', 'x-trail-epower'): 'x-trail',
                  ('nissan', '2026-magnite'): 'magnite'}

def resolve_model(universe_ids, brand, model):
    """Deterministic lookup against P1 universe slugs. Returns (model_id, confidence)."""
    b, m = slug(brand), slug(model)
    m = MODEL_SYNONYMS.get((b, m), m)
    for cand, conf in ((f'{b}/{m}', 'HIGH'), (f'{b}/{m.replace("-", "")}', 'MEDIUM')):
        if cand in universe_ids:
            return cand, conf
    folded = {k.replace('-', ''): k for k in universe_ids}
    k = f'{b}/{m}'.replace('-', '')
    if k in folded:
        return folded[k], 'MEDIUM'
    return None, 'NONE'

TRIM_STOP = {'cvt', 'at', 'mt', 'a', 't', 'automatic', 'manual', '2wd', '4x2',
             'v6', 'v6tt', 'e-power', 'epower', '204', '213', 'fwd', 'sunny', 'magnite', 'qashqai', 'juke',
             'sentra', 'patrol', 'x-trail', 'xtrail', 'nissan', 'saloon', 'salon'}
TRIM_SYN = {'base': 'base', 'baseline': 'base', 'mid': 'mid', 'midline': 'mid', 'super': 'super',
            'connecta': 'connecta', 'n': '', 'plus': 'plus', 't1': '1', 't2': '2', 'le1': 'le 1', 'le2': 'le 2'}

def trim_key(label):
    """Deterministic trim normalisation. Transmission is kept only as a separate token set."""
    if not label:
        return None
    s = label.lower().replace('+', ' plus ').replace('/', ' ').replace('e-4orce', ' 4wd ')
    s = re.sub(r'\b\d\.\d\s*[lt]\b', ' ', s)  # engine size tokens (1.0T, 3.8L) are not grade identity
    toks = re.findall(r'[a-z0-9]+', s)
    out = []
    for t in toks:
        t = TRIM_SYN.get(t, t)
        for u in t.split():
            if u and u not in TRIM_STOP:
                out.append(u)
    return ' '.join(out) or None

def trans_of(label):
    s = (label or '').lower()
    if re.search(r'\bmt\b|manual', s): return 'MT'
    if re.search(r'\bat\b|a/t|automatic|cvt', s): return 'AT'
    return None

def num(s):
    if s is None: return None
    t = re.sub(r'[^0-9.]', '', str(s).replace(',', ''))
    try: return float(t) if t else None
    except ValueError: return None

# ---------------------------------------------------------------- db
def db_open(path):
    c = sqlite3.connect(path)
    c.executescript(open(os.path.join(HERE, 'schema.sql')).read())
    for r in csv.DictReader(open(os.path.join(HERE, 'sources.csv'), encoding='utf-8')):
        c.execute('insert or replace into sources values (?,?,?,?,?,?,?,?)',
                  (r['source_id'], r['name'], r['family'], r['domain'], int(r['tier']), r['market_scope'],
                   r['access_notes'], r['status']))
    return c

def tier(c, sid):
    return c.execute('select tier, market_scope from sources where source_id=?', (sid,)).fetchone()

def add_evidence(c, source_id, locator, kind, body, retrieved_at, source_updated_at=None, note=None, batch=BATCH):
    eid = sha(body)[:20]
    c.execute('insert or ignore into evidence values (?,?,?,?,?,?,?,?,?,?)',
              (eid, source_id, locator, kind, retrieved_at, sha(body), len(body), source_updated_at, batch, note))
    return eid

def add_obs(c, **o):
    t, scope = tier(c, o['source_id'])
    oid = hid(o['evidence_id'], o.get('evidence_pointer'), o['field'], o.get('trim_raw'), o.get('value_raw'))
    row = dict(observation_id=oid, batch_id=o.get('batch_id', BATCH), evidence_id=o['evidence_id'],
               evidence_pointer=o.get('evidence_pointer'), source_id=o['source_id'], source_tier=t, market_scope=scope,
               brand_raw=o['brand_raw'], model_raw=o['model_raw'], trim_raw=o.get('trim_raw'),
               model_year=o.get('model_year'), model_id=o.get('model_id'), trim_key=trim_key(o.get('trim_raw')),
               identity_confidence=o.get('identity_confidence', 'NONE'), field=o['field'], value_raw=o.get('value_raw'),
               value_num=o.get('value_num'), unit=o.get('unit'), value_status=o.get('value_status', 'OK'),
               observed_at=o['observed_at'], effective_date=o.get('effective_date'),
               extraction_method=o['extraction_method'], extraction_kind=o['extraction_kind'],
               confidence=o['confidence'], verification_state=o.get('verification_state', 'observed'),
               conflict_state='none', promotion_state='not_candidate', notes=o.get('notes'))
    c.execute(f'insert or ignore into observations ({",".join(row)}) values ({",".join("?" * len(row))})',
              list(row.values()))
    return oid

# ---------------------------------------------------------------- inputs
def load_universe(path):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'^\s*window\.CI_UNIVERSE\s*=\s*', '', s).rstrip().rstrip(';')
    return json.loads(s)

LEGACY_SOURCE = {'ContactCars': 'contactcars', 'ContactCars(Lineup)': 'contactcars_lineup',
                 'ContactCars(pricetable)': 'contactcars_pricetable', 'ContactCars(classified)': 'contactcars_classified',
                 'Hatla2ee': 'hatla2ee', 'Hatla2ee(summary)': 'hatla2ee_summary', 'EgyCar': 'egycar',
                 'YallaMotor': 'yallamotor', 'YallaMotor(classified)': 'yallamotor_classified',
                 'Official-ToyotaEgypt': 'official_toyota_eg'}
SENTINELS = {'price coming soon': 'COMING_SOON', 'not_available': 'NOT_PUBLISHED', 'data not available': 'NOT_PUBLISHED',
             'unavailable': 'NOT_PUBLISHED'}
LEGACY_FIELDS = [('official_price', 'price_official_egp', 'EGP'), ('market_price', 'price_market_egp', 'EGP'),
                 ('horsepower', 'power_hp', 'hp'), ('seats', 'seats', 'count'), ('engine_capacity', 'engine_cc', 'cc'),
                 ('torque', 'torque_nm', 'Nm'), ('transmission', 'transmission', None)]

def stage_legacy(c, master_path, uids):
    """Every 2026-09-10 snapshot row -> observations. Method of that scrape is undocumented, so these are
    legacy_unknown / observed only: never counted as verified."""
    n = 0
    for i, r in enumerate(csv.DictReader(open(master_path, encoding='utf-8'))):
        sid = LEGACY_SOURCE.get(r['source'])
        if not sid:
            continue
        ev = add_evidence(c, sid, r['source_url'], 'csv_row', json.dumps(r, sort_keys=True).encode(),
                          r['collection_date'] + 'T00:00:00Z', r['price_date'] or None,
                          'carindex_master.csv row (2026-09-10 snapshot)', batch='S0_2026-09-10')
        mid, conf = resolve_model(uids, r['brand_normalized'], r['model_normalized'])
        yr = int(r['model_year']) if re.fullmatch(r'\d{4}', r['model_year'].strip()) else None
        for col, field, unit in LEGACY_FIELDS:
            v = r[col].strip()
            if not v:
                continue
            status = SENTINELS.get(v.lower(), 'OK')
            vn = None
            if status == 'OK' and unit:
                if field.startswith('price') and '-' in v:
                    status = 'RANGE'
                else:
                    vn = num(v.split('/')[0])
                    if vn is None: status = 'PARSE_FAILED'
            add_obs(c, batch_id='S0_2026-09-10', evidence_id=ev, evidence_pointer=f'carindex_master.csv#row{i + 2}.{col}',
                    source_id=sid, brand_raw=r['brand_normalized'], model_raw=r['model_normalized'],
                    trim_raw=r['variant_raw'], model_year=yr, model_id=mid, identity_confidence=conf, field=field,
                    value_raw=v, value_num=vn, unit=unit, value_status=status, observed_at=r['collection_date'],
                    effective_date=r['price_date'] or None, extraction_method='legacy_scrape_2026-09-10',
                    extraction_kind='legacy_unknown', confidence='LOW', verification_state='observed',
                    notes=(r['notes'] or '')[:300] or None)
            n += 1
    return n

# ---------------------------------------------------------------- Tier-1 recipe: Nissan Egypt
NISSAN_PAGES = ['magnite', 'sunny', 'sentra', 'qashqai', 'x-trail', 'juke', 'allnewpatrol']
NISSAN_SPEC_PAGES = ['magnite', 'x-trail', 'juke', 'allnewpatrol']   # others 404 (recorded as exceptions)
NISSAN_BROCHURES = {  # model page -> official brochure URL listed on en.nissan.com.eg/vehicles/brochures.html
    'magnite': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/nissan_middle_east/brochures/LIB/NISSAN_EGYPT_MAGNITE-EN.pdf',
    'sunny': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/eg/brochures/Sunny.pdf',
    'sentra': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/eg/brochures/SENTRA.pdf',
    'qashqai': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/eg/brochures/NEW-NISSAN-QASHQAI-EGP.pdf',
    'x-trail': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/eg/brochures/ALL-NEW-NISSAN-X-TRAIL-EGP.pdf',
    'allnewpatrol': 'https://www-europe.nissan-cdn.net/content/dam/Nissan/eg/brochures/ALL-NEW-NISSAN-PATROL-EGP.pdf'}

def fetch(url, dest, refetch):
    if refetch or not os.path.exists(dest):
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
        open(dest, 'wb').write(body)
        open(dest + '.meta', 'w').write(json.dumps({'url': url, 'retrieved_at': NOW(), 'status': 200}))
    meta = json.load(open(dest + '.meta'))
    return open(dest, 'rb').read(), meta['retrieved_at']

def nissan_grade_names(t):
    """Grade key -> official grade name. Three page variants exist on the same site (documented in RECIPES.md)."""
    names = {}
    for g in re.findall(r'id="listing-pricing-data"[^>]*data-grade-data="([^"]*)"', t) + \
             re.findall(r'data-grade-data="([^"]*)"', t):
        for part in g.split(','):
            if '=' in part:
                n, k = part.rsplit('=', 1)
                names.setdefault(k.strip(), n.strip())
    if not names:  # variant B: grade cards in page order, labelled "<MODEL> <grade>" before "Starting from"
        keys = re.findall(r'data-grade-id="(LVL\d+)"', t)
        x = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
        x = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '|', x)))
        x = re.sub(r'(\s*\|\s*)+', '|', x)
        after = x.split('DISCOVER YOUR PERFECT', 1)
        if len(after) == 2:
            labels = re.findall(r'\|([^|]{2,60})\|Starting from', after[1])
            if len(labels) == len(keys):
                names = dict(zip(keys, labels))
    return names

SPEC_LABELS = {'Number of Seats': ('seats', 'count'), 'Engine displacement': ('engine_cc', 'cc'),
               'Overall Length (mm)': ('length_mm', 'mm'), 'Wheelbase (mm)': ('wheelbase_mm', 'mm'),
               'Fuel Capacity (litres)': ('fuel_tank_l', 'l'), 'Luggage Capacity (VDA) (litres)': ('boot_l', 'l'),
               'Ground Clearance (mm)': ('ground_clearance_mm', 'mm'), 'Fuel Type': ('fuel_type', None),
               'Wheels Driven': ('drive', None)}

# Brochure regexes: each pattern was written against the official PDF text and is listed in RECIPES.md.
BROCHURE_RULES = {
    'sunny': [(r'Engine capacity \(cc\)\s*([\d,]+)', 'engine_cc', 'cc', None),
              (r'Max Output \(hp/rpm\)\s*(\d+)/', 'power_hp', 'hp', None),
              (r'Max Torque \(nm/rpm\)\s*(\d+)/', 'torque_nm', 'Nm', None)],
    'sentra': [(r'C-VTC\s*\n\s*(\d{4})\s*\n', 'engine_cc', 'cc', None),
               (r'C-VTC\s*\n\s*\d{4}\s*\n\s*(\d+) / [\d,]+', 'power_hp', 'hp', None),
               (r'C-VTC\s*\n\s*\d{4}\s*\n\s*\d+ / [\d,]+\s*\n\s*(\d+) / ', 'torque_nm', 'Nm', None)],
    'x-trail': [(r'Combined output \(hp/PS\)\s*(\d+)/\d+\s+\d+/\d+', 'power_hp', 'hp', 'e-POWER 2WD'),
                (r'Combined output \(hp/PS\)\s*\d+/\d+\s+(\d+)/\d+', 'power_hp', 'hp', 'e-POWER AWD'),
                (r'WITH (\d) SEATS WITH \d SEATS', 'seats', 'count', 'e-POWER 2WD'),
                (r'WITH \d SEATS WITH (\d) SEATS', 'seats', 'count', 'e-POWER AWD'),
                (r'Fuel tank capacity \(L\)\s*(\d+)', 'fuel_tank_l', 'l', None),
                (r'A - Overall length \(mm\)\s*(\d+)', 'length_mm', 'mm', None)],
    'allnewpatrol': [(r'MAX POWER \(NET\) (\d+) HP @ 6,400', 'power_hp', 'hp', '3.8L V6'),
                     (r'MAX POWER \(NET\) (\d+) HP @ 5,600', 'power_hp', 'hp', '3.5L V6TT'),
                     (r'MAX TORQUE \(NET\) (\d+) NM @ 4,400', 'torque_nm', 'Nm', '3.8L V6'),
                     (r'MAX TORQUE \(NET\) (\d+) NM @ 3,600', 'torque_nm', 'Nm', '3.5L V6TT')],
}

def exception(c, kind, subject, detail, route):
    c.execute('insert or ignore into exceptions values (?,?,?,?,?,?)',
              (hid(kind, subject, detail), BATCH, kind, subject, detail, route))

def stage_nissan(c, work, uids, refetch, pdf_text):
    ev_dir = os.path.join(work, 'evidence'); os.makedirs(ev_dir, exist_ok=True)
    stats = {'pages': 0, 'price_obs': 0, 'spec_obs': 0, 'http_requests': 0}
    for page in NISSAN_PAGES:
        url = f'https://en.nissan.com.eg/vehicles/new/{page}.html'
        body, got = fetch(url, os.path.join(ev_dir, f'nissan_{page}.html'), refetch); stats['http_requests'] += 1
        t = body.decode('utf-8', 'ignore')
        j = re.search(r'id="individualVehiclePriceJSON"[^>]*>(.*?)</', t, re.S)
        if not j:
            exception(c, 'UNSTRUCTURED_SOURCE', url, 'individualVehiclePriceJSON missing', 'ai_exception'); continue
        d = json.loads(html.unescape(j.group(1)).strip())
        key = next(iter(d)); blk = d[key]
        upd = blk.get('Updated_On')
        eff = dt.datetime.strptime(upd, '%Y.%m.%d.%H.%M.%S').strftime('%Y-%m-%d') if upd else None
        ev = add_evidence(c, 'nissan_eg_web', url, 'html', body, got, eff, f'price json key={key}')
        stats['pages'] += 1
        mid, conf = resolve_model(uids, 'Nissan', key)
        if not mid:
            exception(c, 'IDENTITY_UNKNOWN', url, f'price json key {key} not in P1 universe', 'human_review')
        yr = int(key[:4]) if re.match(r'^\d{4}-', key) else None
        names = nissan_grade_names(t)
        channel = next(k for k in blk if k not in ('Updated_On', 'modelCode'))
        for gk, g in blk[channel]['grades'].items():
            gname = names.get(gk)
            price = g.get('gradePrice') or ''
            status = 'OK' if price else 'NOT_PUBLISHED'
            add_obs(c, evidence_id=ev, evidence_pointer=f'individualVehiclePriceJSON.{key}.{channel}.grades.{gk}.gradePrice',
                    source_id='nissan_eg_web', brand_raw='Nissan', model_raw=key, trim_raw=gname or f'UNNAMED:{gk}',
                    model_year=yr, model_id=mid, identity_confidence=conf, field='price_official_egp',
                    value_raw=price, value_num=num(price), unit='EGP', value_status=status, observed_at=got[:10],
                    effective_date=eff, extraction_method='nissan_eg_vlp_json@1', extraction_kind='deterministic',
                    confidence='HIGH' if gname else 'MEDIUM', verification_state='validated',
                    notes=None if gname else 'grade name not published on page: trim identity needs review')
            stats['price_obs'] += 1
            if not gname:
                exception(c, 'IDENTITY_UNKNOWN', f'{mid} {gk}', f'official grade {gk} @ {price} EGP has no name on page', 'ai_exception')
    for page in NISSAN_SPEC_PAGES:
        url = f'https://en.nissan.com.eg/vehicles/new/{page}/specifications.html'
        body, got = fetch(url, os.path.join(ev_dir, f'nissan_{page}_spec.html'), refetch); stats['http_requests'] += 1
        t = body.decode('utf-8', 'ignore')
        x = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
        x = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '|', x))); x = re.sub(r'(\s*\|\s*)+', '|', x)
        found = 0
        ev = add_evidence(c, 'nissan_eg_web', url, 'html', body, got, None, 'specifications page')
        mid, conf = resolve_model(uids, 'Nissan', page)
        for label, (field, unit) in SPEC_LABELS.items():
            m = re.search(r'\|' + re.escape(label) + r'\|([^|]+)\|', x)
            if not m: continue
            v = m.group(1).strip()
            add_obs(c, evidence_id=ev, evidence_pointer=f'spec table label "{label}"', source_id='nissan_eg_web',
                    brand_raw='Nissan', model_raw=page, trim_raw=None, model_id=mid, identity_confidence=conf,
                    field=field, value_raw=v, value_num=num(v) if unit else None, unit=unit, observed_at=got[:10],
                    extraction_method='nissan_eg_spec_table@1', extraction_kind='deterministic', confidence='HIGH',
                    verification_state='validated',
                    notes='spec table shows one grade only; applies to that grade unless brochure confirms model-wide')
            found += 1; stats['spec_obs'] += 1
        if not found:
            exception(c, 'UNSTRUCTURED_SOURCE', url, 'no label|value spec table (different page template)', 'ai_exception')
    for page in ['sunny', 'sentra', 'qashqai']:
        exception(c, 'UNSTRUCTURED_SOURCE', f'https://en.nissan.com.eg/vehicles/new/{page}/specifications.html',
                  'HTTP 404: no spec page; brochure is the only official spec source', 'deterministic')
    for page, url in NISSAN_BROCHURES.items():
        body, got = fetch(url, os.path.join(ev_dir, f'nissan_{page}_brochure.pdf'), refetch); stats['http_requests'] += 1
        ev = add_evidence(c, 'nissan_eg_brochure', url, 'pdf', body, got, None, 'official brochure')
        txt = pdf_text(os.path.join(ev_dir, f'nissan_{page}_brochure.pdf'))
        mid, conf = resolve_model(uids, 'Nissan', page)
        rules = BROCHURE_RULES.get(page)
        if not rules:
            exception(c, 'UNSTRUCTURED_SOURCE', url, 'brochure text has labels without extractable values '
                      '(values rendered as images/columns): needs manual or AI-assisted read', 'ai_exception'); continue
        for pat, field, unit, trim in rules:
            m = re.search(pat, txt)
            if not m:
                exception(c, 'UNSTRUCTURED_SOURCE', url, f'rule {pat!r} found nothing', 'ai_exception'); continue
            v = m.group(1)
            add_obs(c, evidence_id=ev, evidence_pointer=f'pdf text rule {pat}', source_id='nissan_eg_brochure',
                    brand_raw='Nissan', model_raw=page, trim_raw=trim, model_id=mid, identity_confidence=conf,
                    field=field, value_raw=v, value_num=num(v), unit=unit, observed_at=got[:10],
                    extraction_method='nissan_eg_brochure_regex@1', extraction_kind='deterministic',
                    confidence='MEDIUM' if page == 'sentra' else 'HIGH', verification_state='validated',
                    notes='positional PDF text rule (label and value columns detached)' if page == 'sentra' else None)
            stats['spec_obs'] += 1
    return stats

# ---------------------------------------------------------------- reconcile
CONSUMER_FIELDS = {'power_hp': 'hp', 'seats': 'seats'}

def reconcile(c, universe, batch_models):
    """Compare Tier-1 observations with (a) legacy aggregator observations and (b) the P1 consumer universe."""
    um = {m['id']: m for m in universe['models']}
    out = {'matched_equal': 0, 'matched_diff': 0, 't1_only': 0, 'consumer_only': 0}
    for mid in batch_models:
        m = um[mid]
        t1 = c.execute("""select observation_id, trim_raw, trim_key, value_num, value_status, effective_date
                          from observations where batch_id=? and model_id=? and field='price_official_egp'
                          and source_tier=1""", (BATCH, mid)).fetchall()
        cons = [(t['label'], trim_key(t['label']), t['min'], t['official'], t['date']) for t in m['trims']]
        compat = lambda a, b: trim_key(a) == trim_key(b) and (trans_of(a) is None or trans_of(b) is None
                                                              or trans_of(a) == trans_of(b))
        matched_cons = set()
        for oid, raw, k, v, st, eff in t1:
            match = [(lab, p, off, d) for lab, _, p, off, d in cons if compat(raw, lab)]
            matched_cons.update(x[0] for x in match)
            if st != 'OK':
                c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                          (hid('NP', oid), BATCH, mid, k, 'price_official_egp', 'VALUE', json.dumps([oid]),
                           f'official grade "{raw}" lists no price; consumer set shows {match}',
                           'official site silent: keep aggregator value visible, do not promote', 'open', 'human_review'))
                continue
            aggs = c.execute("""select observation_id, source_id, trim_raw, value_num, model_year from observations
                                where batch_id='S0_2026-09-10' and model_id=? and trim_key=? and field='price_official_egp'
                                and value_status='OK'""", (mid, k)).fetchall()
            if match:
                diffs = [(lab, p) for lab, p, off, d in match if p != v]
                if diffs:
                    out['matched_diff'] += 1
                    c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                              (hid('V', oid), BATCH, mid, k, 'price_official_egp', 'VALUE',
                               json.dumps([oid] + [a[0] for a in aggs]),
                               f'T1 "{raw}" {v:,.0f} (updated {eff}) vs consumer {diffs}; aggregators '
                               f'{[(a[1], a[2], a[3]) for a in aggs]}',
                               'tier rule favours T1 value', 'open', 'deterministic'))
                    add_candidate(c, mid, k, 'price_official_egp', v, str(diffs), 'CORRECT', [oid],
                                  'P2 owner review (value change on a live P1 trim)')
                else:
                    out['matched_equal'] += 1
                    c.execute("update observations set verification_state='t1_verified', promotion_state='candidate' "
                              "where observation_id=?", (oid,))
                    add_candidate(c, mid, k, 'price_official_egp', v, str(v), 'CONFIRM', [oid] + [a[0] for a in aggs],
                                  'auto-eligible under CONTRACT §6 (T1, deterministic, no conflict)')
                    for a in aggs:  # aggregators that agree get corroborated, never verified
                        if a[3] == v:
                            c.execute("update observations set verification_state='corroborated' where observation_id=?", (a[0],))
            else:
                out['t1_only'] += 1
                c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                          (hid('T1O', oid), BATCH, mid, k, 'trim', 'TRIM_ONLY_IN_T1', json.dumps([oid]),
                           f'official grade "{raw}" {v:,.0f} has no trim_key match in consumer set '
                           f'{[x[0] for x in cons]}; same-price consumer labels: '
                           f'{[x[0] for x in cons if x[2] == v]}', 'label reconciliation', 'open', 'ai_exception'))
                add_candidate(c, mid, k, 'trim', raw, None, 'ADD', [oid], 'P2 owner review (new or renamed trim)')
        for lab, k, p, off, d in cons:
            if lab not in matched_cons:
                out['consumer_only'] += 1
                c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                          (hid('CO', mid, lab), BATCH, mid, k, 'trim', 'TRIM_ONLY_IN_CONSUMER', '[]',
                           f'consumer trim "{lab}" {p:,} (date {d}) not on official site',
                           'possibly stale, dealer-only, renamed or duplicate label', 'open', 'ai_exception'))
                add_candidate(c, mid, k, 'trim', lab, lab, 'FLAG_STALE', [], 'P2 owner review')
        # model year: T1 states it only in some price-json keys; consumer/aggregators state their own
        t1y = {r[0] for r in c.execute("select distinct model_year from observations where batch_id=? and model_id=? "
                                       "and source_tier=1 and model_year is not null", (BATCH, mid))}
        cy = {t['year'] for t in m['trims']}
        if t1y and t1y != cy:
            ids = [r[0] for r in c.execute("select observation_id from observations where batch_id=? and model_id=? "
                                           "and source_tier=1 and model_year is not null", (BATCH, mid))]
            c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                      (hid('MY', mid), BATCH, mid, None, 'model_year', 'MODEL_YEAR', json.dumps(ids),
                       f'official price key says {sorted(t1y)}; consumer trims say {sorted(cy)}',
                       'do not relabel: Egypt MY conventions differ (dealers sell next MY early)', 'open', 'human_review'))
        # model-level specs vs consumer fields
        for field, ukey in CONSUMER_FIELDS.items():
            obs = c.execute("""select observation_id, trim_raw, value_num from observations where batch_id=? and model_id=?
                               and field=? and source_tier=1""", (BATCH, mid, field)).fetchall()
            if not obs: continue
            cur = m.get(ukey)
            vals = sorted({o[2] for o in obs})
            curvals = sorted(cur) if isinstance(cur, list) else ([cur] if cur else [])
            if curvals and set(curvals) == set(vals):
                for o in obs:
                    c.execute("update observations set verification_state='t1_verified', promotion_state='candidate' "
                              "where observation_id=?", (o[0],))
                add_candidate(c, mid, None, field, json.dumps(vals), json.dumps(curvals), 'CONFIRM', [o[0] for o in obs],
                              'auto-eligible under CONTRACT §6')
            elif not curvals:
                for o in obs:
                    c.execute("update observations set promotion_state='candidate' where observation_id=?", (o[0],))
                add_candidate(c, mid, None, field, json.dumps(vals), None, 'ADD', [o[0] for o in obs],
                              'P2 owner review (fills an empty consumer field)' + (
                                  '; FMC hard-constraint field, version-scoped' if field == 'seats' else ''))
            else:
                c.execute("insert or ignore into conflicts values (?,?,?,?,?,?,?,?,?,?,?)",
                          (hid('SPEC', mid, field), BATCH, mid, None, field, 'VALUE', json.dumps([o[0] for o in obs]),
                           f'T1 {vals} vs consumer {curvals}', 'tier rule favours T1', 'open', 'deterministic'))
                add_candidate(c, mid, None, field, json.dumps(vals), json.dumps(curvals), 'CORRECT',
                              [o[0] for o in obs], 'P2 owner review')
    c.execute("update observations set conflict_state='open' where observation_id in "
              "(select value from conflicts, json_each(conflicts.observation_ids) where conflicts.state='open')")
    # an open conflict blocks verification and promotion, whatever the tier (CONTRACT §5-6)
    c.execute("update observations set verification_state='validated', promotion_state='blocked' "
              "where conflict_state='open' and verification_state='t1_verified'")
    c.execute("update observations set promotion_state='blocked' where conflict_state='open' and promotion_state='candidate'")
    c.execute("update promotion_candidates set state='blocked_by_conflict' where exists (select 1 from observations o, "
              "json_each(promotion_candidates.supporting_observation_ids) j where o.observation_id=j.value "
              "and o.source_tier=1 and o.conflict_state='open')")
    return out

def add_candidate(c, mid, k, field, val, cur, ctype, oids, gate):
    c.execute('insert or ignore into promotion_candidates values (?,?,?,?,?,?,?,?,?,?,?)',
              (hid(mid, k, field, ctype, val), BATCH, mid, k, field, str(val), cur, ctype, json.dumps(oids), gate, 'pending'))

# ---------------------------------------------------------------- readiness
def reg_units(reg_path, first=202509, last=202608):
    M = {m: i for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), 1)}
    tot, by_label = 0.0, {}
    for r in csv.DictReader(open(reg_path, encoding='utf-8')):
        if r['Car Type'] != 'Passenger': continue
        try: ym = int(r['Year']) * 100 + M[r['Month']]; v = float(r['Vol'] or 0)
        except (KeyError, ValueError): continue
        if first <= ym <= last:
            tot += v; by_label[(r['Brand'] or '').strip().lower(), r['Consolidated']] = by_label.get(
                ((r['Brand'] or '').strip().lower(), r['Consolidated']), 0) + v
    return tot, by_label

def readiness(c, universe, reg, phase, scope_models, scope):
    rows = []
    def k(name, n, d, definition, status='MEASURED'):
        val = (n / d) if (d and status == 'MEASURED') else None
        rows.append((phase, scope, name, n, d, val, status, definition))
    ms = [m for m in universe['models'] if m['u'] and m['id'] in scope_models]
    trims = [(m['id'], t) for m in ms for t in m['trims']]
    reg_tot, reg_lab = reg
    units = lambda m: ((m.get('reg') or {}).get('last12') or 0)
    tier1_ok = {(r[0], r[1]) for r in c.execute(
        "select model_id, trim_key from observations where source_tier=1 and field='price_official_egp' and "
        "verification_state='t1_verified' and conflict_state='none'")}
    t1_models_obs = {r[0] for r in c.execute(
        "select distinct model_id from observations where source_tier=1 and verification_state in ('validated','t1_verified')")}
    staged = lambda mid, tk: (mid, tk) in tier1_ok if phase == 'after' else False
    k('model_coverage_consumer', sum(1 for m in ms if m['trims']), len(ms),
      'in-universe models with >=1 priced trim / in-universe models (P1 U11 u=true)')
    if scope == 'global':
        k('market_coverage_units', sum(units(m) for m in ms), reg_tot,
          'passenger registrations Sep-2025..Aug-2026 attributed by P1 to in-universe models / all passenger '
          'registrations (P1 attribution method undocumented)')
    else:
        brand = scope.lower()
        bt = sum(v for (b, l), v in reg_lab.items() if b == brand)
        k('market_coverage_units', sum(units(m) for m in ms), bt, f'{scope} registrations covered by in-universe models / all {scope} passenger registrations, last 12 months')
        k('missing_models_ge10_units', sum(1 for (b, l), v in reg_lab.items() if b == brand and v >= 10 and
                                          not resolve_model({m['id'] for m in universe['models'] if m['u']}, scope, l.split('-', 1)[-1])[0]),
          None, f'{scope} registration labels with >=10 units (last 12m) that do not resolve to an in-universe model', 'COUNT')
    t1_trims = sum(1 for mid, t in trims if t['official'] or staged(mid, trim_key(t['label'])))
    k('t1_verified_trim_share', t1_trims, len(trims),
      'consumer trims whose price is official (P1 flag) or matched EXACTLY by a T1 deterministic observation with no open conflict'
      + (' [staging overlay; canonical unchanged]' if phase == 'after' else ''))
    t1_models = [m for m in ms if any(t['official'] or staged(m['id'], trim_key(t['label'])) for t in m['trims'])]
    k('t1_model_share_units', sum(units(m) for m in t1_models), sum(units(m) for m in ms),
      'registration-weighted share of in-universe models with >=1 T1-verified price')
    k('t1_source_available_models', len([m for m in ms if m['id'] in t1_models_obs or any(t['official'] for t in m['trims'])]), len(ms),
      'in-universe models for which CarIndex holds at least one validated Tier-1 observation (any field)')
    for f in ('power_hp', 'seats', 'engine_cc', 'torque_nm'):
        if phase == 'after':
            n = c.execute(f"select count(distinct model_id) from observations where source_tier=1 and field=? and "
                          f"verification_state in ('validated','t1_verified') and model_id in ({','.join('?' * len(ms))})",
                          [f] + [m['id'] for m in ms]).fetchone()[0]
        else:
            n = 0
        k(f'field_t1_backed_{f}', n, len(ms), f'in-universe models with a validated Tier-1 observation for {f} (staging)')
    fresh = sum(1 for mid, t in trims if (AS_OF - dt.date.fromisoformat(t['date'])).days <= 30)
    k('price_freshness_30d', fresh, len(trims), 'consumer trims whose price observation date is <=30 days before 2026-09-28 '
      '(observation date, not source effective date)')
    for f, key in [('power_hp', 'hp'), ('seats', 'seats'), ('warranty_years', 'warranty_years'),
                   ('powertrains', 'powertrains'), ('image', 'image')]:
        k(f'field_complete_{f}', sum(1 for m in ms if m.get(key)), len(ms), f'in-universe models with non-empty "{key}"')
    if phase == 'after':
        conf = c.execute("select count(*) from conflicts where state='open' and model_id in (%s)" %
                         ','.join('?' * len(ms)), [m['id'] for m in ms]).fetchone()[0]
        k('open_conflicts_visible', conf, None, 'open conflicts recorded in staging for this scope', 'COUNT')
    prov = sum(1 for mid, t in trims if staged(mid, trim_key(t['label'])))
    k('trim_row_provenance', prov, len(trims), 'consumer trims traceable to a source URL + evidence hash '
      '(P1 U11 trims carry no source field; only staging matches provide provenance)')
    k('automation_coverage', prov, len(trims), 'consumer trim prices reproducible by a re-runnable deterministic recipe')
    return rows

# ---------------------------------------------------------------- main
def pdf_text_factory(python):
    def f(path):
        out = path + '.txt'
        if not os.path.exists(out):
            subprocess.run([python, '-c', 'import pypdf,sys;r=pypdf.PdfReader(sys.argv[1]);'
                            'open(sys.argv[2],"w").write("\\n".join((p.extract_text() or "") for p in r.pages))',
                            path, out], check=True, capture_output=True)
        return open(out, encoding='utf-8').read()
    return f

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run'])
    ap.add_argument('--work', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--master', required=True); ap.add_argument('--universe', required=True)
    ap.add_argument('--reg', required=True); ap.add_argument('--pdf-python', default=sys.executable)
    ap.add_argument('--refetch', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True); os.makedirs(a.out, exist_ok=True)
    dbp = os.path.join(a.work, 'staging.sqlite')
    if os.path.exists(dbp): os.remove(dbp)
    c = db_open(dbp)
    uni = load_universe(a.universe); uids = {m['id'] for m in uni['models']}
    n_legacy = stage_legacy(c, a.master, uids)
    reg = reg_units(a.reg)
    all_u = {m['id'] for m in uni['models'] if m['u']}
    nissan = {m['id'] for m in uni['models'] if m['u'] and m['brand'] == 'Nissan'}
    rr = []
    for scope, models in (('global', all_u), ('Nissan', nissan)):
        rr += readiness(c, uni, reg, 'before', models, scope)
    stats = stage_nissan(c, a.work, uids, a.refetch, pdf_text_factory(a.pdf_python))
    rec = reconcile(c, uni, sorted(nissan))
    for (b, lab), v in sorted(reg[1].items()):
        if b == 'nissan' and v >= 10 and not resolve_model(all_u, 'Nissan', lab.split('-', 1)[-1])[0]:
            exception(c, 'MISSING_MODEL', lab, f'{v:.0f} passenger registrations Sep-2025..Aug-2026; not in P1 universe; '
                      'not listed on en.nissan.com.eg (other importer / grey import / re-registration?)', 'human_review')
    for scope, models in (('global', all_u), ('Nissan', nissan)):
        rr += readiness(c, uni, reg, 'after', models, scope)
    for r in rr:
        c.execute('insert or replace into readiness_runs values (?,?,?,?,?,?,?,?,?)', (BATCH,) + r)
    c.commit()
    # exports
    for tbl, q in [('observations_batch', f"select * from observations where batch_id='{BATCH}'"),
                   ('evidence_batch', f"select * from evidence where batch_id='{BATCH}'"),
                   ('conflicts', 'select * from conflicts'), ('promotion_candidates', 'select * from promotion_candidates'),
                   ('exceptions', 'select * from exceptions'), ('readiness', 'select * from readiness_runs'),
                   ('observations_legacy_nissan', "select * from observations where batch_id='S0_2026-09-10' and brand_raw='Nissan'")]:
        cur = c.execute(q); cols = [d[0] for d in cur.description]
        with open(os.path.join(a.out, f'{tbl}.csv'), 'w', newline='', encoding='utf-8') as fh:
            w = csv.writer(fh); w.writerow(cols); w.writerows(cur.fetchall())
    summary = {'batch': BATCH, 'legacy_observations': n_legacy, 'recipe_stats': stats, 'reconcile': rec,
               'counts': {t: c.execute(f'select count(*) from {t}').fetchone()[0]
                          for t in ('evidence', 'observations', 'conflicts', 'promotion_candidates', 'exceptions')},
               'batch_obs_by_state': dict(c.execute(f"select verification_state, count(*) from observations where batch_id='{BATCH}' group by 1").fetchall()),
               'batch_obs_by_kind': dict(c.execute(f"select extraction_kind, count(*) from observations where batch_id='{BATCH}' group by 1").fetchall()),
               'exceptions_by_route': dict(c.execute("select route, count(*) from exceptions group by 1").fetchall()),
               'conflicts_by_type': dict(c.execute("select conflict_type, count(*) from conflicts group by 1").fetchall()),
               'candidates_by_type': dict(c.execute("select change_type, count(*) from promotion_candidates group by 1").fetchall()),
               'universe_version': uni['meta']['version'], 'registration_passenger_units_last12': reg[0]}
    json.dump(summary, open(os.path.join(a.out, 'run_summary.json'), 'w'), indent=2)
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
