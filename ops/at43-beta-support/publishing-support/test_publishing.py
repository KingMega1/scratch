import copy
import hashlib
import hmac
import json
import tempfile
import subprocess
from pathlib import Path
import threading
import time
import unittest
import urllib.error
import urllib.request
from publishing import PublishingStore, encoded
from server import make_server
from verify_queue import verify

ARTICLE = dict(slug="understanding-prices", type="guide", title=dict(en="Prices", ar="الأسعار"),
               summary=dict(en="How to compare", ar="كيفية المقارنة"), body=dict(en=["Check the date."], ar=["تحقق من التاريخ."]), relatedModelIds=["geely/ex5"], tags=["methodology"])
EVENT = dict(schema="carindex.p2.accepted-publish/v1", event_id="owner-event-1", owner="P2", state="ACCEPTED", release_id="OWNER-TEST-ONLY", commit="a" * 40,
             artifacts=[dict(path="web/data/registry/catalogue-serving.release.json", sha256="b" * 64, state="ACCEPTED")], acceptance_ref="https://example.invalid/owner-acceptance-test")
SECRET = "synthetic-test-only-owner-secret-0000"


class Acceptance(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = PublishingStore(self.directory.name + "/test.sqlite")

    def tearDown(self):
        self.store.close()
        self.directory.cleanup()

    def event(self, value=EVENT, timestamp=None, signature=None):
        raw = encoded(value)
        stamp = int(time.time()) if timestamp is None else timestamp
        sig = signature or hmac.new(SECRET.encode(), str(stamp).encode() + b"." + raw, hashlib.sha256).hexdigest()
        return self.store.ingest_p2(raw, stamp, sig, SECRET)

    def test_owner_event_durable_idempotent_queue(self):
        first = self.event()
        self.assertEqual(first["state"], "QUEUED")
        self.assertFalse(first["idempotent_replay"])
        self.assertTrue(self.event()["idempotent_replay"])
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM p2_events").fetchone()[0], 1)
        self.store.close()
        self.store = PublishingStore(self.directory.name + "/test.sqlite")
        self.assertTrue(self.event()["idempotent_replay"])

    def test_staged_held_unsigned_stale_and_p1_refused(self):
        for state in ("STAGED", "HOLD", "VERIFYING", "NEEDS_P2_QA"):
            event = copy.deepcopy(EVENT)
            event["state"] = state
            with self.assertRaises(ValueError): self.event(event)
            event["state"] = "ACCEPTED"
            event["artifacts"][0]["state"] = state
            with self.assertRaises(ValueError): self.event(event)
        event = copy.deepcopy(EVENT)
        event["artifacts"][0]["path"] = "web/p1-release/engine.js"
        with self.assertRaises(ValueError): self.event(event)
        with self.assertRaises(PermissionError): self.event(signature="0" * 64)
        with self.assertRaises(ValueError): self.event(timestamp=1)

    def test_reused_id_changed_hash_refused(self):
        self.event()
        event = copy.deepcopy(EVENT)
        event["artifacts"][0]["sha256"] = "c" * 64
        with self.assertRaises(ValueError): self.event(event)

    def test_immutable_git_artifact_verified_before_owner_handoff(self):
        repo = Path(self.directory.name) / "repo"
        repo.mkdir()
        def git(*args):
            return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout.decode().strip()
        git("init")
        git("config", "user.name", "Synthetic acceptance")
        git("config", "user.email", "synthetic@example.invalid")
        path = EVENT["artifacts"][0]["path"]
        artifact = repo / path
        artifact.parent.mkdir(parents=True)
        content = b'{"synthetic_test_only":true}\n'
        artifact.write_bytes(content)
        git("add", path)
        git("commit", "-m", "Synthetic immutable release test")
        event = copy.deepcopy(EVENT)
        event["commit"] = git("rev-parse", "HEAD")
        event["artifacts"][0]["sha256"] = hashlib.sha256(content).hexdigest()
        self.event(event)
        artifact.write_text("uncommitted modified data must not be used")
        receipt = verify(str(repo), event)
        self.assertEqual(receipt["state"], "VERIFYING")
        self.assertEqual(receipt["next_owner"], "P5")
        event["artifacts"][0]["sha256"] = "0" * 64
        with self.assertRaises(ValueError): verify(str(repo), event)

    def test_editorial_draft_review_publish_and_edit_revokes(self):
        rev = self.store.save_draft(ARTICLE, "author")
        self.assertEqual(self.store.list_public(), [])
        with self.assertRaises(ValueError): self.store.transition(ARTICLE["slug"], rev, "publish", "author", "2026-01-01T00:00:00Z")
        self.store.transition(ARTICLE["slug"], rev, "submit", "author")
        with self.assertRaises(ValueError): self.store.transition(ARTICLE["slug"], rev, "approve", "author")
        self.store.transition(ARTICLE["slug"], rev, "approve", "reviewer")
        with self.assertRaises(ValueError): self.store.transition(ARTICLE["slug"], rev, "publish", "reviewer", "2099-01-01T00:00:00Z")
        self.store.transition(ARTICLE["slug"], rev, "publish", "reviewer", "2026-01-01T00:00:00Z")
        self.assertEqual(self.store.list_public()[0]["body"]["ar"], ARTICLE["body"]["ar"])
        edited = copy.deepcopy(ARTICLE)
        edited["title"]["en"] = "Updated prices"
        self.store.save_draft(edited, "author")
        self.assertEqual(self.store.list_public(), [])
        with self.assertRaises(ValueError): self.store.transition(ARTICLE["slug"], rev, "approve", "reviewer")

    def test_bilingual_and_editorial_scope_required(self):
        item = copy.deepcopy(ARTICLE)
        del item["body"]["ar"]
        with self.assertRaises(ValueError): self.store.save_draft(item, "author")
        for extra in ("prices", "customer_email", "recommendation_rules", "status"):
            item = dict(ARTICLE, **{extra: "forbidden"})
            with self.assertRaises(ValueError): self.store.save_draft(item, "author")

    def test_real_http_auth_workflow_and_public_receipt(self):
        server = make_server(self.store, {"author-test-token": ("author", "author"), "reviewer-test-token": ("reviewer", "reviewer")}, SECRET)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(server.server_port)
        def call(path, data=None, token=None):
            headers = {"Content-Type": "application/json"}
            if token: headers["Authorization"] = "Bearer " + token
            request = urllib.request.Request(base + path, data=None if data is None else encoded(data), headers=headers)
            with urllib.request.urlopen(request) as response: return json.load(response)
        try:
            with self.assertRaises(urllib.error.HTTPError) as error: call("/v1/editorial/draft", ARTICLE)
            self.assertEqual(error.exception.code, 401)
            rev = call("/v1/editorial/draft", ARTICLE, "author-test-token")["revision"]
            self.assertEqual(call("/v1/content")["items"], [])
            for action, token in [("submit", "author-test-token"), ("approve", "reviewer-test-token"), ("publish", "reviewer-test-token")]:
                call("/v1/editorial/transition", dict(slug=ARTICLE["slug"], revision=rev, action=action, publishedAt="2026-01-01T00:00:00Z"), token)
            self.assertEqual(call("/v1/content")["items"][0]["status"], "published")
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__": unittest.main(verbosity=2)
