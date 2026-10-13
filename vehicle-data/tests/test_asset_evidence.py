import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("assets",Path(__file__).parents[1]/"scripts/asset_evidence.py")
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
class Tests(unittest.TestCase):
 def test_evidence_does_not_become_accepted(self):
  rows=M.candidates({"url":"https://official.example/car","universe_id":"brand/model"},b'<img src="/car.jpg" alt="Different model"><a href="/brochure.pdf">Brochure</a>')
  self.assertEqual(len(rows),2)
  self.assertTrue(all(r["qa_state"]=="EXACT_MODEL_MARKET_VERSION_REVIEW_REQUIRED" for r in rows))
 def test_relative_links_duplicate_urls_and_non_https(self):
  rows=M.candidates({"url":"https://official.example/car"},b'<img src="/car.jpg"><img data-src="/car.jpg"><img src="http://bad.example/car.jpg"><a href="/asset.txt">Other</a>')
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]["url"],"https://official.example/car.jpg")
if __name__=="__main__":unittest.main()
