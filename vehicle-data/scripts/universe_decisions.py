#!/usr/bin/env python3
"""Record P2 market-universe decisions (config/market_universe.json) from the raw audit (review/market_universe_audit.csv).

Run order: universe_audit.py with SPLIT-only config -> universe_decisions.py -> universe_audit.py -> canonical.py.
Each decision carries the audit evidence (registrations, official Egypt page, priced market pages). Commercial vehicles
are OUT_OF_SCOPE; pages/registration spellings of an existing identity are SOURCE_ALIAS; unverifiable listings are REVIEW.
"""
import csv,json,re
A={r['identity']:r for r in csv.DictReader(open('review/market_universe_audit.csv'))}
def urls(keys): return sorted({u for k in keys for u in (A.get(k,{}).get('page_urls') or '').split(' | ') if u})
def ev(keys):
  out=[]
  for k in keys:
    r=A.get(k)
    if not r: continue
    if int(r['reg_last12'] or 0): out.append(f"Registrations last 12m {r['reg_last12']} / last 6m {r['reg_last6']} ({r['reg_names']}; {r['reg_engines']})")
    if r['current_model_years']: out.append(f"Market new-car pages with priced model years {r['current_model_years']} ({r['market_pages']} page(s); snapshots/UA_2026-10-14_38545206122)")
    if r['official_pages']: out.append(f"Official Egypt model page: {r['official_pages']}")
    if r['u11_status'].startswith('U11_EXCLUDED'): out.append(f"P1 U11 reference id kept; P1 exclusion: {r['u11_status'][13:]} (P1 eligibility unchanged)")
  return out
