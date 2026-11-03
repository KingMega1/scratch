#!/usr/bin/env python3
"""Reviewed brochure facts; specification pages visually inspected with PDFKit.
Never infer a range cycle, model year, warranty, or a tick from extracted text.
"""
import json,hashlib,pathlib
import canonical as c
from accept_ceo_20261102 import ROOT, RELEASE, dump, csvwrite

DOCS=[
 ('jaecoo/j5','1hag5pAVmq_nyTK-7kYTGq7jTtZb0mi8N','Jaecoo_J5.pdf','Urban; Elite',
  {'powertrain_class':'Petrol','engine_l':'1.5','transmission':'CVT','drive':'FWD','power_hp':'156','torque_nm':'230','seats':'5','length_mm':'4380','width_mm':'1860','height_mm':'1650','wheelbase_mm':'2620'}),
 ('jaecoo/j7','1ftZl6FBcmmn8puu6ZVus9iowpRY8rBMX','Jaecoo_J7_ICE.pdf','Elite; Premium',
  {'powertrain_class':'Petrol','engine_l':'1.6','transmission':'7DCT Wet','drive':'FWD','power_hp':'197','torque_nm':'290','seats':'5','length_mm':'4600','width_mm':'1898','height_mm':'1680','wheelbase_mm':'2672'}),
 ('jaecoo/j7-phev','1DIVaZShwtqlDI2sqwAsmH6GrxhCkCzMV','Jaecoo_J7_PHEV.pdf','Smart',
  {'powertrain_class':'PHEV','engine_l':'1.5','transmission':'DHT','drive':'FWD','power_hp':'279','torque_nm':'365','seats':'5','length_mm':'4500','width_mm':'1865','height_mm':'1680','wheelbase_mm':'2672','battery_kwh':'18.4','electric_range_km':'100','range_cycle':'UNSTATED','dc_charge_kw':'40','ac_charge_kw':'6.6','dc_30_80_min':'20','ac_30_100_min':'200','airbags':'7','wheels_in':'19'}),
 ('jaecoo/j8-phev','1omhxNzxrv0ZwwpYtXFEii3w22uo4NsrA','Jaecoo_J8.pdf','Flagship AWD',
  {'powertrain_class':'PHEV','engine_l':'1.5','transmission':'3DHT','drive':'AWD','power_hp':'600','torque_nm':'915','seats':'7','seat_layout':'2+3+2','length_mm':'4820','width_mm':'1930','height_mm':'1710','wheelbase_mm':'2820','battery_kwh':'34.46','electric_range_km':'120','range_cycle':'UNSTATED','airbags':'10','wheels_in':'20'})]

