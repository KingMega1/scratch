#!/usr/bin/env python3
"""Fail closed when a P2 rebuild mutates previously accepted U11 evidence.

An automated refresh may add new evidence, but changing accepted values, source
provenance or media identity requires a separate P2-reviewed supersession.
The accepted baseline advances only after that review; this script never writes
canonical records or grants acceptance.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = "vehicle-data/views/canonical_u11.json"
UNIVERSE = "U11_283"


def fingerprint(value):
    """Deterministic fingerprint of complete evidence, including provenance."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def evidence_items(value):
    if not value:
        return set()
    if isinstance(value, list):
        return {fingerprint(item) for item in value}
    return {fingerprint(value)}


def duplicate_values(models, key):
    counts = Counter(m.get(key) for m in models)
    return sorted(str(value) for value, count in counts.items()
                  if count > 1 or value is None or value == "")


def regressions(old, new):
    failures = []
    old_rows = [m for m in old["models"] if m.get("universe") == UNIVERSE]
    new_rows = [m for m in new["models"] if m.get("universe") == UNIVERSE]
    if len(old_rows) != 283 or len(new_rows) != 283:
        failures.append(f"U11 row count changed: {len(old_rows)} -> {len(new_rows)} (expected 283)")
    for label, rows in (("baseline", old_rows), ("candidate", new_rows)):
        for key in ("p1_id", "model_id"):
            duplicates = duplicate_values(rows, key)
            if duplicates:
                failures.append(f"{label}: duplicate or missing {key}: {duplicates[:10]}")
    old_models = {m["p1_id"]: m for m in old_rows if m.get("p1_id")}
    new_models = {m["p1_id"]: m for m in new_rows if m.get("p1_id")}
    if len(old_models) != len(new_models):
        failures.append(f"U11 unique identity count changed: {len(old_models)} -> {len(new_models)}")

    for p1, before in sorted(old_models.items()):
        after = new_models.get(p1)
        if after is None:
            failures.append(f"{p1}: previously accepted U11 identity disappeared")
            continue
        if before.get("model_id") != after.get("model_id"):
            failures.append(f"{p1}: canonical model ID changed")
        if before.get("price") and fingerprint(before["price"]) != fingerprint(after.get("price")):
            failures.append(f"{p1}: accepted price/value/provenance changed; P2 supersession review required")
        old_specs = before.get("specs") or {}
        new_specs = after.get("specs") or {}
        for field, previous in old_specs.items():
            removed = evidence_items(previous) - evidence_items(new_specs.get(field))
            if removed:
                failures.append(f"{p1}: accepted spec {field} value/applicability/provenance changed or removed ({len(removed)} item(s))")
        for key in ("warranty", "hero_image", "hero_image_limited", "logo"):
            if before.get(key) and fingerprint(before[key]) != fingerprint(after.get(key)):
                failures.append(f"{p1}: accepted {key} reference/metadata changed or disappeared")
        for key in ("brochures", "gallery"):
            removed = evidence_items(before.get(key)) - evidence_items(after.get(key))
            if removed:
                failures.append(f"{p1}: accepted {key} reference/hash/provenance changed or removed ({len(removed)} item(s))")
    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline-ref", required=True, help="Git ref containing last P2-accepted canonical release")
    ap.add_argument("--candidate", default=str(ROOT / "views" / "canonical_u11.json"))
    args = ap.parse_args()
    try:
        baseline = subprocess.run(["git", "show", f"{args.baseline_ref}:{CANONICAL}"],
                                  check=True, text=True, capture_output=True)
        old = json.loads(baseline.stdout)
        new = json.loads(Path(args.candidate).read_text(encoding="utf-8"))
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"P2 ACCEPTANCE GUARD BLOCKED: cannot verify baseline/candidate: {exc}", file=sys.stderr)
        return 2
    failures = regressions(old, new)
    if failures:
        print(f"P2 ACCEPTANCE GUARD BLOCKED: {len(failures)} unapproved regression(s):", file=sys.stderr)
        for failure in failures:
            print(" - " + failure, file=sys.stderr)
        return 1
    print("P2 ACCEPTANCE GUARD PASS: accepted U11 evidence unchanged or extended")
    return 0


if __name__ == "__main__":
    sys.exit(main())
