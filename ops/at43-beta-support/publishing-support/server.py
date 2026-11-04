"""Loopback headless API. Bind behind an existing authenticated infrastructure adapter only."""
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from publishing import PublishingStore, encoded


def make_server(store, tokens, webhook_secret, port=0):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log tokens, article bodies or webhook payloads.

        def reply(self, status, value):
            body = encoded(value)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if urlparse(self.path).path != "/v1/content":
                return self.reply(404, {"error": "not_found"})
            with lock:
                items = store.list_public()
            return self.reply(200, {"schema": "carindex.editorial.content/v1", "items": items})

        def do_POST(self):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 500000 or self.headers.get("Transfer-Encoding"):
                    return self.reply(413, {"error": "bounded_content_length_required"})
                self.connection.settimeout(5)
                raw = self.rfile.read(length)
                if len(raw) != length:
                    return self.reply(400, {"error": "incomplete_body"})
                if self.path == "/v1/p2/accepted":
                    with lock:
                        result = store.ingest_p2(raw, self.headers.get("X-CI-Timestamp", "0"), self.headers.get("X-CI-Signature", ""), webhook_secret)
                    return self.reply(202, result)
                token = self.headers.get("Authorization", "").removeprefix("Bearer ")
                account = next((v for k, v in tokens.items() if hmac.compare_digest(k, token)), None)
                if not account:
                    return self.reply(401, {"error": "unauthorized"})
                actor, role = account
                body = json.loads(raw)
                with lock:
                    if self.path == "/v1/editorial/draft" and role == "author":
                        revision = store.save_draft(body, actor)
                        return self.reply(201, {"state": "draft", "revision": revision})
                    if self.path == "/v1/editorial/transition":
                        action = body["action"]
                        if (action == "submit" and role != "author") or (action in ("approve", "publish") and role != "reviewer"):
                            return self.reply(403, {"error": "role_forbidden"})
                        store.transition(body["slug"], body["revision"], action, actor, body.get("publishedAt"))
                        return self.reply(200, {"action": action, "revision": body["revision"]})
                return self.reply(404, {"error": "not_found"})
            except PermissionError:
                return self.reply(401, {"error": "invalid_signature"})
            except (ValueError, KeyError, TypeError):
                return self.reply(400, {"error": "validation_failed"})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    # Existing platform secret injection only; never create credentials automatically.
    accounts = json.loads(os.environ["CI_EDITORIAL_ACCOUNTS_JSON"])
    if not accounts or any(len(k) < 32 or len(v) != 2 or v[1] not in ("author", "reviewer") for k, v in accounts.items()):
        raise SystemExit("Separate configured author/reviewer service tokens required")
    store = PublishingStore(os.environ["CI_PUBLISH_DB"])
    make_server(store, accounts, os.environ["CI_P2_OWNER_WEBHOOK_SECRET"], int(os.environ.get("CI_PUBLISH_PORT", "8791"))).serve_forever()