# (id, brand, model, body, powertrains, audit keys merged, extra reg names)
ADD=[
 ('mg/rx5','MG','RX5 Plus','suv',['petrol'],['mg/rx5','mg/rx5-plus'],[]),
 ('byd/song-l','BYD','Song L','suv',['ev'],['byd/song-l'],[]),
 ('bmw/3-series','BMW','3 Series','sedan',['petrol'],['bmw/3-series','bmw/320'],[]),
 ('honda/cr-v','Honda','CR-V','suv',['petrol','hybrid'],['honda/cr-v'],[]),
 ('kia/carnival','Kia','Carnival','mpv',['petrol'],['kia/carnival'],[]),
 ('bmw/x3','BMW','X3','suv',['petrol'],['bmw/x3'],[]),
 ('toyota/land-cruiser','Toyota','Land Cruiser','suv',['petrol'],['toyota/land-cruiser'],[]),
 ('byd/tang-l','BYD','Tang L','suv',['ev'],['byd/tangl'],[]),
 ('land-rover/range-rover','Land Rover','Range Rover','suv',['petrol','hybrid'],['land-rover/range-rover','land-rover/new-range-rover'],[]),
 ('land-rover/range-rover-vogue','Land Rover','Range Rover Vogue','suv',['petrol'],['landrover/vogue'],[]),
 ('land-rover/range-rover-sport','Land Rover','Range Rover Sport','suv',['petrol','hybrid'],['landrover/sport'],[]),
 ('land-rover/range-rover-evoque','Land Rover','Range Rover Evoque','suv',['petrol'],['land-rover/range-rover-evoque','range-rover/evoque'],[]),
 ('land-rover/velar','Land Rover','Range Rover Velar','suv',['petrol'],['land-rover/velar'],[]),
 ('land-rover/defender','Land Rover','Defender','suv',['petrol','hybrid'],['land-rover/defender'],[]),
 ('jaguar/f-pace','Jaguar','F-Pace','suv',['petrol'],['jaguar/f-pace'],[]),
 ('nissan/n7','Nissan','N7','sedan',['ev'],['nissan/n7'],[]),
 ('nissan/armada','Nissan','Armada','suv',['petrol'],['nissan/armada'],[]),
 ('byd/dolphin-surf','BYD','Dolphin Surf','hatchback',['ev'],['byd/dolphin-surf','byd/dolphin'],[]),
 ('byd/atto-2','BYD','Atto 2','suv',['ev'],['byd/atto2'],[]),
 ('byd/seal','BYD','Seal','sedan',['ev'],['byd/seal'],[]),
 ('byd/leopard-8','BYD','Leopard 8','suv',['phev'],['byd/leopard-8'],[]),
 ('bmw/x4','BMW','X4','suv',['petrol'],['bmw/x4'],[]),
 ('bmw/i5','BMW','i5','sedan',['ev'],['bmw/i5'],[]),
 ('bmw/7-series','BMW','7 Series','sedan',['petrol'],['bmw/7-series'],[]),
 ('bmw/1-series','BMW','1 Series','hatchback',['petrol'],['bmw/1-series','bmw/118'],[]),
 ('bmw/2-series-gran-coupe','BMW','2 Series Gran Coupe','sedan',['petrol'],['bmw/218i'],[]),
 ('bmw/4-series','BMW','4 Series','coupe',['petrol'],['bmw/420','bmw/420i-gran-coupe','bmw/420i-convertible','bmw/440i-coupe'],[]),
 ('bmw/i4','BMW','i4','sedan',['ev'],['bmw/i4','bmw/bmwi4'],[]),
 ('bmw/i3-sedan','BMW','i3 (sedan)','sedan',['ev'],['bmw/i3sedan'],[]),
 ('bmw/ix3-neue-klasse','BMW','iX3 (Neue Klasse)','suv',['ev'],['bmw/ix3-neue-klasse'],[]),
 ('bmw/x7','BMW','X7','suv',['petrol'],['bmw/x7'],[]),
 ('bmw/m3','BMW','M3','sedan',['petrol'],['bmw/m3'],[]),('bmw/m4','BMW','M4','coupe',['petrol'],['bmw/m4'],[]),
 ('bmw/m5','BMW','M5','sedan',['hybrid'],['bmw/m5'],[]),('bmw/m8','BMW','M8 Gran Coupe','sedan',['petrol'],['bmw/m8'],[]),
 ('bmw/z4','BMW','Z4','convertible',['petrol'],['bmw/z4'],[]),
 ('mercedes/s-class','Mercedes-Benz','S-Class','sedan',['petrol'],['mercedes/s-class'],[]),
 ('mercedes/maybach-s-580','Mercedes-Benz','Maybach S-Class','sedan',['petrol'],['mercedes/maybach-s-580','mercedesbenz/maybach'],[]),
 ('mercedes/maybach-eqs-680','Mercedes-Benz','Maybach EQS 680 SUV','suv',['ev'],['mercedesbenz/eqsplus680'],[]),
 ('mercedes/eqs','Mercedes-Benz','EQS','sedan',['ev'],['mercedesbenz/eqs'],[]),
 ('mercedes/eqe','Mercedes-Benz','EQE','sedan',['ev'],['mercedesbenz/mercedesbenzeqe350'],['Mercedes|EQE']),
 ('mercedes/eqe-suv','Mercedes-Benz','EQE SUV','suv',['ev'],['mercedes/eqe-suv'],[]),
 ('mercedes/cle','Mercedes-Benz','CLE','coupe',['petrol'],['mercedes/cle-200','mercedesbenz/mercedesbenzcle200'],['Mercedes|CLE']),
 ('mercedes/sl','Mercedes-Benz','SL','convertible',['petrol'],['mercedes/sl55-amg','mercedesbenz/slclass'],[]),
 ('mercedes/amg-gt','Mercedes-Benz','AMG GT','coupe',['petrol'],['mercedes/amg-gt'],['Mercedes|GT']),
 ('mercedes/g-class','Mercedes-Benz','G-Class','suv',['petrol'],['mercedes/g-500','mercedes/g-63','mercedesbenz/mercedesbenzg63'],['Mercedes|G-Class','Mercedes|AMG G63']),
 ('mercedes/g-580-eq','Mercedes-Benz','G 580 with EQ Technology','suv',['ev'],['mercedes/g580-with-eq-technology'],[]),
 ('mercedes/v-class','Mercedes-Benz','V-Class','mpv',['petrol'],['mercedes/v-class'],[]),
 ('porsche/911','Porsche','911','coupe',['petrol'],['porsche/911','porsche/911-carrera','porsche/911-gt3','porsche/911-turbo'],[]),
 ('porsche/718','Porsche','718','coupe',['petrol'],['porsche/718'],[]),
 ('porsche/taycan','Porsche','Taycan','sedan',['ev'],['porsche/taycan'],[]),
 ('porsche/panamera','Porsche','Panamera','sedan',['petrol','hybrid'],['porsche/panamera'],[]),
 ('porsche/macan-electric','Porsche','Macan Electric','suv',['ev'],['porsche/macan-electric'],[]),
 ('rolls-royce/cullinan','Rolls-Royce','Cullinan','suv',['petrol'],['rolls-royce/cullinan'],[]),
 ('rolls-royce/spectre','Rolls-Royce','Spectre','coupe',['ev'],['rolls-royce/spectre'],[]),
 ('maserati/grecale','Maserati','Grecale','suv',['petrol'],['maserati/grecale'],[]),
 ('maserati/ghibli','Maserati','Ghibli','sedan',['petrol'],['maserati/ghibli'],[]),
 ('lotus/emeya','Lotus','Emeya','sedan',['ev'],['lotus/emeya'],[]),
 ('smart/1','Smart','#1','suv',['ev'],['smart/1','smart/hashtag-1','smart/smart1'],[]),
 ('smart/3','Smart','#3','suv',['ev'],['smart/3','smart/hashtag-3','smart/smart3'],[]),
 ('smart/5','Smart','#5','suv',['ev'],['smart/5','smart/hashtag5'],[]),
 ('im/ls9','IM','LS9','suv',['reev'],['im/ls9'],[]),
 ('vgv/u70-pro','VGV','U70 Pro','suv',['petrol'],['vgv/u70-pro'],[]),
 ('bestune/t77-pro','Bestune','T77 Pro','suv',['petrol'],['bestune/t77-pro','bestune/t77'],[]),
 ('mhero/1','M-Hero','917','suv',['reev'],['mhero/1','mhero/1917'],[]),
 ('arcfox/kaola-s','Arcfox','Kaola S','mpv',['ev'],['arcfox/kaola-s','arcfox/koala-s'],['Arcfox|Kaola']),
 ('audi/rs-e-tron-gt','Audi','RS e-tron GT','sedan',['ev'],['audi/rs-e-tron-gt','audi/rs-e-tron'],[]),
 ('avatr/06','Avatr','06','sedan',['ev','reev'],['avatr/06'],[]),
 ('baic/beijing-x7','BAIC','Beijing X7','suv',['petrol'],['baic/beijingx7'],[]),
 ('cadillac/lyriq','Cadillac','Lyriq','suv',['ev'],['cadillac/lyriq','cadillac/cadillaclyriq'],[]),
 ('cadillac/optiq','Cadillac','Optiq','suv',['ev'],['cadillac/optiq'],[]),
 ('cadillac/escalade-iq','Cadillac','Escalade IQL','suv',['ev'],['cadillac/escalade-iql'],[]),
 ('chery/tiggo-7-pro-max','Chery','Tiggo 7 Pro Max','suv',['petrol'],['chery/tiggo-7-pro-max'],[]),
 ('chevrolet/spark-euv','Chevrolet','Spark EUV','suv',['ev'],['chevrolet/spark-euv','chevrolet/spark-ev'],['Chevrolet|Spark']),
 ('citroen/c5-aircross','Citroën','C5 Aircross','suv',['petrol'],['citroen/c5-aircross'],[]),
 ('dongfeng/huge','Dongfeng','Aeolus Huge','suv',['hybrid'],['dongfeng/huge-hybrid'],['Dongfeng|Huge']),
 ('dongfeng/shine','Dongfeng','Aeolus Shine','sedan',['petrol'],['dongfeng/shine','dfm/shine'],[]),
 ('dongfeng/l7','Dongfeng','Aeolus L7','suv',['phev'],['dongfeng/l7'],[]),
 ('fiat/e-ulysse','Fiat','E-Ulysse','mpv',['ev'],['fiat/e-ulysee'],[]),
 ('forthing/friday','Forthing','Friday','suv',['ev'],['forthing/t5-friday'],[]),
 ('gac/aion-y','GAC','Aion Y Plus','suv',['ev'],['gac/aion-y'],['GAC|AION Y PLUS']),
 ('gac/aion-lx','GAC','Aion LX','suv',['ev'],['gac/aion-lx','gac/gacaionlx'],[]),
 ('gac/gs3-emzoom','GAC','GS3 Emzoom','suv',['petrol'],['gac/gs3plusplusemzoom'],[]),
 ('geely/emgrand','Geely','Emgrand','sedan',['petrol'],['geely/emgrand','geely/gellyemgrand'],[]),
 ('geely/ex5-em-i','Geely','EX5 EM-i','suv',['phev'],['geely/ex5-em-i'],[]),
 ('genesis/electrified-g80','Genesis','Electrified G80','sedan',['ev'],['genesis/electrified-g80'],[]),
 ('haval/h6-hev','Haval','H6 HEV','suv',['hybrid'],['haval/h6-hev'],[]),
 ('haval/jolion-pro','Haval','Jolion Pro','suv',['petrol'],['haval/jolion-pro'],[]),
 ('haval/v7','Haval','V7','suv',['petrol'],['haval/v7'],[]),
 ('hongqi/eh7','Hongqi','EH7','sedan',['ev'],['hongqi/eh7'],[]),
 ('hongqi/ehs7','Hongqi','EHS7','suv',['ev'],['hongqi/ehs7'],[]),
 ('gmc/hummer-ev','GMC','Hummer EV SUV','suv',['ev'],['hummer/hummer-ev-suv'],['GMC|Hummer']),
 ('hyundai/staria','Hyundai','Staria','mpv',['petrol'],['hyundai/staria'],[]),
 ('hyundai/venue','Hyundai','Venue','suv',['petrol'],['hyundai/venue'],[]),
 ('hyundai/i30','Hyundai','i30','hatchback',['petrol'],['hyundai/i30fb2','hyundai/i30hb','hyundai/i30stationwagon'],[]),
 ('icaur/v27','iCAUR','V27','suv',['reev'],['icaur/v27'],[]),
 ('jac/js2','JAC','JS2','suv',['petrol'],['jac/js2'],[]),
 ('jac/js4','JAC','JS4','suv',['petrol'],['jac/js4'],['JAC|J4']),
 ('jeep/grand-cherokee-l','Jeep','Grand Cherokee L','suv',['petrol'],['jeep/grand-cherokee-l'],[]),
 ('kaiyi/x3-pro','Kaiyi','X3 Pro','suv',['petrol'],['kaiyi/x3-pro','kaiyi/kaiyix3pro'],[]),
 ('kia/k3','Kia','K3 (Cerato)','sedan',['petrol'],['kia/k3'],['Kia|Cerato']),
 ('lynk-co/02','Lynk & Co','02','suv',['ev'],['lynkco/lynko02'],['Lynk & Co|2']),
 ('lynk-co/03','Lynk & Co','03','sedan',['petrol'],['lynk-co/03'],['Lynk & Co|3']),
 ('mg/4','MG','4 EV','hatchback',['ev'],['mg/4'],['MG|MG4 EV']),
 ('mg/cyberster','MG','Cyberster','convertible',['ev'],['mg/cyberster'],[]),
 ('mini/cooper','MINI','Cooper','hatchback',['petrol','ev'],['mini/cooper'],[]),
 ('mitsubishi/outlander-sport','Mitsubishi','Outlander Sport','suv',['petrol'],['mitsubishi/outlander-sport'],[]),
 ('rehigh/rh6','Rehigh','RH6','suv',['ev'],['rehigh/rh6'],['Dayun|Rehigh RH6']),
 ('rehigh/rh8','Rehigh','RH8','suv',['ev'],['rehigh/rh8'],['Dayun|Rehigh RH8']),
 ('rely/r8','Rely','R8','suv',['phev'],['rely/r8'],[]),
 ('subaru/crosstrek','Subaru','Crosstrek','suv',['petrol'],['subaru/xv-crosstrek'],['Subaru|Crosstrek']),
 ('volkswagen/touareg','Volkswagen','Touareg','suv',['petrol'],['volkswagen/touareg'],['Volkswagen|Tourag']),
 ('volkswagen/id-era-9x','Volkswagen','ID. ERA 9X','suv',['reev'],['volkswagen/id-era-9x'],[]),
 ('xpeng/gx','XPeng','GX','suv',['ev'],['xpeng/gx'],[]),
 ('xpeng/mona-m03','XPeng','Mona M03','sedan',['ev'],['xpeng/mona-l03','xpeng/monamo3'],[]),
 ('xpeng/p7-plus','XPeng','Next P7','sedan',['ev'],['xpeng/nextp7'],[]),
 ('zeekr/001','Zeekr','001','sedan',['ev'],['zeekr/001'],['Zeekr|1']),
 ('zeekr/007','Zeekr','007','sedan',['ev'],['zeekr/007'],[]),
 ('zeekr/7x','Zeekr','7X','suv',['ev'],['zeekr/7x','zeekr/zeekr7x'],['Zeekr|7']),
 ('ford/mustang','Ford','Mustang','coupe',['petrol'],['ford/mustang'],[]),
 ('dodge/charger','Dodge','Charger','coupe',['ev','petrol'],['dodge/charger'],[]),
 ('changan/cs35','Changan','CS35','suv',['petrol'],['changan/cs35'],['Changan|CS35']),
 ('toyota/camry','Toyota','Camry','sedan',['hybrid'],['toyota/camry'],[]),
 ('toyota/rav4','Toyota','RAV4','suv',['hybrid','petrol'],['toyota/rav4'],[]),
 ('toyota/land-cruiser-prado','Toyota','Land Cruiser Prado','suv',['petrol'],['toyota/landcruiserprado'],['Toyota|Prado']),
 ('toyota/corolla-hybrid','Toyota','Corolla Hybrid','sedan',['hybrid'],['toyota/corollahybrid'],[]),
]
OUT=['chevrolet/dababbah','chevrolet/jumbo','chevrolet/jumbo-npr','chevrolet/n300','chevrolet/nkr','chevrolet/nqr','chevrolet/s10-max','chevrolet/tfr','isuzu/dmax','isuzu/npr','isuzu/rbc',
     'toyota/hiace','toyota/hilux','toyota/tamaraw','nissan/navara','gmc/sierra','sandstorm/s24','tesla/cybertruck','byd/shark-6-dmo','jmc/boarding','kyc/v3','shineray/x30',
     'suzuki/supercarry','suzuki/van','golf-car/club-car','riddara/rd6']
