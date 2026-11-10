"""AT-51-C12 (staging 511136ca): Optra MY2026 LS/LT torque from Chevrolet Egypt brochure p.7, scoped to MY2026."""
import json, pathlib, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
SHA = "e5f77f5fe2cc131517fce3ba7186e6c434824853d5289a6e8aba82a94be30837"


class OptraMY2026Torque(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rel = json.loads((ROOT / "views/catalogue-serving.release.json").read_text())
        cls.e = next(e for e in rel["entries"] if e["p2_model_id"] == "m_000093")

    def test_two_trim_rows_my2026(self):
        t = self.e["accepted"]["specs"]["torque_nm"]
        self.assertEqual(sorted(x["applicability"] for x in t), ["MY2026 LS (3400-4400 rpm)", "MY2026 LT (3400-4400 rpm)"])
        for x in t:
            self.assertEqual((x["value"], x["unit"], x["issuer"]), ("140", "Nm", "Chevrolet Egypt"))
            self.assertTrue(x["source"].endswith(f"#page=7&sha256={SHA}"))

    def test_my2027_prices_not_inherited(self):
        p = self.e["accepted"]["price"]
        self.assertEqual(p["model_year"], 2027)
        self.assertEqual({(t["model_year"], t["label"], t["price_egp"]) for t in p["trims"]}, {(2027, "LS", 784900), (2027, "LT", 809900)})
        self.assertFalse(any("torque" in json.dumps(t) for t in p["trims"]))
