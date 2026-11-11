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

    def test_price_value_mutation_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0]["price"] = {"price_from": 100000, "evidence_url": "https://official.example/a"}
        new["models"][0]["price"] = {"price_from": 110000, "evidence_url": "https://official.example/a"}
        self.assertIn("accepted price", " ".join(module.regressions(old, new)))

    def test_price_provenance_mutation_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0]["price"] = {"price_from": 100000, "issuer": "OEM"}
        new["models"][0]["price"] = {"price_from": 100000, "issuer": "unknown"}
        self.assertIn("accepted price", " ".join(module.regressions(old, new)))

    def test_media_hash_substitution_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0]["hero_image"] = {"src": "/media/a.webp", "sha256": "hash-A"}
        new["models"][0]["hero_image"] = {"src": "/media/a.webp", "sha256": "hash-B"}
        self.assertIn("hero_image", " ".join(module.regressions(old, new)))

    def test_gallery_reference_replacement_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0]["gallery"] = [{"src": "/media/a.webp", "sha256": "hash-A"}]
        new["models"][0]["gallery"] = [{"src": "/media/a.webp", "sha256": "hash-B"}]
        self.assertIn("gallery", " ".join(module.regressions(old, new)))

    def test_spec_provenance_mutation_blocked(self):
        old, new = fixture(), fixture()
        old["models"][0]["specs"] = {"length_mm": [{"value": 4400, "applicability": "all", "source": "OEM"}]}
        new["models"][0]["specs"] = {"length_mm": [{"value": 4400, "applicability": "all", "source": "unknown"}]}
        self.assertIn("accepted spec length_mm", " ".join(module.regressions(old, new)))

    def test_duplicate_p1_id_blocked(self):
        old, new = fixture(), fixture()
        new["models"][1]["p1_id"] = new["models"][0]["p1_id"]
        self.assertIn("duplicate or missing p1_id", " ".join(module.regressions(old, new)))

    def test_duplicate_model_id_blocked(self):
        old, new = fixture(), fixture()
        new["models"][1]["model_id"] = new["models"][0]["model_id"]
        self.assertIn("duplicate or missing model_id", " ".join(module.regressions(old, new)))

    def test_additive_gallery_and_brochure_pass(self):
        old, new = fixture(), fixture()
        item = {"src": "/media/a.webp", "sha256": "hash-A"}
        old["models"][0]["gallery"] = [item]
        new["models"][0]["gallery"] = [item, {"src": "/media/b.webp", "sha256": "hash-B"}]
        new["models"][0]["brochures"] = [{"url": "https://official.example/brochure.pdf"}]
        self.assertEqual(module.regressions(old, new), [])

    def test_reviewed_supersession_as_new_baseline_passes(self):
        # Once P2 has separately accepted and committed a new baseline, a
        # subsequent unchanged refresh must pass without an allow-all bypass.
        old, new = fixture(), fixture()
        for row in (old["models"][0], new["models"][0]):
            row["price"] = {"price_from": 110000, "issuer": "OEM", "effective_date": "2026-10-25"}
        self.assertEqual(module.regressions(old, new), [])


if __name__ == "__main__":
    unittest.main()