ALIAS_283={'mercedesbenz/mercedesbenzc43':'mercedes/c-class','mercedesbenz/cla250e':'mercedes/cla','mercedesbenz/mercedesbenzgla200':'mercedes/gla',
 'mercedesbenz/mercedesbenzglc43':'mercedes/glc','mini/coopercountryman':'mini/countryman','porsche/cayennes':'porsche/cayenne','citroen/c4-facelift':'citroen/c4',
 'mg/mgplusone':'mg/one','vgv/u70pro-plus':'vgv/u70p-plus','changan/eado2':'changan/eado','jetour/jetourx70fl':'jetour/x70','jetour/x90plus16t':'jetour/x90-plus',
 'nissan/newpatrol':'nissan/patrol','renault/australxhnorderopening':'renault/austral','renault/dusterp1311':'renault/duster','renault/taliantljf':'renault/taliant',
 'hyundai/ioniq5n':'hyundai/ioniq-5','chery/arrizo5shapefacelift':'chery/arrizo-5','nissan/jukeshapefacelift':'nissan/juke','nissan/qashqaishapefacelift':'nissan/qashqai',
 'renault/australshapefacelift':'renault/austral','morisgarage/mghsshapenewgeneration':'mg/hs','morisgarage/zsshapefacelift':'mg/zs','baic/baicx3':'baic/x3','bmw/520':'bmw/5-series','nissan/patrolmy20':'nissan/patrol'}
