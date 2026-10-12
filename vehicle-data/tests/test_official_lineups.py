import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("lineups",Path(__file__).parents[1]/"scripts/official_lineups.py")
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
class DiscoveryTests(unittest.TestCase):
 def test_exact_alias_and_unmapped_candidates(self):
  s={"kind":"nissan","url":"https://en.nissan.com.eg/vehicles/new.html","brand":"Nissan","aliases":{"sunny":"nissan/sunny"}}
  out=M.extract(s,'<a href="/vehicles/new/sunny.html">Sunny</a><a href="/vehicles/new/new-model.html">New</a><a href="https://fake.example/vehicles/new/sunny.html">Fake</a>')
  self.assertEqual(len(out),2)
  self.assertEqual(next(m for m in out if m["source_key"]=="sunny")["p1_id"],"nissan/sunny")
  self.assertIsNone(next(m for m in out if m["source_key"]=="new-model")["p1_id"])
 def test_failure_or_empty_cannot_delist(self):
  prev={"sources":[{"url":"x","status":"OK","sha256":"a","models":[{"source_key":"one"}]}]}
  for status in ["ERROR","EMPTY_EXTRACTION"]:
   events=M.changes({"sources":[{"url":"x","status":status,"models":[]}]},prev)
   self.assertEqual([e["event"] for e in events],["SOURCE_HEALTH"])
 def test_new_missing_and_change_are_review_only(self):
  prev={"sources":[{"url":"x","status":"OK","sha256":"a","models":[{"source_key":"old"}]}]}
  now={"sources":[{"url":"x","status":"OK","sha256":"b","models":[{"source_key":"new"}]}]}
  self.assertEqual({e["event"] for e in M.changes(now,prev)},{"NEW_OFFICIAL_LINEUP_ENTRY","OFFICIAL_LINEUP_ENTRY_MISSING_REVIEW","OFFICIAL_PAGE_CHANGED"})
 def test_off_sale_conflict_is_staged(self):
  q=M.enrichment_queue([{"source_key":"1","p1_id":"smart/1"}],set(),{"models":[{"id":"smart/1","u":False}]})
  self.assertEqual(q[0]["queue_state"],"OFFICIAL_U11_AVAILABILITY_CONFLICT")
  self.assertEqual(q[0]["authority"],"STAGE_ONLY")
 def test_first_observation_is_baseline_not_new_launch(self):
  ev=M.changes({"sources":[{"url":"x","status":"OK","sha256":"a","models":[{"source_key":"one"}]}]}, {})
  self.assertEqual(ev[0]["event"],"OFFICIAL_BASELINE_ENTRY")
if __name__=="__main__": unittest.main()
