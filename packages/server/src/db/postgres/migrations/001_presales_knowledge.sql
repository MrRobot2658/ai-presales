-- Presales knowledge base schema (PostgreSQL)
-- Applied automatically on first Postgres container start via docker-entrypoint-initdb.d

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE knowledge_asset_status AS ENUM (
  'pending',     -- uploaded, not yet queued for cleaning
  'reviewing',   -- ingest job in progress (UI: 审核中)
  'ready',       -- available for content generation
  'failed',      -- ingest failed
  'archived'     -- soft-deleted / retired
);

CREATE TYPE knowledge_ingest_status AS ENUM (
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE knowledge_ingest_trigger AS ENUM (
  'upload',      -- user submitted upload ticket
  'reprocess',   -- manual or scheduled re-clean
  'agent'        -- Hermes agent initiated
);

-- ---------------------------------------------------------------------------
-- knowledge_assets — canonical document registry (one row per uploaded file)
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile             TEXT NOT NULL DEFAULT 'default',
  uploaded_by         TEXT,
  original_filename   TEXT NOT NULL,
  display_name        TEXT,
  file_type           TEXT NOT NULL,
  mime_type           TEXT,
  file_ext            TEXT,
  size_bytes          BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_path        TEXT NOT NULL,
  storage_bucket      TEXT NOT NULL DEFAULT 'local',
  checksum_sha256     TEXT,
  status              knowledge_asset_status NOT NULL DEFAULT 'pending',
  clean_summary       TEXT,
  ready_at            TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_assets_profile_status
  ON knowledge_assets (profile, status, created_at DESC);

CREATE INDEX idx_knowledge_assets_checksum
  ON knowledge_assets (profile, checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

CREATE UNIQUE INDEX idx_knowledge_assets_profile_storage_path
  ON knowledge_assets (profile, storage_path);

-- ---------------------------------------------------------------------------
-- knowledge_ingest_jobs — upload ticket + cleaning workflow
-- Maps to UI: cleanRequirement, eta, reviewing status
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_ingest_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES knowledge_assets (id) ON DELETE CASCADE,
  profile             TEXT NOT NULL DEFAULT 'default',
  clean_requirement   TEXT NOT NULL DEFAULT '',
  status              knowledge_ingest_status NOT NULL DEFAULT 'queued',
  trigger_type        knowledge_ingest_trigger NOT NULL DEFAULT 'upload',
  priority            SMALLINT NOT NULL DEFAULT 0,
  eta_at              TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  hermes_session_id   TEXT,
  error_message       TEXT,
  result_storage_path TEXT,
  result_preview      TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_ingest_jobs_asset
  ON knowledge_ingest_jobs (asset_id, created_at DESC);

CREATE INDEX idx_knowledge_ingest_jobs_queue
  ON knowledge_ingest_jobs (profile, status, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'processing');

CREATE INDEX idx_knowledge_ingest_jobs_session
  ON knowledge_ingest_jobs (hermes_session_id)
  WHERE hermes_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- knowledge_chunks — parsed segments for retrieval / prompt injection
-- Optional pgvector column can be added in a later migration.
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_chunks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES knowledge_assets (id) ON DELETE CASCADE,
  job_id              UUID REFERENCES knowledge_ingest_jobs (id) ON DELETE SET NULL,
  chunk_index         INTEGER NOT NULL CHECK (chunk_index >= 0),
  heading             TEXT,
  content             TEXT NOT NULL,
  token_count         INTEGER,
  page_from           INTEGER,
  page_to             INTEGER,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_asset
  ON knowledge_chunks (asset_id, chunk_index);

-- Full-text search over chunk content (simple config; switch to zh parser if installed)
CREATE INDEX idx_knowledge_chunks_fts
  ON knowledge_chunks
  USING gin (to_tsvector('simple', coalesce(heading, '') || ' ' || content));

-- ---------------------------------------------------------------------------
-- knowledge_categories — optional taxonomy (product manual, case study, template)
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile             TEXT NOT NULL DEFAULT 'default',
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile, slug)
);

CREATE TABLE knowledge_asset_categories (
  asset_id            UUID NOT NULL REFERENCES knowledge_assets (id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES knowledge_categories (id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, category_id)
);

-- ---------------------------------------------------------------------------
-- knowledge_asset_events — audit trail (upload, status change, agent run)
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_asset_events (
  id                  BIGSERIAL PRIMARY KEY,
  asset_id            UUID NOT NULL REFERENCES knowledge_assets (id) ON DELETE CASCADE,
  job_id              UUID REFERENCES knowledge_ingest_jobs (id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,
  actor_user_id       TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_asset_events_asset
  ON knowledge_asset_events (asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_assets_updated_at
  BEFORE UPDATE ON knowledge_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_knowledge_ingest_jobs_updated_at
  BEFORE UPDATE ON knowledge_ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Views for API list responses (matches current frontend KnowledgeFile shape)
-- ---------------------------------------------------------------------------

CREATE VIEW v_knowledge_assets_list AS
SELECT
  a.id,
  a.profile,
  a.original_filename AS file_name,
  a.file_type,
  a.status,
  a.created_at AS uploaded_at,
  j.clean_requirement,
  j.eta_at AS eta,
  j.status AS ingest_status,
  j.hermes_session_id,
  a.ready_at,
  a.display_name,
  a.size_bytes,
  a.storage_path,
  a.updated_at
FROM knowledge_assets a
LEFT JOIN LATERAL (
  SELECT *
  FROM knowledge_ingest_jobs j
  WHERE j.asset_id = a.id
  ORDER BY j.created_at DESC
  LIMIT 1
) j ON true;

COMMIT;