c=json.load(open('config/market_universe.json'))
U283={m['id'] for m in json.load(open('inputs/u11/p11_universe.json'))['models'] if m['in_universe']}
ids=[d for d in c['identities'] if d['decision']=='SPLIT']
for i,b,m,body,pt,keys,regs in ADD:
  keys=[k for k in keys if k in A]
  if any(A[k]['audit_class']=='IN_283' for k in keys) or i in U283:
    ids.append(dict(id=i,decision='SOURCE_ALIAS',brand=b,model=m,audit_keys=[k for k in keys if k!=i],urls=urls(keys),evidence=ev(keys),
      note='Existing 283 identity; additional official/market source pages now owned by it.'))
    print('existing 283 id -> SOURCE_ALIAS:',i);continue
  e=ev(keys)
  assert e, i
  ids.append(dict(id=i,decision='ADDITION',brand=b,model=m,body=body,powertrains=pt,u11_id=i if A.get(i,{}).get('u11_id')==i else (next((A[k]['u11_id'] for k in keys if A.get(k,{}).get('u11_id')),'')),
    urls=urls(keys),match=sorted(set(regs)|{n.strip() for k in keys for n in (A.get(k,{}).get('reg_names') or '').split(';') if n.strip()}),evidence=e,
    audit_keys=keys,note='Omission: on sale in Egypt (official page and/or current priced market pages) but outside the P1 U11 283.'))
