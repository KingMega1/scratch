"""Regression tests for the U11 canonical promotion (scripts/canonical.py outputs)."""
import csv, collections, glob, hashlib, json, os, subprocess, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTS = ["registry/u11_models.csv", "registry/u11_prices.csv", "views/canonical_u11.json",
        "views/catalogue-serving.release.json", "review/u11_coverage.csv"]


def rd(p):
    return list(csv.DictReader(open(os.path.join(ROOT, p), newline="", encoding="utf-8")))


def digest():
    return {p: hashlib.sha256(open(os.path.join(ROOT, p), "rb").read()).hexdigest() for p in OUTS}


class Canonical(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "canonical.py")], check=True, capture_output=True)
        cls.models = rd("registry/u11_models.csv")
        cls.prices = rd("registry/u11_prices.csv")
        cls.canon = json.load(open(os.path.join(ROOT, "views", "canonical_u11.json")))
        cls.release = json.load(open(os.path.join(ROOT, "views", "catalogue-serving.release.json")))
        cls.rc1 = json.load(open(os.path.join(ROOT, "inputs", "u11", "catalogue-serving.RC1.json")))

    def test_deterministic(self):
        a = digest()
        subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "canonical.py")], check=True, capture_output=True)
        self.assertEqual(a, digest())

    def test_identity_complete_and_unique(self):
        on = [m for m in self.models if m["on_sale_u11"] == "true"]
        self.assertEqual(len(on), 283)
        for k in ("model_id", "p1_id", "site_slug"):
            self.assertEqual(len({m[k] for m in self.models}), len(self.models), k)
        u = {m["id"] for m in json.load(open(os.path.join(ROOT, "inputs", "u11", "p11_universe.json")))["models"] if m.get("in_universe")}
        self.assertEqual({m["p1_id"] for m in on}, u)

    def test_existing_ids_never_change(self):
        reg = {r["model_id"]: r["slug"] for r in rd("registry/models.csv")}
        by = {m["model_id"]: m for m in self.models}
        for mid, slug in reg.items():
            self.assertIn(mid, by)
            self.assertEqual(by[mid]["site_slug"], slug)

    def test_accepted_prices_have_evidence(self):
        for r in self.prices:
            if r["status"] != "ACCEPT":
                continue
            self.assertIn(r["tier"], ("A", "B"))
            self.assertTrue(r["evidence_url"] and r["issuer"] and r["as_of"], r["price_id"])
            self.assertIn(r["date_basis"], ("SOURCE_STATED", "OBSERVED"))
            if r["date_basis"] == "SOURCE_STATED":
                self.assertTrue(r["effective_date"])
            if r["tier"] == "B":
                self.assertGreaterEqual(int(r["sites"]), 2)

    def test_tier_b_values_exist_in_snapshot(self):
        seen = collections.defaultdict(set)
        for snap in self.canon["market_snapshots"]:  # U11 price snapshot + universe-audit snapshot
            for o in rd(os.path.join(snap, "observations_parsed.csv")):
                v = (o["official_price"] or "").replace(",", "").strip()
                if v.isdigit():
                    seen[int(v)].add(o["source_url"])
            for c in rd(os.path.join(snap, "contactcars_pricetable_cells.csv")):
                v = (c["official_cell"] or "").replace(",", "").replace(" EGP", "").strip()
                if v.isdigit():
                    seen[int(v)].add(c["source_url"])
        for r in self.prices:
            if r["tier"] == "B" and r["status"] == "ACCEPT":
                for u in r["evidence_url"].split(" | "):
                    self.assertIn(u, seen[int(r["price_egp"])], (r["p1_id"], r["price_egp"], u))

    def test_no_tier_c_accepted(self):
        self.assertFalse([r for r in self.prices if r["tier"] == "C" and r["status"] == "ACCEPT"])

    def test_conflicts_never_accepted(self):
        self.assertFalse([r for r in self.prices if "CONFLICT" in r["reason"] and r["status"] == "ACCEPT"])

    def test_canonical_price_from_is_an_accepted_value(self):
        acc = collections.defaultdict(set)
        for r in self.prices:
            if r["status"] == "ACCEPT":
                acc[r["p1_id"]].add(int(r["price_egp"]))
        for m in self.canon["models"]:
            if m["price"]:
                self.assertIn(m["price"]["price_from"], acc[m["p1_id"]])
            else:
                self.assertIn("NO_ACCEPTED_PRICE", m["gaps"])

    def test_serving_release_keeps_p5_contract(self):
        r, rc1 = self.release, self.rc1
        self.assertEqual(r["schema"], "carindex.p2.catalogue-serving/v1")
        self.assertEqual(len(r["entries"]), 283)
        self.assertEqual([e["p1_id"] for e in r["entries"]], [e["p1_id"] for e in rc1["entries"]])
        self.assertEqual([e["site_slug"] for e in r["entries"]], [e["site_slug"] for e in rc1["entries"]])
        for e, o in zip(r["entries"], rc1["entries"]):
            self.assertTrue(set(o) <= set(e))
            for k in ("brand", "model", "ar", "on_sale", "body", "powertrains", "registration", "evidence_state"):
                self.assertEqual(e[k], o[k], (e["p1_id"], k))
        self.assertEqual(r["excluded"], rc1["excluded"])

    def test_registry_csvs_well_formed(self):
        for p in ("registry/brochures.csv", "registry/spec_facts.csv", "registry/price_evidence_manual.csv",
                  "registry/media_accepted.csv"):
            for r in rd(p):
                self.assertNotIn(None, r, p)

    def test_accepted_facts_have_egypt_source(self):
        bro = {r["drive_id"]: r["status"] for r in rd("registry/brochures.csv")}
        for r in rd("registry/spec_facts.csv"):
            if r["status"] == "ACCEPT":
                self.assertIn(bro.get(r["source_drive_id"]), ("ACCEPT", "ACCEPT_PRICE_LIST"), r)

    def test_unknown_specs_not_invented(self):
        for m in self.canon["models"]:
            self.assertIsNone(m["generation"])
            self.assertIn("GENERATION_UNKNOWN", m["gaps"])

    # ---- market-universe audit (config/market_universe.json, review/market_universe_audit.csv)
    @classmethod
    def mu(cls):
        return json.load(open(os.path.join(ROOT, "config", "market_universe.json")))["identities"]

    def test_market_universe_identities_unique_and_evidenced(self):
        u283 = {m["p1_id"] for m in self.models if m["on_sale_u11"] == "true"}
        dec = [d for d in self.mu() if d["decision"] in ("ADDITION", "SPLIT")]
        self.assertEqual(len({d["id"] for d in dec}), len(dec))
        for d in dec:
            self.assertTrue(d["evidence"], d["id"])
            self.assertNotIn(d["id"], u283, d["id"])
            if d["decision"] == "SPLIT":
                self.assertIn(d["parent"], u283, d["id"])
        rows = [m for m in self.models if m.get("universe") in ("P2_ADDITION", "P2_SPLIT")]
        self.assertEqual({m["p1_id"] for m in rows}, {d["id"] for d in dec})

    def test_splits_take_only_matching_trims(self):
        import re
        for d in [d for d in self.mu() if d["decision"] == "SPLIT" and d.get("trim_regex")]:
            for r in self.prices:
                if r["p1_id"] == d["parent"]:
                    self.assertIsNone(re.search(d["trim_regex"], r["trim_label"], re.I), (d["id"], r["trim_label"]))
                if r["p1_id"] == d["id"] and r["issuer"] in ("ContactCars", "Hatla2ee", "EgyCar"):
                    self.assertIsNotNone(re.search(d["trim_regex"], r["trim_label"], re.I), (d["id"], r["trim_label"]))

    def test_serving_keeps_283_and_lists_additions(self):
        dec = {d["id"] for d in self.mu() if d["decision"] in ("ADDITION", "SPLIT")}
        self.assertEqual(len(self.release["entries"]), 283)
        self.assertEqual({a["identity"] for a in self.release["market_additions"]}, dec)
        self.assertFalse({a["site_slug"] for a in self.release["market_additions"]} & {e["site_slug"] for e in self.release["entries"]})

    def test_audit_leaves_no_undecided_on_sale_model(self):
        rows = rd("review/market_universe_audit.csv")
        self.assertFalse([r["identity"] for r in rows if r["audit_class"] == "ON_SALE_NOT_IN_283"])
        self.assertEqual(sum(r["audit_class"] == "IN_283" for r in rows), 283)


if __name__ == "__main__":
    unittest.main()
