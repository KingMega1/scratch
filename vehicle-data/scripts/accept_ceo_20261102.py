#!/usr/bin/env python3
"""Bounded P2 acceptance of the reviewed 2 November intake. No fetch or full rebuild.

Preserves the immutable confirmed ledger, unrelated canonical fields, prior price
observations and the pinned U11 set. Source type and confirmation authority differ.
Run only on the pinned base; repeat execution fails before mutation.
"""
import csv, copy, hashlib, json, pathlib, subprocess
import canonical as c

ROOT = pathlib.Path(c.ROOT)
BASE = '01f976ed5eadd6a8fdc9a649c8adc8f0145fc01b'
RELEASE = 'P2-CEO-CONFIRMED-20261102-R1'
MANIFEST = ROOT / 'review/ceo_acceptance_20261102.json'

def dump(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def csvwrite(path, rows):
    fields = list(dict.fromkeys(k for r in rows for k in r))
    c.write(str(ROOT/path), fields, rows)

def source(r):
    brand = r['p1_id'].split('/')[0]
    issuers = {'baic':'Alkan Auto / BAIC', 'lynk-co':'Ezz Elarab / Lynk & Co',
               'volvo':'Ezz Elarab / Volvo', 'opel':'Mansour / Opel',
               'jetour':'Kasrawy / Jetour', 'kgm':'Arabiat Egypt / KGM',
               'citroen':'Kasrawy / Citroen', 'chevrolet':'Mansour / Chevrolet'}
    if brand in issuers:
        return issuers[brand], 'A', 'Official Pricelist', 'CEO-supplied screenshot of branded price list'
    if brand == 'kia':
        return 'Automotive News Egypt / forwarded Kia increase message', 'C', 'CEO-confirmed increase + Official Pricelist baseline', 'WhatsApp screenshot'
    if brand == 'deepal':
        return 'Sayarat Elyoum', 'C', 'CEO-confirmed media price card', 'Media screenshot'
    if brand == 'bmw':
        return 'Dossbanzin', 'C', 'CEO-confirmed media starting price', 'Media screenshot'
    issuer = 'EgyCar' if int(r['row_id'][-3:]) < 36 else 'Beto3 Arabeyat'
    return issuer, 'C', 'CEO-confirmed media price card', 'Media screenshot'

NEW = [
 ('jaecoo/j5','JAECOO','J5','suv','petrol'),
 ('jaecoo/j7','JAECOO','J7','suv','petrol'),
 ('jaecoo/j7-phev','JAECOO','J7 PHEV','suv','phev'),
 ('jaecoo/j8-phev','JAECOO','J8 PHEV','suv','phev'),
 ('jac/rf8-phev','JAC','RF8 PHEV','mpv','phev')]

def run():
    if MANIFEST.exists():
        raise SystemExit('Intake already materialized: refusing duplicate acceptance.')
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip() != BASE:
        raise SystemExit('Base changed; reconcile before applying intake.')
    ledger=c.read(str(ROOT/'review/ceo_confirmed_prices_20261102.csv'))
    assert len(ledger)==96 and len({r['row_id'] for r in ledger})==96
    canon=json.loads((ROOT/'views/canonical_u11.json').read_text())
    before=copy.deepcopy(canon)
    by={m['p1_id']:m for m in canon['models']}
    prices=c.read(str(ROOT/'registry/u11_prices.csv'))
    evidence=[]
    for sid in dict.fromkeys(r['source_file_id'] for r in ledger):
        r=next(r for r in ledger if r['source_file_id']==sid)
        f=pathlib.Path('/tmp/carindex-p2-evidence')/(sid+'.jpg')
        if not f.exists() and sid=='1zZy62p2JOx0MsqSI06OOX0Qr-qkSDFBV': f=f.parent/'baic.jpg'
        assert hashlib.sha256(f.read_bytes()).hexdigest()==r['source_sha256'],sid
        evidence.append(dict(file_id=sid,url=r['source_url'],sha256=r['source_sha256'],verification='HASH_PASS; VISUAL_PRICE_REVIEW_PASS'))
    cfg=json.loads((ROOT/'config/market_universe.json').read_text())
    ids=c.read(str(ROOT/'registry/u11_models.csv'))
    nextid=max(int(x['model_id'][2:]) for x in ids)+1
    for key,brand,model,body,pt in NEW:
        assert key not in by
        mid=f'm_{nextid:06d}'; nextid+=1
        refs=sorted({r['source_url'] for r in ledger if r['p1_id']==key})
        cfg['identities'].append(dict(id=key,decision='ADDITION',brand=brand,model=model,body=body,powertrains=[pt],u11_id='',urls=[],match=[],evidence=refs,audit_keys=[],note='CEO-authorized 2026-11-02 intake; variant-specific identity; not added to U11 recommendations.'))
        ids.append(dict(model_id=mid,p1_id=key,site_slug=key.replace('/','-'),brand=brand,model=model,brand_ar='',model_ar='',body=body,on_sale_u11='false',generation='UNKNOWN',id_status='ACCEPTED',id_rule='ID-1',identity_checks='',universe='P2_ADDITION'))
        m=dict(model_id=mid,p1_id=key,site_slug=key.replace('/','-'),brand=brand,model=model,size_class=None,id_status='ACCEPTED',generation=None,market_status='unverified',market_status_basis='CEO-confirmed Egypt price intake; not an official website availability claim',universe='P2_ADDITION',price=None,specs=None,specs_accepted=False,warranty=None,brochures=[],logo=None,hero_image=None,hero_image_limited=None,gallery=[],conflicts=[],gaps=['NO_ACCEPTED_SPECS','NO_OFFICIAL_BROCHURE','NO_VERIFIED_HERO_IMAGE','NO_OFFICIAL_LOGO','NO_VERIFIED_WARRANTY','GENERATION_UNKNOWN'],rework_price_rows=0)
        canon['models'].append(m);by[key]=m
    accepted=[];options=[]; per={}; mapping=[]
    for r in ledger:
        mid=by[r['p1_id']]['model_id']
        assert not r['model_id'] or r['model_id']==mid
        issuer,tier,stype,carrier=source(r)
        label=r['trim_label']; kind='trim'; note=''
        if r['row_id']=='CEO1102-042':
            label='7 Series (trim not stated)';kind='from';note='Removed unsupported 740i mapping; confirmed model-level starting price preserved.'
        row=dict(price_id='ceo1102-'+r['row_id'][-3:],model_id=mid,p1_id=r['p1_id'],model_year=r['model_year'],trim_label=label,trim_key=c.b.trim_key(label),price_egp=int(r['price_egp']),effective_date=r['effective_date'],date_basis=r['date_basis'],as_of=r['as_of'],issuer=issuer,tier=tier,evidence_url=r['source_url'],evidence_ref='drive:'+r['source_file_id']+'#sha256='+r['source_sha256'],observed_at='2026-11-02',confidence='HIGH_CEO_CONFIRMED',status='ACCEPT',reason='CEO-1102 explicit confirmation; screenshot visually reviewed; '+note,sites=1,kind=kind,source_type=stype,source_carrier=carrier,source_sha256=r['source_sha256'],confirmation_authority=r['confirmation_authority'],confirmation_status='CEO_CONFIRMED',ledger_row_id=r['row_id'],release_id=RELEASE)
        if r['kind']=='retail_from_confirmed_delta':
            baseline=[p for p in prices if p['p1_id']==r['p1_id'] and p['model_year']==r['model_year'] and p['trim_key']==row['trim_key'] and p['status']=='ACCEPT' and int(p['price_egp'])==int(r['old_exact_trim_prices']) and p['tier']=='A']
            assert baseline,r['row_id']
            assert int(r['old_exact_trim_prices'])+int(r['delta_egp'])==row['price_egp']
            row.update(baseline_price_id=baseline[0]['price_id'],baseline_egp=int(r['old_exact_trim_prices']),confirmed_delta_egp=int(r['delta_egp']),baseline_evidence_url=baseline[0]['evidence_url'],baseline_commit=BASE)
        if r['kind']=='option_surcharge':
            row.update(kind='option_surcharge',option_id=row.pop('price_id'),applicability='Only listed model; trim applicability unspecified; do not add automatically')
            options.append(row)
        else:
            accepted.append(row);per.setdefault(r['p1_id'],[]).append(row)
        olds=[p for p in prices if p['p1_id']==r['p1_id'] and p['trim_key']==row['trim_key'] and p['model_year']==r['model_year'] and p['status']=='ACCEPT']
        mapping.append(dict(ledger_row_id=r['row_id'],p1_id=r['p1_id'],model_id=mid,model_year=r['model_year'],printed_trim=r['trim_label'],canonical_trim=label,trim_key=row['trim_key'],old_exact_prices=';'.join(sorted({p['price_egp'] for p in olds})),old_model_from=(by[r['p1_id']]['price'] or {}).get('price_from',''),confirmed_new_value=r['price_egp'],kind=row['kind'],source_type=stype,source_url=r['source_url'],source_sha256=r['source_sha256'],acceptance_result='ACCEPT_OPTION' if r['kind']=='option_surcharge' else ('ACCEPT_MODEL_FROM_TRIM_UNSTATED' if kind=='from' else 'ACCEPT'),canonical_record_id=row.get('price_id',row.get('option_id')),release_id=RELEASE,mapping_note=note))
    # Preserve every prior observation. Only the exact matching trim/year series is superseded.
    superseded=[]
    for row in accepted:
        for p in prices:
            if (p['p1_id'],p['model_year'],p['trim_key'])==(row['p1_id'],row['model_year'],row['trim_key']) and p['status']=='ACCEPT':
                superseded.append(dict(p,superseded_by=row['price_id']))
                p['status']='SUPERSEDED_BY_CEO_CONFIRMED';p['reason']+='; superseded by '+row['price_id']
    for key, rs in per.items():
        m=by[key];pv=c.price_view(rs)
        # Explicit current intake cohort; previous snapshots remain intact in observation history.
        for t,r in zip(pv['trims'], sorted([r for r in rs if r['kind']=='trim'],key=lambda r:(str(r['model_year']),r['price_egp']))):
            for k in ['price_id','source_type','source_carrier','source_sha256','confirmation_status','confirmation_authority','ledger_row_id']:
                t[k]=r[k]
            if key=='baic/bj30':t['powertrain']='Hybrid' if 'Hybrid' in t['label'] else 'Petrol'
            elif key=='deepal/s09':t['powertrain']='reev'
            elif key in {x[0] for x in NEW}:t['powertrain']=next(x[4] for x in NEW if x[0]==key)
            elif key=='lynk-co/02':t['powertrain']='bev'
            elif key in ['lynk-co/08','lynk-co/900','jetour/t2-i-dm']:t['powertrain']='phev'
        pv.update(confirmation_status='CEO_CONFIRMED',source_type=rs[0]['source_type'],source_sha256=rs[0]['source_sha256'],price_scope='model_from' if rs[0]['kind']=='from' else 'confirmed_intake_trim_cohort',release_id=RELEASE)
        m['price']=pv;m['gaps']=[g for g in m['gaps'] if g!='NO_ACCEPTED_PRICE']
    dump('config/market_universe.json',cfg)
    csvwrite('registry/u11_models.csv',ids)
    csvwrite('registry/u11_prices.csv',prices+accepted)
    csvwrite('registry/price_options_20261102.csv',options)
    csvwrite('review/ceo_acceptance_20261102.csv',mapping)
    dump('review/ceo_supersession_20261102.json',dict(previous_model_prices={m['p1_id']:m['price'] for m in before['models'] if m['p1_id'] in per},exact_series=superseded))
    # Nonprice evidence is deliberately untouched by this bounded price operation.
    for old in before['models']:
        new=by[old['p1_id']]
        for k,v in old.items():
            if k not in ('price','gaps'):assert new[k]==v,(old['p1_id'],k)
        if old['p1_id'] not in per:assert new==old
    canon['generated_as_of']='2026-11-02'
    canon['counts']=c.counts([m for m in canon['models'] if m['universe']=='U11_283'])
    canon['counts_market_universe']=c.counts(canon['models'])
    canon['accepted_intake']=dict(release_id=RELEASE,base_commit=BASE,ledger_sha256=c.sha(str(ROOT/'review/ceo_confirmed_prices_20261102.csv')))
    dump('views/canonical_u11.json',canon)
    c.market_universe.cache_clear();c.serving(canon)
    rel=json.loads((ROOT/'views/catalogue-serving.release.json').read_text());rel['release_id']=RELEASE
    dump('views/catalogue-serving.release.json',rel)
    cov=c.read(str(ROOT/'review/u11_coverage.csv'))
    covby={r['p1_id']:r for r in cov}
    for key in per:
        m=by[key];pv=m['price'];r=covby.get(key)
        if r is None:
            r={k:'' for k in cov[0]};r.update({k:m[k] for k in ['model_id','p1_id','brand','model','universe','id_status','market_status']});cov.append(r)
        r.update(price_status='ACCEPTED',price_from_egp=pv['price_from'],price_model_year=pv['model_year'] or '',price_tier=pv['tier'],price_effective_date=pv['effective_date'] or '',price_date_basis=pv['date_basis'],accepted_trims=len(pv['trims']),evidence_links=pv['evidence_url'],last_verified='2026-11-02',missing=';'.join(m['gaps']))
    csvwrite('review/u11_coverage.csv',cov)
    manifest=dict(task_id='AT-39/AT-51',release_id=RELEASE,state='VERIFYING',base_commit=BASE,confirmed_rows=96,accepted_retail_rows=89,accepted_options=7,new_identities=5,counts_before=before['counts_market_universe'],counts_after=canon['counts_market_universe'],source_files=evidence,unresolved=['BMW exact trim unstated; accepted as model starting price only','No inferred model years or effective dates','P1/P5 consumption not yet verified'],validation={'all_source_hashes':True,'kia_baselines':21,'unrelated_canonical_fields_unchanged':True,'u11_membership_unchanged':283},canonical_sha256=c.sha(str(ROOT/'views/canonical_u11.json')),release_sha256=c.sha(str(ROOT/'views/catalogue-serving.release.json')))
    dump('review/ceo_acceptance_20261102.json',manifest)
    print(json.dumps(manifest['counts_after']))

if __name__=='__main__':run()
