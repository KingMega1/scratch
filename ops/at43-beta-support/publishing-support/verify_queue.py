"""Read-only M6 owner handoff verifier. Never checks out, rewrites or deploys a release."""
import argparse
import hashlib
import json
import sqlite3
import subprocess


def verify(repo, event):
    verified = []
    for artifact in event["artifacts"]:
        blob = subprocess.run(["git", "-C", repo, "show", event["commit"] + ":" + artifact["path"]],
                              capture_output=True, check=True).stdout
        actual = hashlib.sha256(blob).hexdigest()
        if actual != artifact["sha256"]:
            raise ValueError("owner artifact hash mismatch: " + artifact["path"])
        verified.append(dict(path=artifact["path"], sha256=actual))
    return dict(state="VERIFYING", next_owner="P5", event_id=event["event_id"],
                release_id=event["release_id"], commit=event["commit"], artifacts=verified,
                acceptance_ref=event["acceptance_ref"],
                gate="P5 integration tests and production publication; P1 semantics and P2 truth unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    db = sqlite3.connect("file:" + args.db + "?mode=ro", uri=True)
    row = db.execute("SELECT payload FROM p2_events WHERE event_id=?", (args.event_id,)).fetchone()
    if not row:
        raise SystemExit("owner event not queued")
    print(json.dumps(verify(args.repo, json.loads(row[0])), ensure_ascii=False, indent=2))
