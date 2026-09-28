-- P2 Data Readiness Factory: observation / provenance staging contract (v0.1, 2026-09-28)
-- NON-PRODUCTION. SQLite. Nothing here is canonical automotive data.
-- Implements LIVING_DATA_ARCHITECTURE.md L0 (sources), L1 (evidence + observations),
-- review/conflict/promotion gates. L2 identity uses P1 universe slugs as PROVISIONAL model_id
-- (see CONTRACT.md §3) rather than inventing a second ID scheme.

PRAGMA foreign_keys = ON;

-- L0: source registry. Tier per CONTRACT.md §4.
CREATE TABLE IF NOT EXISTS sources (
  source_id      TEXT PRIMARY KEY,          -- e.g. nissan_eg_web
  name           TEXT NOT NULL,
  family         TEXT NOT NULL,             -- vehicle_spec_price | registration | news
  domain         TEXT,
  tier           INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
  market_scope   TEXT NOT NULL CHECK (market_scope IN ('egypt','regional','global')),
  access_notes   TEXT,                      -- robots.txt / ToS / auth notes
  status         TEXT NOT NULL              -- active | one_time | disabled | blocked
);

-- L1a: evidence artifacts. One row per fetched page / file, hashed. Immutable.
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id    TEXT PRIMARY KEY,          -- sha256 prefix of content
  source_id      TEXT NOT NULL REFERENCES sources(source_id),
  locator        TEXT NOT NULL,             -- URL or Drive path
  kind           TEXT NOT NULL,             -- html | pdf | csv_row | json
  retrieved_at   TEXT NOT NULL,             -- ISO-8601 UTC
  sha256         TEXT NOT NULL,
  bytes          INTEGER,
  source_updated_at TEXT,                   -- what the source says (e.g. Nissan Updated_On); NULL if absent
  batch_id       TEXT NOT NULL,
  note           TEXT
);

-- L1b: observations. Exactly what one piece of evidence said about one field. Append-only.
CREATE TABLE IF NOT EXISTS observations (
  observation_id   TEXT PRIMARY KEY,        -- deterministic hash, re-runs never duplicate
  batch_id         TEXT NOT NULL,
  evidence_id      TEXT NOT NULL REFERENCES evidence(evidence_id),
  evidence_pointer TEXT,                    -- JSON path / page / row index inside the evidence
  source_id        TEXT NOT NULL REFERENCES sources(source_id),
  source_tier      INTEGER NOT NULL,
  market_scope     TEXT NOT NULL,
  brand_raw        TEXT NOT NULL,
  model_raw        TEXT NOT NULL,
  trim_raw         TEXT,                    -- NULL = model-level observation
  model_year       INTEGER,                 -- NULL when the source does not state it (never guessed)
  model_id         TEXT,                    -- PROVISIONAL (P1 universe slug) or NULL = IDENTITY_UNKNOWN
  trim_key         TEXT,                    -- deterministic normalisation of trim_raw
  identity_confidence TEXT CHECK (identity_confidence IN ('HIGH','MEDIUM','LOW','NONE')),
  field            TEXT NOT NULL,           -- controlled vocabulary, CONTRACT.md §2
  value_raw        TEXT,
  value_num        REAL,
  unit             TEXT,
  value_status     TEXT NOT NULL,           -- OK | NOT_PUBLISHED | COMING_SOON | PARSE_FAILED | RANGE
  observed_at      TEXT NOT NULL,           -- when CarIndex saw it
  effective_date   TEXT,                    -- when the source says it applies; NEVER back-filled
  extraction_method TEXT NOT NULL,          -- recipe id + version, e.g. nissan_eg_vlp_json@1
  extraction_kind  TEXT NOT NULL CHECK (extraction_kind IN ('deterministic','ai_assisted','manual','legacy_unknown')),
  confidence       TEXT NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  verification_state TEXT NOT NULL CHECK (verification_state IN
      ('observed','validated','corroborated','t1_verified','rejected')),
  conflict_state   TEXT NOT NULL DEFAULT 'none' CHECK (conflict_state IN ('none','open','resolved')),
  promotion_state  TEXT NOT NULL DEFAULT 'not_candidate' CHECK (promotion_state IN
      ('not_candidate','candidate','blocked','promoted')),
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS obs_series ON observations(model_id, trim_key, field, source_id);

-- Conflicts: kept visible, never silently resolved.
CREATE TABLE IF NOT EXISTS conflicts (
  conflict_id    TEXT PRIMARY KEY,
  batch_id       TEXT NOT NULL,
  model_id       TEXT,
  trim_key       TEXT,
  field          TEXT NOT NULL,
  conflict_type  TEXT NOT NULL,             -- VALUE | MODEL_YEAR | TRIM_ONLY_IN_T1 | TRIM_ONLY_IN_CONSUMER | IDENTITY | MARKET_SCOPE
  observation_ids TEXT NOT NULL,            -- JSON array
  values_summary TEXT NOT NULL,
  rule_outcome   TEXT,                      -- what the tier rule would pick (advisory only)
  state          TEXT NOT NULL DEFAULT 'open',
  route          TEXT NOT NULL              -- deterministic | ai_exception | human_review
);

-- Promotion candidates: proposals only. Promotion to canonical is a governed, separate act.
CREATE TABLE IF NOT EXISTS promotion_candidates (
  candidate_id   TEXT PRIMARY KEY,
  batch_id       TEXT NOT NULL,
  model_id       TEXT NOT NULL,
  trim_key       TEXT,
  field          TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  current_consumer_value TEXT,              -- what P1 universe currently shows (NULL = absent)
  change_type    TEXT NOT NULL,             -- CONFIRM | CORRECT | ADD | FLAG_STALE
  supporting_observation_ids TEXT NOT NULL,
  gate           TEXT NOT NULL,             -- who/what must approve
  state          TEXT NOT NULL DEFAULT 'pending'
);

-- Exceptions routed away from deterministic processing.
CREATE TABLE IF NOT EXISTS exceptions (
  exception_id   TEXT PRIMARY KEY,
  batch_id       TEXT NOT NULL,
  kind           TEXT NOT NULL,             -- STOP_CONDITION | IDENTITY_UNKNOWN | UNSTRUCTURED_SOURCE | AI_NEEDED
  subject        TEXT NOT NULL,
  detail         TEXT NOT NULL,
  route          TEXT NOT NULL
);

-- Readiness measurements, one row per KPI per run.
CREATE TABLE IF NOT EXISTS readiness_runs (
  run_id TEXT, phase TEXT, scope TEXT, kpi TEXT, numerator REAL, denominator REAL,
  value REAL, status TEXT, definition TEXT,
  PRIMARY KEY (run_id, phase, scope, kpi)
);
