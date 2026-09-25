#!/usr/bin/env bash
# One deterministic refresh run: discover -> fetch -> evidence -> parse -> detect changes -> build P1 view.
# Usage: scripts/refresh.sh [prices|full]   (full = also re-fetch trim pages for specs)
# No LLM is involved. Claude/humans only look at review/review_queue.csv and <snap>/change_events.csv.
set -euo pipefail
MODE="${1:-full}"
cd "$(dirname "$0")/.."
T0=$(date +%s)
DATE=$(date -u +%Y-%m-%d)
LAST=$(ls -d snapshots/S*_* 2>/dev/null | sed 's#snapshots/S\([0-9]*\)_.*#\1#' | sort -n | tail -1)
N=$(( ${LAST:-0} + 1 ))
SNAP="snapshots/S${N}_${DATE}"
PREV=$(ls -d snapshots/S*_* | awk -F'[S_]' '{print $2" "$0}' | sort -n | tail -1 | cut -d' ' -f2)
PREV_DISC=$(ls -d snapshots/S*_*/ 2>/dev/null | while read d; do [ -f "$d/model_urls.csv" ] && echo "$d"; done | tail -1)
mkdir -p "$SNAP"
echo "== $SNAP (prev prices: $PREV, prev discovery: ${PREV_DISC:-none}) mode=$MODE"

python3 scripts/discover.py sitemaps --out "$SNAP"
python3 scripts/discover.py diff --out "$SNAP" ${PREV_DISC:+--prev "$PREV_DISC"}
python3 scripts/discover.py triage --out "$SNAP" --max 40

python3 scripts/fetch_snapshot.py fetch --urls snapshots/urls_suv_2m.txt --out "$SNAP" --kind model
python3 scripts/fetch_snapshot.py evidence --out "$SNAP"
python3 scripts/fetch_snapshot.py parse --out "$SNAP"
if [ "$MODE" = "full" ]; then
  python3 scripts/fetch_snapshot.py links --out "$SNAP"
  python3 scripts/fetch_snapshot.py fetch --urls "$SNAP/trim_urls.txt" --out "$SNAP" --kind trim
  python3 scripts/fetch_snapshot.py evidence --out "$SNAP"
  python3 scripts/fetch_snapshot.py specs --out "$SNAP"
fi
python3 scripts/detect_changes.py --prev "$PREV" --cur "$SNAP"
python3 scripts/build_p1.py --master inputs/s0_slice_master.csv --reg inputs/registration_slice.json --as-of "$DATE"

python3 - "$SNAP" "$T0" "$MODE" <<'PY'
import json, sys, time, csv, os
snap, t0, mode = sys.argv[1], int(sys.argv[2]), sys.argv[3]
man = json.load(open(f"{snap}/fetch_manifest.json"))
cnt = lambda p: sum(1 for _ in csv.DictReader(open(p))) if os.path.exists(p) else 0
ev = list(csv.DictReader(open(f"{snap}/change_events.csv")))
rep = dict(snapshot=snap, mode=mode, seconds=int(time.time()) - t0,
           pages_fetched=len(man), pages_ok=sum(1 for m in man if m.get("status") == 200),
           bytes_downloaded=sum(m.get("bytes", 0) for m in man),
           price_rows=cnt(f"{snap}/observations_parsed.csv"), spec_rows=cnt(f"{snap}/specs_parsed.csv"),
           discovery_events=cnt(f"{snap}/discovery_events.csv"), triaged=cnt(f"{snap}/discovery_triage.csv"),
           change_events={e: sum(1 for x in ev if x["event"] == e) for e in sorted({x["event"] for x in ev})},
           review_items=cnt("review/review_queue.csv"), llm_calls=0)
json.dump(rep, open(f"{snap}/run_report.json", "w"), indent=1)
print(json.dumps(rep, indent=1))
PY