for k in OUT:
  if k in A: ids.append(dict(id=k,decision='OUT_OF_SCOPE',brand=A[k]['brand'],model=A[k]['model'],evidence=ev([k]),audit_keys=[k],note='Commercial vehicle (pickup, truck, cargo van, microbus or golf cart): outside the passenger-car universe.',urls=[]))
for k,t in ALIAS_283.items():
  if k in A: ids.append(dict(id=t,decision='SOURCE_ALIAS',brand=A[k]['brand'],model=A[k]['model'],alias_of_audit_key=k,audit_keys=[k],urls=urls([k]),evidence=ev([k]),note='Same model as an existing 283 identity; unmapped source page now owned by it.'))
for k,n in [('chery/qq','Listed at EGP 2,180,000 (2027) on one site; price inconsistent with the Chery QQ; identity unverified'),
            ('renault/hjfsomaca','Renault Egypt page code hjf-ph1-somaca: model name not stated in the slug; identity unverified')]:
  if k in A: ids.append(dict(id=k,decision='REVIEW',brand=A[k]['brand'],model=A[k]['model'],audit_keys=[k],urls=[],evidence=ev([k]),note=n))
for k,t,u in [('mercedesbenz/mercedesbenzgla200','mercedes/gla','https://eg.hatla2ee.com/en/new-car/mercedes/mercedes-benz-gla-200'),
              ('mercedesbenz/mercedesbenzglc43','mercedes/glc','https://eg.hatla2ee.com/en/new-car/mercedes/mercedes-benz-glc-43')]:
  ids.append(dict(id=t,decision='SOURCE_ALIAS',brand='Mercedes-Benz',model=t.split('/')[1].upper(),alias_of_audit_key=k,audit_keys=[k],urls=[u],
    evidence=['Hatla2ee engine-variant page of an existing 283 family (P1 families.csv)'],note='Same model as an existing 283 identity; unmapped source page now owned by it.'))