def run():
    path=ROOT/'review/brochure_acceptance_20261102.json'
    if path.exists():raise SystemExit('Already accepted')
    canon=json.loads((ROOT/'views/canonical_u11.json').read_text());by={m['p1_id']:m for m in canon['models']}
    sf=c.read(str(ROOT/'registry/spec_facts.csv'));uf=c.read(str(ROOT/'registry/u11_spec_facts.csv'));br=c.read(str(ROOT/'registry/brochures.csv'))
    results=[]
    for key,id,name,scope,fields in DOCS:
        data=(pathlib.Path('/tmp/carindex-p2-evidence')/name).read_bytes(); sha=hashlib.sha256(data).hexdigest()
        url=f'https://drive.google.com/file/d/{id}/view';issuer='ESI / Ezz Elarab Elsewedy Investments'
        m=by[key];m['specs']={}
        specific=[]
        if key=='jaecoo/j5':
            for trim,airbag,wheel,aeb,acc in [('Urban','4','17','No','No'),('Elite','6','18','Yes','Yes')]:
                specific.extend((trim,k,v) for k,v in {'airbags':airbag,'wheels_in':wheel,'aeb':aeb,'adaptive_cruise_control':acc}.items())
        if key=='jaecoo/j7':
            for trim,wheel,aeb,acc in [('Elite','18','No','No'),('Premium','19','Yes','Yes')]:
                specific.extend((trim,k,v) for k,v in {'wheels_in':wheel,'aeb':aeb,'adaptive_cruise_control':acc}.items())
        for applicability,field,value in [(scope,k,v) for k,v in fields.items()]+specific:
            ap=applicability+'; supplied Egypt brochure p2; model year unstated'
            if field=='electric_range_km':ap+='; cycle unstated; not WLTP/CLTC comparable'
            src=f'drive:{id}#page=2&sha256={sha}'
            sf.append(dict(p1_id=key,applicability=ap,field=field,value=value,unit='',source_drive_id=id,source_issuer=issuer,status='ACCEPT'))
            uf.append(dict(p1_id=key,field=field,value=value,unit='',applicability=ap,issuer=issuer,tier='A',source=src,status='ACCEPT',reason='Supplied Egypt brochure; page 2 visually inspected; no inferred year/cycle'))
            m['specs'].setdefault(field,[]).append(dict(value=value,unit='',applicability=ap,issuer=issuer,source=src))
        m['specs_accepted']=len(c.CORE_SPECS & set(m['specs']))>=3
        b=dict(drive_id=id,title=name.replace('_',' '),issuer=issuer,scope=scope,url=url,sha256=sha)
        m['brochures'].append(b)
        br.append(dict(drive_id=id,title=b['title'],bytes=len(data),p1_id=key,variant_scope=scope,issuer=issuer,egypt_basis='ESI branding and Egypt hotline 17858; CEO supplied',status='ACCEPT',reason='Original accessible; specification page visually checked; warranty/model year not stated',url=url))
        m['gaps']=[g for g in m['gaps'] if g not in ('NO_ACCEPTED_SPECS','NO_OFFICIAL_BROCHURE')]
        results.append(dict(p1_id=key,model_id=m['model_id'],source_url=url,sha256=sha,bytes=len(data),spec_fact_count=len(fields)+len(specific),warranty='NOT_STATED',model_year=None,printed_date=None,range_cycle='UNSTATED' if 'electric_range_km' in fields else None,status='ACCEPT'))
    # Correct date semantics without rewriting the immutable confirmed input ledger.
    prices=c.read(str(ROOT/'registry/u11_prices.csv'))
    list_date_brands={'baic','jetour','citroen','chevrolet'}
    for r in prices:
        if r.get('ledger_row_id') and r['p1_id'].split('/')[0] in list_date_brands:
            r['printed_date']=r['effective_date'];r['effective_date']='';r['date_basis']='SOURCE_PRINTED_DATE'
            r['reason']+='; printed list date retained; effective date not explicitly stated'
    for m in canon['models']:
        if m['p1_id'].split('/')[0] not in list_date_brands or (m['price'] or {}).get('release_id')!=RELEASE:continue
        for obj in [m['price']]+m['price']['trims']:
            obj['printed_date']=obj['effective_date'];obj['effective_date']=None;obj['date_basis']='SOURCE_PRINTED_DATE'
    csvwrite('registry/u11_prices.csv',prices);csvwrite('registry/spec_facts.csv',sf);csvwrite('registry/u11_spec_facts.csv',uf);csvwrite('registry/brochures.csv',br)
    canon['counts']=c.counts([m for m in canon['models'] if m['universe']=='U11_283']);canon['counts_market_universe']=c.counts(canon['models'])
    dump('views/canonical_u11.json',canon);c.serving(canon)
    rel=json.loads((ROOT/'views/catalogue-serving.release.json').read_text());rel['release_id']=RELEASE;dump('views/catalogue-serving.release.json',rel)
    cov=c.read(str(ROOT/'review/u11_coverage.csv'))
    for r in cov:
        m=by[r['p1_id']]
        if r['p1_id'] in {x[0] for x in DOCS}:
            r.update(specs_status='ACCEPTED',spec_fields=len(m['specs']),brochure_status='ACCEPTED',missing=';'.join(m['gaps']))
        if (m['price'] or {}).get('release_id')==RELEASE:
            r.update(price_effective_date=m['price']['effective_date'] or '',price_date_basis=m['price']['date_basis'])
    csvwrite('review/u11_coverage.csv',cov)
    manifest=json.loads((ROOT/'review/ceo_acceptance_20261102.json').read_text())
    manifest.update(counts_after=canon['counts_market_universe'],brochure_records=results,canonical_sha256=c.sha(str(ROOT/'views/canonical_u11.json')),release_sha256=c.sha(str(ROOT/'views/catalogue-serving.release.json')))
    manifest['unresolved'].append('Printed dates on BAIC/Jetour/Citroen/Chevrolet lists are not asserted as effective dates; immutable ledger preserved and canonical date_basis corrected')
    dump('review/ceo_acceptance_20261102.json',manifest);dump('review/brochure_acceptance_20261102.json',results)
    # Preserve original formatting style to keep the review diff readable.
    for name,indent,sort in [('views/canonical_u11.json',1,True),('config/market_universe.json',1,False)]:
        p=ROOT/name;p.write_text(json.dumps(json.loads(p.read_text()),ensure_ascii=False,indent=indent,sort_keys=sort))
    manifest['canonical_sha256']=c.sha(str(ROOT/'views/canonical_u11.json'));dump('review/ceo_acceptance_20261102.json',manifest)
    print(json.dumps(dict(facts=sum(r['spec_fact_count'] for r in results),counts=canon['counts_market_universe'])))

if __name__=='__main__':run()
