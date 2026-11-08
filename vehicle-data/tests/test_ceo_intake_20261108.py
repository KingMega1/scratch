import collections, csv, json, pathlib, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
def rows(p): return list(csv.DictReader((ROOT / p).open(newline="", encoding="utf-8")))


class Intake20261108(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.led = rows("review/ceo_confirmed_prices_20261108.csv")
        cls.acc = rows("registry/ceo_confirmed_accepted_20261108.csv")
        rel = json.loads((ROOT / "views/catalogue-serving.release.json").read_text())
        cls.by = {e.get("p1_id") or e.get("identity"): e for e in rel["entries"] + rel.get("market_additions", [])}
        cls.rel = rel

    def p(self, k): return self.by[k]["accepted"]["price"]

    def test_113_dispositioned(self):
        core = [r for r in self.led if r["kind"] == "retail"]
        self.assertEqual(len(core), 113)
        self.assertEqual(collections.Counter(r["disposition"] for r in core), {"ACCEPT": 59, "UNCHANGED": 54})
        self.assertTrue({r["ledger_row_id"] for r in self.acc} >= {r["row_id"] for r in core if r["disposition"] == "ACCEPT"})
        self.assertFalse({r["ledger_row_id"] for r in self.acc} & {r["row_id"] for r in core if r["disposition"] == "HOLD"})

    def test_promotions_and_corroborations_out_of_msrp(self):
        kinds = collections.Counter(r["kind"] for r in self.led)
        self.assertEqual((kinds["promotion"], kinds["corroboration"]), (4, 3))
        self.assertFalse([r for r in self.acc if r["p1_id"] in ("chery/tiggo-8-pro", "geely/cool-ray")])

    def test_ceo_decisions_20261108(self):
        self.assertEqual(self.p("chery/tiggo-7-pro")["price_from"], 1125000)   # watermarked Chery sheet accepted
        self.assertEqual(self.p("changan/cs75-plus")["price_from"], 1550000)   # Changan dated 3 Nov per CEO
        self.assertEqual({t["label"] for t in self.p("lexus/rx")["trims"]}, {"RX350 AWD F-Sport", "RX350h AWD - Hybrid"})
        self.assertEqual(len(self.p("lexus/lx600")["trims"]), 4)  # LX model: LX600 x2 + LX700h hybrid x2
        old = {r["price_id"]: r["price_egp"] for r in csv.DictReader(__import__("io").StringIO(__import__("subprocess").check_output(
            ["git", "show", "bdc00e4:vehicle-data/registry/ceo_confirmed_accepted_20261108.csv"], cwd=ROOT, text=True)))}
        now = {r["price_id"]: r["price_egp"] for r in self.acc}
        self.assertEqual({k: now[k] for k in old}, old)  # published ids stable

    def test_accepted_values_served(self):
        self.assertEqual((self.p("toyota/corolla")["price_from"], self.p("toyota/corolla")["model_year"]), (1280000, 2027))
        self.assertEqual(self.p("hyundai/tucson")["price_from"], 1850000)
        self.assertEqual(self.p("haval/v7")["price_from"], 1915000)
        self.assertEqual(self.rel["release_id"], "P2-CEO-CONFIRMED-20261102-R1")

    def test_prior_decisions_preserved(self):
        self.assertIsNone(self.p("volkswagen/passat"))
        self.assertEqual((self.p("peugeot/2008")["price_from"], self.p("peugeot/2008")["model_year"]), (1499990, 2027))
        self.assertEqual({t["label"]: t["price_egp"] for t in self.p("jetour/t2")["trims"]}["Matte Color"], 1930000)

    def test_registration_charts_context_only(self):
        rc = rows("review/registration_charts_202610.csv")
        self.assertEqual(len({r["chart"] for r in rc}), 5)
        self.assertTrue(all(r["canonical_use"].startswith("CONTEXT_ONLY") for r in rc))
        self.assertFalse([r for r in rc if "bmw" in r["entity_printed"].lower()])
        import subprocess  # canonical registration counts unchanged since the frozen 956a9a7 input
        old = subprocess.check_output(["git", "show", "956a9a7:vehicle-data/inputs/registration_models.csv"], cwd=ROOT)
        self.assertEqual(old, (ROOT / "inputs/registration_models.csv").read_bytes())


if __name__ == "__main__":
    unittest.main()