REG_ALIAS={'arcfox/as5':'arcfox/alpha-s5','arcfox/t5':'arcfox/alpha-t5','bmw/2series':'bmw/2-series-gran-coupe','bmw/4series':'bmw/4-series',
 'porsche/carrera':'porsche/911','porsche/boxter':'porsche/718','porsche/cayman':'porsche/718','mini/s':'mini/cooper','mini/coper':'mini/cooper',
 'toyota/landrcruiser':'toyota/land-cruiser','mercedesbenz/eclasse':'mercedes/e-class'}
for k,t in REG_ALIAS.items():
  if k in A: ids.append(dict(id=t,decision='SOURCE_ALIAS',brand=A[k]['brand'],model=A[k]['model'],alias_of_audit_key=k,audit_keys=[k],urls=[],evidence=ev([k]),
    note='Registration spelling of an existing identity.'))
if 'venucia/v' in A:
  ids.append(dict(id='venucia/v-online',decision='ADDITION',brand='Venucia',model='V-Online',body='suv',powertrains=['hybrid'],u11_id='',audit_keys=['venucia/v','venucia/vonline'],urls=[],
    match=['Venucia|V','Venucia|vonline'],
    evidence=ev(['venucia/v','venucia/vonline'])+['Distributor launch news: NDS Group (Venucia Egypt distributor) launched V-Online, single trim, official price EGP 1,350,000 (Shift-EG https://www.shift-eg.com/news/local-news/details/26647/ ; publication date not captured) -> price NOT accepted (no dated Egyptian listing)',
      'ContactCars article: NDS (Nour El-Din El-Sherif) named Venucia distributor https://www.contactcars.com/ar/media/articles/0a812810b974'],
    note='Omission named by CEO: registered and launched by an Egyptian distributor; no market/official listing captured yet (source gap).'))
for k in ['denza/b3','denza/b5','denza/b8']:  # CEO statement 2026-10-14: Denza not launched in Egypt yet
  if k in A: ids.append(dict(id=k,decision='NOT_ON_SALE',brand='Denza',model=A[k]['model'],audit_keys=[k],urls=[],evidence=ev([k])+['CEO statement 2026-10-14: Denza is not launched in Egypt yet'],
    note='NOT_LAUNCHED: registrations are pre-launch/parallel imports; no Egyptian distributor sale.'))
c['identities']=ids
json.dump(c,open('config/market_universe.json','w'),indent=1,ensure_ascii=False)
import collections;print(collections.Counter(d['decision'] for d in ids))
