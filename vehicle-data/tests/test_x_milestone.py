"""Claude Cloud extraction lane: every milestone candidate must be backed by its quote at its locator."""
import copy, glob, json, os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import x_milestone  # noqa: E402

SPECS = sorted(glob.glob(os.path.join(ROOT, "snapshots", "X_M*_*", "facts.json")))


class XMilestone(unittest.TestCase):
    def test_all_quotes_verified(self):
        self.assertTrue(SPECS)
        for p in SPECS:
            n, errors, _ = x_milestone.check(json.load(open(p)))
            self.assertEqual(errors, [], p)
            self.assertGreater(n, 0)

    def test_altered_quote_is_rejected(self):
        spec = json.load(open(SPECS[0]))
        bad = copy.deepcopy(spec)
        bad["specs"][0]["quote"] += " 0000-not-in-source"
        n, errors, _ = x_milestone.check(bad)
        self.assertEqual(len(errors), 1)

    def test_wrong_page_is_rejected(self):
        spec = json.load(open(SPECS[0]))
        pdf_facts = [i for i, f in enumerate(spec["specs"]) if f["locator"].startswith("page ")]
        bad = copy.deepcopy(spec)
        i = pdf_facts[0]
        bad["specs"][i]["locator"] = "page 1"
        _, errors, _ = x_milestone.check(bad)
        self.assertTrue(errors)

    def test_every_milestone_model_has_status(self):
        import csv
        for p in SPECS:
            d = os.path.dirname(p)
            st = {r["p1_id"] for r in csv.DictReader(open(os.path.join(d, "model_status.csv")))}
            for fn in ("specs_candidates.csv", "warranty_candidates.csv", "brochure_candidates.csv"):
                ids = {r["p1_id"] for r in csv.DictReader(open(os.path.join(d, fn)))}
                self.assertLessEqual(ids, st, fn)


if __name__ == "__main__":
    unittest.main()
