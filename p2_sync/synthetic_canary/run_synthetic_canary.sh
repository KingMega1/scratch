#!/usr/bin/env bash
# Synthetic canary through the canonical GitHub branch. REQUIRES push rights to KingMega1/scratch
# (none available in the 2026-09-28 session: PAT is read-only, browser not signed in to GitHub).
# Makes 4 commits on the canonical branch, touching ONLY vehicle-data/sync_canary/p2_sync_canary.json,
# then drives both consumers (Drive mirror + live n8n) through: new, rerun, update, stale, malformed, missing keys.
# Finally removes the canary file with a 5th commit (the ledger keeps the history).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; WORK="$(mktemp -d)"; P=vehicle-data/sync_canary/p2_sync_canary.json
DRIVE="${1:?drive root}"
git clone -q --branch claude/carindex-buyer-vehicle-data-97yinp https://github.com/KingMega1/scratch.git "$WORK/r"
cd "$WORK/r"; mkdir -p vehicle-data/sync_canary
c() { cp "$HERE/synthetic_canary/$1" "$P"; git add "$P"; git commit -qm "sync canary: $1 [NON-PRODUCTION]"; git rev-parse HEAD; }
A=$(c p2_sync_canary.v1.json); B=$(c p2_sync_canary.v2.json); C=$(c p2_sync_canary.malformed.json); D=$(c p2_sync_canary.missing_keys.json)
git push -q origin HEAD
run() { python3 "$HERE/github_to_drive.py" sync --drive-root "$DRIVE" --ref "$1" --path "$P" --request-id "syn:$2" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("drive",d["decision"],d.get("sha256"))';
        "$HERE/run_n8n.sh" "{\"ref\":\"$1\",\"path\":\"$P\",\"request_id\":\"syn:$2\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("n8n  ",d["decision"],d.get("sha256"))'; }
run $A new; run $A rerun; run $B update; run $A stale; run $C malformed; run $D missing_keys
git rm -q "$P"; git commit -qm "sync canary: remove [NON-PRODUCTION]"; git push -q origin HEAD
