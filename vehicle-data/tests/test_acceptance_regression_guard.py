"""Unit tests for the fail-closed accepted-evidence regression gate."""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / "scripts" / "acceptance_regression_guard.py"
spec = importlib.util.spec_from_file_location("acceptance_regression_guard", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    models = [dict(p1_id=f"model/{i}", model_id=f"m_{i:06d}", universe="U11_283",
                   price=None, specs=None, warranty=None, brochures=[], hero_image=None,
                   logo=None, gallery=[]) for i in range(283)]
    return dict(models=models)


class AcceptanceRegressionGuardTests(unittest.TestCase):
    def test_unchanged_passes(self):
        self.assertEqual(module.regressions(fixture(), fixture()), [])

    def test_additional_evidence_passes(self):
        old, new = fixture(), fixture()
        new["models"][0]["price"] = {"price_from": 100000}
        new["models"][0]["specs"] = {"length_mm": [{"value": "4400", "applicability": "all"}]}
        self.assertEqual(module.regressions(old, new), [])

    def test_source_failure_cannot_remove_spec(self):
        old, new = fixture(), fixture()
        old["models"][0]["specs"] = {"length_mm": [{"value": "4400", "applicability": "all"}]}
        self.assertIn("accepted spec length_mm", " ".join(module.regressions(old, new)))

    def test_spec_correction_requires_review(self):
        old, new = fixture(), fixture()
        old["models"][0]["specs"] = {"length_mm": [{"value": "4400", "applicability": "all"}]}
        new["models"][0]["specs"] = {"length_mm": [{"value": "4450", "applicability": "all"}]}
        self.assertIn("accepted spec length_mm", " ".join(module.regressions(old, new)))

    def test_price_and_media_disappearance_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0].update(price={"price_from": 100000}, hero_image={"src": "/media/a.webp"},
                                 brochures=[{"drive_id": "x"}], gallery=[{"src": "/media/g.webp"}])
        result = " ".join(module.regressions(old, new))
        for word in ("price", "hero_image", "brochures", "gallery"):
            self.assertIn(word, result)

    def test_identity_remap_blocked(self):
        old, new = fixture(), fixture()
        new["models"][0]["model_id"] = "m_999999"
        self.assertIn("model ID changed", " ".join(module.regressions(old, new)))


if __name__ == "__main__":
    unittest.main()
