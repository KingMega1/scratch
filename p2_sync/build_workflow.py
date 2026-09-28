"""Builds the n8n consumer workflow JSON from sync_core.js (single source of the logic)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
core = open(os.path.join(HERE, 'sync_core.js'), encoding='utf-8').read()
parse = """// Request supplied as a file (canary / CLI). Missing file = default request (branch head).
const it = $input.first();
let request = {};
if (it && it.binary && it.binary.data) {
  const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
  try { request = JSON.parse(buf.toString('utf8')); } catch (e) { request = { path: '__unparseable_request__' }; }
}
return [{ json: { request } }];"""
wf = {
  "id": "P2SyncProbe00001",
  "name": "[NON-PROD] P2 vehicle-data sync consumer (GitHub -> n8n ledger)",
  "active": False,
  "settings": {"executionOrder": "v1", "saveManualExecutions": True, "saveDataSuccessExecution": "all"},
  "nodes": [
    {"id": "n1", "name": "Manual Trigger", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
    {"id": "n2", "name": "Read Sync Request", "type": "n8n-nodes-base.readWriteFile", "typeVersion": 1, "position": [220, 0],
     "parameters": {"operation": "read", "fileSelector": "/home/node/.n8n-files/p2sync/request.json", "options": {}},
     "onError": "continueRegularOutput", "alwaysOutputData": True},
    {"id": "n3", "name": "Parse Request", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 0],
     "parameters": {"jsCode": parse}},
    {"id": "n4", "name": "Sync From GitHub", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 0],
     "parameters": {"jsCode": core}},
  ],
  "connections": {
    "Manual Trigger": {"main": [[{"node": "Read Sync Request", "type": "main", "index": 0}]]},
    "Read Sync Request": {"main": [[{"node": "Parse Request", "type": "main", "index": 0}]]},
    "Parse Request": {"main": [[{"node": "Sync From GitHub", "type": "main", "index": 0}]]},
  },
  "pinData": {},
}
json.dump([wf], open(os.path.join(HERE, 'n8n_p2_sync_consumer.json'), 'w'), indent=1)
print('ok', len(core))
