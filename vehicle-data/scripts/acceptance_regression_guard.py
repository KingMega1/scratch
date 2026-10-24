#!/usr/bin/env python3
"""Fail closed when a P2 rebuild silently loses accepted U11 evidence.

Compare committed upstream canonical release with candidate working tree.
No canonical writes or network I/O. Legitimate removals require separate review.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = "vehicle-data/views/canonical_u11.json"


def spec_values(model):
    return {
        field: {(str(item.get("value")), str(item.get("applicability"))) for item in items}
        for field, items in (model.get("specs") or {}).items()
    }


def regressions(old, new):
    failures = []
    old_models = {m["p1_id"]: m for m in old["models"] if m.get("universe") == "U11_283"}
    new_models = {m["p1_id"]: m for m in new["models"] if m.get("universe") == "U11_283"}
    if len(old_models) != 283 or len(new_models) != 283:
        failures.append(f"U11 identity count changed: {len(old_models)} -> {len(new_models)} (expected 283)")
    for p1, before in sorted(old_models.items()):
        after = new_models.get(p1)
        if after is None:
            failures.append(f"{p1}: previously accepted U11 identity disappeared")
            continue
        if before.get("model_id") != after.get("model_id"):
            failures.append(f"{p1}: canonical model ID changed")
        if before.get("price") and not after.get("price"):
            failures.append(f"{p1}: accepted price disappeared")
        for field, old_values in spec_values(before).items():
            new_values = spec_values(after).get(field, set())
            if not old_values <= new_values:
                failures.append(f"{p1}: accepted spec {field} lost {sorted(old_values - new_values)}")
        for key in ("warranty", "brochures", "hero_image", "logo", "gallery"):
            if before.get(key) and not after.get(key):
                failures.append(f"{p1}: accepted {key} disappeared")
    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline-ref", required=True, help="Git ref containing previous canonical release")
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
    print("P2 ACCEPTANCE GUARD PASS: no previously accepted U11 fields removed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
