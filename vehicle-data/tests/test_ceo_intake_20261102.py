import csv,hashlib,json,pathlib,subprocess,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='01f976ed5eadd6a8fdc9a649c8adc8f0145fc01b'
def rows(p):return list(csv.DictReader((ROOT/p).open()))
def obj(p):return json.loads((ROOT/p).read_text())
class ConfirmedIntake(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.c=obj('views/canonical_u11.json');cls.by={m['p1_id']:m for m in cls.c['models']}
  cls.old=json.loads(subprocess.check_output(['git','show',BASE+':vehicle-data/views/canonical_u11.json'],cwd=ROOT))
  cls.ledger=rows('review/ceo_confirmed_prices_20261102.csv');cls.p=[r for r in rows('registry/u11_prices.csv') if r.get('ledger_row_id')]
 def test_all_rows_accounted(self):
  options=rows('registry/price_options_20261102.csv')
  self.assertEqual(len(self.p),89);self.assertEqual(len(options),7)
  self.assertEqual({r['ledger_row_id'] for r in self.p+options},{r['row_id'] for r in self.ledger})
 def test_confirmed_values_unchanged(self):
  ledger={r['row_id']:r for r in self.ledger}
  for r in self.p+rows('registry/price_options_20261102.csv'):
   self.assertEqual(r['price_egp'],ledger[r['ledger_row_id']]['price_egp'])
   self.assertEqual(r['source_sha256'],ledger[r['ledger_row_id']]['source_sha256'])
 def test_unrelated_fields_preserved(self):
  affected={r['p1_id'] for r in self.ledger}
  for old in self.old['models']:
   now=self.by[old['p1_id']]
   for k,v in old.items():
    if k not in ('price','gaps'):self.assertEqual(now[k],v,(old['p1_id'],k))
   if old['p1_id'] not in affected:self.assertEqual(now,old)
 def test_u11_not_expanded(self):
  self.assertEqual({m['p1_id'] for m in self.c['models'] if m['universe']=='U11_283'},{m['p1_id'] for m in self.old['models'] if m['universe']=='U11_283'})
  self.assertEqual(self.c['counts']['models'],283)
 def test_identities_unique(self):
  rr=rows('registry/u11_models.csv')
  for k in ['model_id','p1_id','site_slug']:self.assertEqual(len({r[k] for r in rr}),len(rr))
  for k in ['jaecoo/j5','jaecoo/j7','jaecoo/j7-phev','jaecoo/j8-phev','jac/rf8-phev']:self.assertIn(k,self.by)
 def test_no_options_as_retail(self):
  ids={r['option_id'] for r in rows('registry/price_options_20261102.csv')}
  for m in self.c['models']:
   for t in (m['price'] or {}).get('trims',[]):self.assertNotIn(t.get('price_id'),ids)
 def test_kia_baselines(self):
  rr=[r for r in self.p if r['p1_id'].startswith('kia/')];self.assertEqual(len(rr),21)
  for r in rr:self.assertEqual(int(r['baseline_egp'])+int(r['confirmed_delta_egp']),int(r['price_egp']))
 def test_null_year_and_dates(self):
  ledger={r['row_id']:r for r in self.ledger}
  for r in self.p:
   self.assertEqual(r['model_year'],ledger[r['ledger_row_id']]['model_year'])
   if not ledger[r['ledger_row_id']]['effective_date']:self.assertFalse(r['effective_date'])
   if r['date_basis']=='SOURCE_PRINTED_DATE':self.assertFalse(r['effective_date']);self.assertTrue(r['printed_date'])
 def test_media_provenance_not_relabelled(self):
  for r in self.p:
   if r['p1_id'].startswith(('jaecoo/','jac/','bmw/','deepal/','kia/')):self.assertEqual(r['tier'],'C');self.assertTrue(r['confirmation_authority'])
   else:self.assertEqual(r['source_type'],'Official Pricelist')
 def test_bmw_no_invented_trim(self):
  r=next(r for r in self.p if r['p1_id']=='bmw/7-series');self.assertEqual(r['kind'],'from');self.assertNotIn('740i',r['trim_label'])
  self.assertEqual(self.by['bmw/7-series']['price']['trims'],[])
 def test_brochures_and_cycles(self):
  rr=obj('review/brochure_acceptance_20261102.json');self.assertEqual(sum(r['spec_fact_count'] for r in rr),73)
  for r in rr:self.assertEqual(r['warranty'],'NOT_STATED');self.assertIsNone(r['model_year'])
  for key in ['jaecoo/j7-phev','jaecoo/j8-phev']:self.assertEqual(self.by[key]['specs']['range_cycle'][0]['value'],'UNSTATED')
 def test_serving_matches_canonical(self):
  rel=obj('views/catalogue-serving.release.json')
  for e in rel['entries']+rel['market_additions']:
   key=e.get('p1_id') or e['identity'];self.assertEqual(e['accepted']['price'],self.by[key]['price'])
 def test_rebuild_guard_before_writes(self):
  paths=['views/canonical_u11.json','registry/u11_prices.csv','registry/u11_models.csv']
  before={p:(ROOT/p).read_bytes() for p in paths}
  r=subprocess.run([sys.executable,str(ROOT/'scripts/canonical.py')],capture_output=True)
  self.assertNotEqual(r.returncode,0);self.assertIn(b'Full rebuild refused',r.stderr)
  self.assertEqual(before,{p:(ROOT/p).read_bytes() for p in paths})
 def test_release_hashes(self):
  m=obj('review/ceo_acceptance_20261102.json')
  for key,path in [('canonical_sha256','views/canonical_u11.json'),('release_sha256','views/catalogue-serving.release.json')]:self.assertEqual(m[key],hashlib.sha256((ROOT/path).read_bytes()).hexdigest())
if __name__=='__main__':unittest.main()
