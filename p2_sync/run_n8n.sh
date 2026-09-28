#!/usr/bin/env bash
# Run one sync request through the LIVE n8n consumer via CLI. Usage: run_n8n.sh '<request json>' | run_n8n.sh none
set -euo pipefail
REQ="$1"
if [ "$REQ" = "none" ]; then
  ssh -o BatchMode=yes carindex-vm 'docker exec n8n rm -f /home/node/.n8n-files/p2sync/request.json' >/dev/null 2>&1
else
  printf '%s' "$REQ" | ssh -o BatchMode=yes carindex-vm 'docker exec -i n8n sh -c "mkdir -p /home/node/.n8n-files/p2sync && cat > /home/node/.n8n-files/p2sync/request.json"' 2>/dev/null
fi
ssh -o BatchMode=yes carindex-vm 'docker exec -e N8N_RUNNERS_BROKER_PORT=5699 n8n n8n execute --id=P2SyncProbe00001 --rawOutput' 2>/dev/null | python3 -c '
import sys, json
t = sys.stdin.read(); d = json.loads(t[t.find("{"):])
rd = d["data"]["resultData"]
if rd.get("error"): print(json.dumps({"n8n_error": rd["error"].get("message")})); sys.exit(1)
o = rd["runData"]["Sync From GitHub"][0]["data"]["main"][0][0]["json"]
o["_execution"] = {"status": d.get("status"), "mode": d.get("mode"), "startedAt": d.get("startedAt")}
print(json.dumps(o))'
