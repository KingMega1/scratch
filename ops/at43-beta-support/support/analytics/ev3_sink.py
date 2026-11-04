"""Privacy-minimal EV3 persistence adapter. Operator storage, never Vercel /tmp.

Persists aggregate event counts only. No customer identity, IP, query, model,
result, referrer, URL, props, session_id or anon_id is written. Existing EV3
envelopes are the input contract; this is not a new client analytics contract.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import time
import uuid

EVENTS = frozenset('page_view search_submit search_result_click car_view compare_view cta_click lang_switch filter_apply evidence_open fmc_view fmc_start fmc_q_answer fmc_summary_confirm fmc_summary_edit fmc_result_view fmc_adjust fmc_error identity_gate_view exit'.split())
ROUTES = frozenset('home market cars search news car compare find-my-car my-carindex other'.split())
STAGES = frozenset('awareness discovery consideration decision retention other'.split())
MAX_BYTES = 8192
RECEIPT_DAYS = 7
AGGREGATE_DAYS = 90

def validate(payload):
    # Reject at the byte boundary before decoding; transport must also enforce it.
    if len(payload) > MAX_BYTES:
        raise ValueError('too_large')
    e = json.loads(payload)
    if not isinstance(e, dict) or e.get('schema') != 'EV3' or e.get('source_app') != 'web':
        raise ValueError('invalid_envelope')
    if e.get('event') not in EVENTS or e.get('route') not in ROUTES or e.get('locale') not in ('ar', 'en') or e.get('journey_stage') not in STAGES:
        raise ValueError('invalid_dimension')
    if e.get('env') != 'prod' or e.get('is_test') is not False:
        raise ValueError('nonproduction_event')
    # Only canonical random UUID identifiers; their irreversible digest is kept
    # seven days for dedupe. Source IDs and all unknown values are discarded.
    event_id = str(uuid.UUID(e.get('event_id', '')))
    if event_id != e.get('event_id'):
        raise ValueError('invalid_event_id')
    return (hashlib.sha256(event_id.encode()).hexdigest(), e['event'], e['locale'], e['route'], e['journey_stage'])

class Sink:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Secure newly created DB before SQLite opens it; existing policy is also
        # tightened. Parent directory should be dedicated to this service.
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        os.chmod(self.path, 0o600)
        self.db = sqlite3.connect(self.path, timeout=10)
        self.db.execute('PRAGMA journal_mode=DELETE')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('PRAGMA secure_delete=ON')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS receipts (digest TEXT PRIMARY KEY, receipt TEXT NOT NULL, received INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS counts (hour INTEGER, event TEXT, locale TEXT, route TEXT, stage TEXT, n INTEGER NOT NULL, PRIMARY KEY(hour,event,locale,route,stage));
        ''')

    def accept(self, payload, now=None):
        digest, event, locale, route, stage = validate(payload)
        now = int(time.time() if now is None else now)
        hour = now - now % 3600
        receipt = str(uuid.uuid4())
        # Return acceptance only after commit. A reopened connection can verify
        # the receipt, proving persistence rather than browser/log acceptance.
        with self.db:
            self.db.execute('DELETE FROM receipts WHERE received < ?', (now - RECEIPT_DAYS * 86400,))
            self.db.execute('DELETE FROM counts WHERE hour < ?', (now - AGGREGATE_DAYS * 86400,))
            previous = self.db.execute('SELECT receipt FROM receipts WHERE digest=?', (digest,)).fetchone()
            if previous:
                return {'accepted': True, 'receipt': previous[0], 'duplicate': True}
            self.db.execute('INSERT INTO receipts VALUES (?,?,?)', (digest, receipt, now))
            self.db.execute('INSERT INTO counts VALUES (?,?,?,?,?,1) ON CONFLICT(hour,event,locale,route,stage) DO UPDATE SET n=n+1', (hour,event,locale,route,stage))
        return {'accepted': True, 'receipt': receipt, 'duplicate': False}

    def close(self):
        self.db.close()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db', required=True)
    p.add_argument('--receipt')
    args = p.parse_args()
    sink = Sink(args.db)
    try:
        if args.receipt:
            receipt = str(uuid.UUID(args.receipt))
            found = sink.db.execute('SELECT 1 FROM receipts WHERE receipt=?', (receipt,)).fetchone()
            print(json.dumps({'persisted': bool(found), 'receipt': receipt}))
        else:
            # Read at most limit+1: no unbounded body buffering in this adapter.
            print(json.dumps(sink.accept(sys.stdin.buffer.read(MAX_BYTES + 1))))
    finally:
        sink.close()

if __name__ == '__main__':
    main()
