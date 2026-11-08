"""AT-39 (P1 -> P2 request, 8 Nov 2026): version powertrains contradicted by their own labels."""
import csv, json, pathlib, re, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]


class VersionPowertrains(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rel = json.loads((ROOT / "views/catalogue-serving.release.json").read_text())
        cls.by = {e.get("p1_id") or e.get("identity"): e for e in rel["entries"] + rel["market_additions"]}
        cls.vp = list(csv.DictReader((ROOT / "registry/version_powertrains_20261108.csv").open(newline="", encoding="utf-8")))

    def t(self, k, label):
        return next(t for t in self.by[k]["accepted"]["price"]["trims"] if t["label"] == label)

    def model(self, k):
        e = self.by[k]
        return e["accepted"].get("powertrains") or e["powertrains"]

    def test_p1_table(self):
        self.assertEqual((self.t("haval/v7", "1.5T 2DHT HEV FWD Ultra")["powertrain"], self.t("haval/v7", "1.5T 2DHT HEV FWD Ultra")["plug_in"]), ("hybrid", False))
        self.assertEqual((self.t("haval/v7", "1.5T 4DHT PHEV Hi4 Ultra")["powertrain"], self.t("haval/v7", "1.5T 4DHT PHEV Hi4 Ultra")["plug_in"]), ("phev", True))
        self.assertEqual(self.model("haval/v7"), ["hybrid", "phev"])
        self.assertEqual(self.t("kia/carnival", "HEV 8-Seats Topline")["powertrain"], "hybrid")
        self.assertEqual(self.model("kia/carnival"), ["hybrid"])
        for l in ("LX700h AWD 7 Seats - Hybrid", "LX700h AWD 4 Seats - Hybrid"):
            self.assertEqual(self.t("lexus/lx600", l)["powertrain"], "hybrid")
        self.assertEqual(self.model("lexus/lx600"), ["petrol", "hybrid"])  # LX600 versions keep petrol
        self.assertIsNone(self.t("lexus/lx600", "LX600 AWD 7 Seats").get("powertrain"))

    def test_staria_held(self):
        self.assertEqual([r["status"] for r in self.vp if r["p1_id"] == "hyundai/staria"], ["HOLD"])
        self.assertIsNone(self.by["hyundai/staria"]["accepted"]["price"])

    def test_lower_priority(self):
        self.assertEqual(self.t("deepal/s-05", "SUV REEV")["powertrain"], "reev")
        self.assertEqual(self.t("deepal/s-05", "SUV BEV")["powertrain"], "ev")
        self.assertEqual(self.t("xpeng/p7-plus", "REEV-RWD Flagship Super REEV")["powertrain"], "reev")
        self.assertEqual(self.model("xpeng/gx"), ["reev"])
        self.assertTrue(self.t("byd/sealion-6", "DMi Ultra")["plug_in"])
        self.assertEqual(self.t("soueast/s-06", "DM Intelligent 1.5L Turbo PHEV")["powertrain"], "phev")
        self.assertEqual(self.t("soueast/s-06", "Highline 1.5L Turbo")["powertrain"], "petrol")
        self.assertIsNone(self.t("byd/ti-7", "DMi Ultra FWD").get("powertrain"))  # HOLD

    def test_every_accept_row_served_with_source(self):
        for r in (r for r in self.vp if r["status"] == "ACCEPT"):
            t = self.t(r["p1_id"], r["trim_label"])
            self.assertEqual((t["powertrain"], t["powertrain_source"]["sha256"]), (r["powertrain"], r["source_sha256"]), r)

    def test_no_label_contradiction_in_scope(self):
        fam = {"petrol": "petrol", "hybrid": "hyb", "phev": "hyb", "plug-in hybrid": "hyb", "reev": "reev", "ev": "ev", "bev": "ev", "electric": "ev"}
        tok = [(r"\bPHEV\b|\bDM-?i\b|\bDM\b", "hyb"), (r"\bHEV\b|hybrid", "hyb"), (r"REEV", "reev"), (r"\bBEV\b|\bEV\b", "ev")]
        for k, e in self.by.items():
            for t in ((e["accepted"].get("price") or {}).get("trims") or []):
                want = next((f for rx, f in tok if re.search(rx, t["label"], re.I)), None)
                got = fam.get(str(t.get("powertrain") or "").lower())
                if want and got:  # a stated powertrain may be missing (open gap), never contradicted
                    self.assertEqual(got, want, (k, t["label"], t.get("powertrain")))


if __name__ == "__main__":
    unittest.main()
