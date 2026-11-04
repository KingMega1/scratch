"""Independent M6/M7 support adapter. Does not edit P2 truth or deploy P5 code."""
import hashlib
import hmac
import json
import re
import sqlite3
import time


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


class PublishingStore:
    def __init__(self, path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS articles(slug TEXT PRIMARY KEY, document TEXT NOT NULL,
          revision TEXT NOT NULL, state TEXT NOT NULL, author TEXT NOT NULL,
          reviewer TEXT, published_at TEXT);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, action TEXT NOT NULL,
          object_id TEXT NOT NULL, revision TEXT NOT NULL, actor TEXT NOT NULL, at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS p2_events(event_id TEXT PRIMARY KEY, revision TEXT NOT NULL,
          payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'QUEUED', at REAL NOT NULL);
        """)

    def close(self):
        self.db.close()

    def _audit(self, action, object_id, revision, actor):
        self.db.execute("INSERT INTO audit(action,object_id,revision,actor,at) VALUES(?,?,?,?,?)",
                        (action, object_id, revision, actor, time.time()))

    def save_draft(self, item, actor):
        allowed = {"slug", "type", "title", "summary", "body", "relatedModelIds", "tags"}
        if set(item) != allowed:
            raise ValueError("editorial schema only; facts, identity, and workflow fields forbidden")
        if not isinstance(actor, str) or not actor.strip():
            raise ValueError("author required")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item["slug"]):
            raise ValueError("invalid slug")
        if item["type"] not in ("news", "guide", "insight"):
            raise ValueError("invalid content type")
        for field in ("title", "summary", "body"):
            if not isinstance(item[field], dict) or set(item[field]) != {"ar", "en"}:
                raise ValueError("AR and EN required")
            for value in item[field].values():
                if field == "body":
                    if not isinstance(value, list) or not value or any(not isinstance(x, str) or not x.strip() for x in value):
                        raise ValueError("nonempty bilingual body required")
                elif not isinstance(value, str) or not value.strip():
                    raise ValueError("nonempty bilingual copy required")
        if any(not isinstance(item[f], list) or any(not isinstance(x, str) for x in item[f]) for f in ("tags", "relatedModelIds")):
            raise ValueError("invalid references")
        if len(encoded(item)) > 200000:
            raise ValueError("article too large")
        revision = digest(item)
        with self.db:
            self.db.execute("INSERT INTO articles VALUES(?,?,?,'draft',?,NULL,NULL) ON CONFLICT(slug) DO UPDATE SET document=excluded.document,revision=excluded.revision,state='draft',author=excluded.author,reviewer=NULL,published_at=NULL",
                            (item["slug"], encoded(item).decode(), revision, actor))
            self._audit("DRAFT_SAVED", item["slug"], revision, actor)
        return revision

    def transition(self, slug, revision, action, actor, published_at=None):
        if not isinstance(actor, str) or not actor.strip():
            raise ValueError("actor required")
        with self.db:
            row = self.db.execute("SELECT state,author,reviewer,revision FROM articles WHERE slug=?", (slug,)).fetchone()
            if not row or row[3] != revision:
                raise ValueError("revision missing or stale")
            state, author, reviewer, _ = row
            if action == "submit" and state == "draft" and actor == author:
                self.db.execute("UPDATE articles SET state='review' WHERE slug=?", (slug,))
            elif action == "approve" and state == "review" and actor != author:
                self.db.execute("UPDATE articles SET state='approved',reviewer=? WHERE slug=?", (actor, slug))
            elif action == "publish" and state == "approved" and actor == reviewer:
                if not published_at:
                    raise ValueError("publication timestamp required")
                # A future scheduled date stays approved; a caller must publish when due.
                from datetime import datetime, timezone
                stamp = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                if stamp.tzinfo is None or stamp > datetime.now(timezone.utc):
                    raise ValueError("publication time must be timezone-aware and not future")
                self.db.execute("UPDATE articles SET state='published',published_at=? WHERE slug=?", (published_at, slug))
            else:
                raise ValueError("invalid transition or actor")
            self._audit(action.upper(), slug, revision, actor)

    def list_public(self):
        rows = self.db.execute("SELECT document,published_at FROM articles WHERE state='published' ORDER BY published_at DESC").fetchall()
        return [dict(json.loads(doc), status="published", publishedAt=at) for doc, at in rows]

    def ingest_p2(self, raw, timestamp, signature, secret, now=None):
        """Accept an owner-signed release event; queue only. No canonical or website writes."""
        now = time.time() if now is None else now
        if not secret or len(secret) < 32:
            raise ValueError("owner webhook secret must be configured")
        if len(raw) > 500000 or abs(now - int(timestamp)) > 300:
            raise ValueError("payload too large or stale timestamp")
        expected = hmac.new(secret.encode(), str(timestamp).encode() + b"." + raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise PermissionError("invalid owner signature")
        event = json.loads(raw)
        if set(event) != {"schema", "event_id", "owner", "state", "release_id", "commit", "artifacts", "acceptance_ref"}:
            raise ValueError("unexpected release fields")
        if event["schema"] != "carindex.p2.accepted-publish/v1" or event["owner"] != "P2" or event["state"] != "ACCEPTED":
            raise ValueError("only P2 owner ACCEPTED events may enter publish queue")
        if not re.fullmatch(r"[0-9a-f]{40}", event["commit"]) or not event["event_id"] or not event["release_id"] or not event["acceptance_ref"]:
            raise ValueError("immutable release and owner evidence required")
        if not event["artifacts"] or len(event["artifacts"]) > 100:
            raise ValueError("bounded artifacts required")
        paths = set()
        for asset in event["artifacts"]:
            if set(asset) != {"path", "sha256", "state"} or asset["state"] != "ACCEPTED":
                raise ValueError("staged, held or unresolved artifacts refused")
            if asset["path"] not in {"web/data/registry/catalogue-serving.release.json", "web/data/registry/brochure-serving.release.json"}:
                raise ValueError("P5 projection allowlist only; canonical and P1 edits refused")
            if asset["path"] in paths or not re.fullmatch(r"[0-9a-f]{64}", asset["sha256"]):
                raise ValueError("duplicate path or invalid hash")
            paths.add(asset["path"])
        revision = digest(event)
        with self.db:
            prior = self.db.execute("SELECT revision FROM p2_events WHERE event_id=?", (event["event_id"],)).fetchone()
            if prior:
                if prior[0] != revision:
                    raise ValueError("event ID reused with changed content")
                return {"state": "QUEUED", "idempotent_replay": True, "revision": revision}
            self.db.execute("INSERT INTO p2_events(event_id,revision,payload,at) VALUES(?,?,?,?)", (event["event_id"], revision, encoded(event).decode(), now))
            self._audit("P2_ACCEPTED_QUEUED", event["event_id"], revision, "P2")
        return {"state": "QUEUED", "idempotent_replay": False, "revision": revision}
