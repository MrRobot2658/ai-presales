-- Presales multi-tenant schema (PostgreSQL)
-- Maps: 1 tenant = 1 Hermes profile; 1 tenant = N Web UI accounts
-- Run after 001_presales_knowledge.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE tenant_status AS ENUM (
  'provisioning',  -- Hermes profile being created
  'active',
  'suspended',
  'archived'
);

CREATE TYPE tenant_account_role AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE tenant_account_status AS ENUM (
  'active',
  'invited',
  'disabled'
);

CREATE TYPE hermes_sync_status AS ENUM (
  'pending',     -- not yet copied into Hermes profile dir
  'synced',      -- file exists under profile knowledge/
  'failed',
  'skipped'      -- metadata-only, no file copy needed
);

-- ---------------------------------------------------------------------------
-- tenants — business tenant; 1:1 with a Hermes Agent profile
-- ---------------------------------------------------------------------------
-- Hermes has NO native "tenant" concept. Isolation is via:
--   ~/.hermes/                          (profile "default")
--   ~/.hermes/profiles/{profile_name}/  (named profiles)
-- Web UI ACL: SQLite user_profiles (user_id ↔ profile_name, many-to-many)
--
-- Presales adds tenants in PG as the business layer; hermes_profile_name is
-- the bridge field used by BFF + Hermes CLI + X-Hermes-Profile header.

CREATE TABLE tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  hermes_profile_name   TEXT NOT NULL,
  status                tenant_status NOT NULL DEFAULT 'provisioning',
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  provisioned_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$'),
  CONSTRAINT tenants_hermes_profile_format CHECK (hermes_profile_name ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$')
);

CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug);
CREATE UNIQUE INDEX idx_tenants_hermes_profile ON tenants (hermes_profile_name);
CREATE INDEX idx_tenants_status ON tenants (status, created_at DESC);

COMMENT ON TABLE tenants IS 'Business tenant; exactly one Hermes Agent profile per row.';
COMMENT ON COLUMN tenants.hermes_profile_name IS 'Hermes profile name (NOT default). Maps to ~/.hermes/profiles/{name}/ or default when name is default.';
COMMENT ON COLUMN tenants.slug IS 'URL-safe tenant key; often used as profile name prefix tenant-{slug}.';

-- ---------------------------------------------------------------------------
-- tenant_accounts — login accounts under a tenant (N accounts : 1 tenant)
-- ---------------------------------------------------------------------------
-- Links to Web UI auth in SQLite (users.id). Cross-database reference only;
-- enforced by application layer, not a PG foreign key.

CREATE TABLE tenant_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  webui_user_id         INTEGER NOT NULL,
  username              TEXT NOT NULL,
  display_name          TEXT,
  email                 TEXT,
  role                  tenant_account_role NOT NULL DEFAULT 'member',
  status                tenant_account_status NOT NULL DEFAULT 'active',
  is_tenant_owner       BOOLEAN NOT NULL DEFAULT false,
  invited_by_account_id UUID REFERENCES tenant_accounts (id) ON DELETE SET NULL,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, webui_user_id)
);

CREATE INDEX idx_tenant_accounts_webui_user ON tenant_accounts (webui_user_id, status);
CREATE INDEX idx_tenant_accounts_tenant ON tenant_accounts (tenant_id, role, status);

COMMENT ON TABLE tenant_accounts IS 'Tenant membership; webui_user_id references SQLite users.id in Web UI DB.';
COMMENT ON COLUMN tenant_accounts.webui_user_id IS 'Hermes Web UI users.id (SQLite). BFF syncs user_profiles on provision.';

-- ---------------------------------------------------------------------------
-- tenant_account_sessions — optional: track active tenant context per login
-- ---------------------------------------------------------------------------

CREATE TABLE tenant_account_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_account_id     UUID NOT NULL REFERENCES tenant_accounts (id) ON DELETE CASCADE,
  session_token_hash    TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ
);

CREATE INDEX idx_tenant_account_sessions_account
  ON tenant_account_sessions (tenant_account_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Extend knowledge tables — tenant-scoped + Hermes profile file paths
-- ---------------------------------------------------------------------------

ALTER TABLE knowledge_assets
  ADD COLUMN tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE,
  ADD COLUMN hermes_profile_rel_path TEXT,
  ADD COLUMN hermes_sync_status hermes_sync_status NOT NULL DEFAULT 'pending',
  ADD COLUMN hermes_synced_at TIMESTAMPTZ,
  ADD COLUMN uploaded_by_account_id UUID REFERENCES tenant_accounts (id) ON DELETE SET NULL;

ALTER TABLE knowledge_ingest_jobs
  ADD COLUMN tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE;

ALTER TABLE knowledge_categories
  ADD COLUMN tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE;

-- Drop profile-scoped unique index; replace with tenant-scoped
DROP INDEX IF EXISTS idx_knowledge_assets_profile_storage_path;
CREATE UNIQUE INDEX idx_knowledge_assets_tenant_storage_path
  ON knowledge_assets (tenant_id, storage_path)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_knowledge_assets_tenant_status
  ON knowledge_assets (tenant_id, status, created_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_knowledge_ingest_jobs_tenant_queue
  ON knowledge_ingest_jobs (tenant_id, status, priority DESC, created_at ASC)
  WHERE tenant_id IS NOT NULL;

-- Relax categories unique: per tenant
ALTER TABLE knowledge_categories DROP CONSTRAINT IF EXISTS knowledge_categories_profile_slug_key;
CREATE UNIQUE INDEX idx_knowledge_categories_tenant_slug
  ON knowledge_categories (tenant_id, slug)
  WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenant_accounts_updated_at
  BEFORE UPDATE ON tenant_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS v_knowledge_assets_list;

CREATE VIEW v_knowledge_assets_list AS
SELECT
  a.id,
  a.tenant_id,
  t.name AS tenant_name,
  t.hermes_profile_name AS profile,
  a.original_filename AS file_name,
  a.file_type,
  a.status,
  a.created_at AS uploaded_at,
  a.hermes_profile_rel_path,
  a.hermes_sync_status,
  a.hermes_synced_at,
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
LEFT JOIN tenants t ON t.id = a.tenant_id
LEFT JOIN LATERAL (
  SELECT *
  FROM knowledge_ingest_jobs j
  WHERE j.asset_id = a.id
  ORDER BY j.created_at DESC
  LIMIT 1
) j ON true;

CREATE OR REPLACE VIEW v_tenant_accounts_list AS
SELECT
  ta.id AS account_id,
  ta.tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.hermes_profile_name,
  t.status AS tenant_status,
  ta.webui_user_id,
  ta.username,
  ta.display_name,
  ta.email,
  ta.role,
  ta.status AS account_status,
  ta.is_tenant_owner,
  ta.last_login_at,
  ta.created_at
FROM tenant_accounts ta
JOIN tenants t ON t.id = ta.tenant_id;

COMMIT;
