import json
from pathlib import Path
import tempfile
import unittest
import uuid
from ev3_sink import Sink

def event(**changes):
    e = dict(schema='EV3',source_app='web', event='fmc_start',locale='ar',route='find-my-car',journey_stage='decision',env='prod',is_test=False,event_id=str(uuid.uuid4()),anon_id='person@example.com',session_id='+201234567890',props={'query':'person@example.com','email':'person@example.com'},page='/en/search?q=person@example.com',referrer_origin='https://person@example.com')
    e.update(changes)
    return json.dumps(e).encode()

class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)/'events.sqlite'
        self.sink = Sink(self.path)
    def tearDown(self):
        self.sink.close()
        self.tmp.cleanup()
    def test_commit_receipt_survives_reopen_and_dedupes(self):
        e = event()
        first = self.sink.accept(e)
        self.sink.close()
        self.sink = Sink(self.path)
        second = self.sink.accept(e)
        self.assertEqual(first['receipt'], second['receipt'])
        self.assertTrue(second['duplicate'])
        self.assertEqual(1,self.sink.db.execute('SELECT sum(n) FROM counts').fetchone()[0])
    def test_no_raw_pii_or_identifiers_or_props_persist(self):
        self.sink.accept(event())
        raw = self.path.read_bytes()
        for forbidden in [b'person@example.com',b'+201234567890',b'anon_id',b'session_id',b'query',b'referrer']:
            self.assertNotIn(forbidden,raw)
        self.assertEqual(0o600,self.path.stat().st_mode & 0o777)
    def test_untrusted_dimensions_rejected(self):
        for changes in [dict(event='person@example.com'),dict(locale='person@example.com'),dict(route='person@example.com'),dict(journey_stage='person@example.com'),dict(event_id='person@example.com')]:
            with self.assertRaises(ValueError): self.sink.accept(event(**changes))
        self.assertEqual(0,self.sink.db.execute('SELECT count(*) FROM receipts').fetchone()[0])
    def test_nonproduction_refused(self):
        for changes in [dict(env='qa'),dict(is_test=True)]:
            with self.assertRaises(ValueError): self.sink.accept(event(**changes))
    def test_oversized_utf8_refused(self):
        with self.assertRaisesRegex(ValueError,'too_large'):
            self.sink.accept(event(props={'query':'ع'*8192}))
    def test_receipt_and_aggregate_retention(self):
        day = 86400
        self.sink.accept(event(),now=100*day)
        self.sink.accept(event(),now=108*day)
        self.assertEqual(1,self.sink.db.execute('SELECT count(*) FROM receipts').fetchone()[0])
        self.assertEqual(2,self.sink.db.execute('SELECT sum(n) FROM counts').fetchone()[0])
        self.sink.accept(event(),now=200*day)
        self.assertEqual(1,self.sink.db.execute('SELECT sum(n) FROM counts').fetchone()[0])

if __name__ == '__main__': unittest.main()
