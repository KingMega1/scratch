import collections, csv, json, pathlib, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
def rows(p): return list(csv.DictReader((ROOT / p).open(newline="", encoding="utf-8")))


class Intake20261104(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.led = rows("review/ceo_confirmed_prices_20261104.csv")
        cls.acc = rows("registry/ceo_confirmed_accepted_20261104.csv")
        rel = json.loads((ROOT / "views/catalogue-serving.release.json").read_text())
        cls.by = {e.get("p1_id") or e.get("identity"): e for e in rel["entries"] + rel.get("market_additions", [])}
        cls.rel = rel

    def test_all_52_dispositioned(self):
        self.assertEqual(len(self.led), 52)
        self.assertEqual(collections.Counter(r["disposition"] for r in self.led), {"ACCEPT": 21, "UNCHANGED": 31})
        self.assertEqual({r["ledger_row_id"] for r in self.acc}, {r["row_id"] for r in self.led if r["disposition"] == "ACCEPT" and not r["p1_id"].startswith("geely/")})

    def test_unchanged_equal_accepted(self):
        for r in self.led:
            if r["disposition"] == "UNCHANGED":
                self.assertEqual(r["price_egp"], r["accepted_egp"], r["row_id"])

    def test_served_values(self):
        p = lambda k: self.by[k]["accepted"]["price"]
        self.assertEqual((p("nissan/sunny")["price_from"], p("nissan/x-trail")["price_from"]), (820000, 2500000))
        self.assertEqual({t["label"]: t["price_egp"] for t in p("jetour/t2")["trims"]}, {"Luxury": 1900000, "Matte Color": 1930000})  # Kasrawy-branded original supersedes the repost's 1,970,000
        self.assertEqual({t["label"]: t["price_egp"] for t in p("jetour/t1")["trims"]}, {"Luxury": 1730000, "Matte Color": 1760000})  # matte total kept separate
        # CEO 2026-11-05: Auto Mobility CKD and Abou Ghaly lists complement each other (both served, neither superseded)
        for k, n in (("geely/emgrand", 4), ("geely/cool-ray", 6)):
            iss = {t["issuer"].split(" (")[0] for t in p(k)["trims"]}
            self.assertEqual((len(p(k)["trims"]), iss), (n, {"Abou Ghaly Motors", "Auto Mobility"}))
        self.assertEqual(p("geely/emgrand")["price_from"], 839000)
        self.assertIsNone(p("volkswagen/passat"))
        self.assertEqual((p("peugeot/2008")["price_from"], p("peugeot/2008")["model_year"]), (1499990, 2027))
        self.assertEqual(self.rel["release_id"], "P2-CEO-CONFIRMED-20261102-R1")
        for k in ("nissan/sunny", "nissan/magnite", "nissan/juke", "nissan/qashqai", "nissan/x-trail"):
            self.assertFalse(p(k).get("effective_date"))  # month-only list: no effective day inferred

    def test_later_intake_keeps_distinct_trims(self):
        mag = {t["label"] for t in self.by["nissan/magnite"]["accepted"]["price"]["trims"]}
        self.assertEqual(mag, {"Visia", "Accenta", "Tekna", "Tekna +"})
        keys = collections.Counter((r["p1_id"], r["model_year"], r["trim_key"]) for r in self.acc)
        self.assertEqual(max(keys.values()), 1)

    def test_no_unpriced_or_delta_rows(self):
        self.assertTrue(all(int(r["price_egp"]) > 0 for r in self.led))
        self.assertFalse([r for r in self.led if r["p1_id"].startswith(("jac/", "chevrolet/")) or "starray" in r["p1_id"]])


if __name__ == "__main__":
    unittest.main()
