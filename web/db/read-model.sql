-- CarIndex vehicle READ MODEL (S2). Serving projection only — GitHub accepted vehicle view is canonical.
-- Loaded exclusively by the deterministic sync (scripts/sync-vehicle-data.mjs -> loader). Website role is read-only.
-- Additive, non-destructive: each sync inserts a new snapshot; switching is a pointer update; rollback = repoint.
create schema if not exists vehicles_read;

create table if not exists vehicles_read.snapshot (
  snapshot_id       text primary key,          -- e.g. U11-2026-09-26@f994e7f24411
  registry_version  text not null,
  source_repo       text not null,
  source_commit     char(40) not null,
  source_path       text not null,
  source_sha256     char(64) not null,
  synced_at         timestamptz not null default now()
);

create table if not exists vehicles_read.model (
  snapshot_id  text not null references vehicles_read.snapshot(snapshot_id),
  model_id     text not null,                   -- stable "<brand>/<model>"
  public_doc   jsonb not null,                  -- PublicCar shape only (no internal fields)
  primary key (snapshot_id, model_id)
);

create table if not exists vehicles_read.active (
  singleton    boolean primary key default true check (singleton),
  snapshot_id  text not null references vehicles_read.snapshot(snapshot_id),
  switched_at  timestamptz not null default now()
);

-- Least privilege: the web BFF role can only SELECT. No browser/Data-API exposure of this schema.
-- create role web_bff_ro login password '...';  (provisioned via secrets manager, never in repo)
-- grant usage on schema vehicles_read to web_bff_ro;
-- grant select on all tables in schema vehicles_read to web_bff_ro;
-- alter table vehicles_read.model enable row level security;   -- defense in depth
-- create policy read_active on vehicles_read.model for select to web_bff_ro
--   using (snapshot_id = (select snapshot_id from vehicles_read.active));
-- Customer identity lives in a separate database/schema (identity_*), never joined to this one.
