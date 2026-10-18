-- M12 Discover + Creator System
-- Creator assets are durable, versioned and owner-scoped. Public discovery is a projection,
-- not a grant of authority or a route into the trusted capability registry.

CREATE TABLE IF NOT EXISTS workflow_definition (
  id text PRIMARY KEY,
  creator_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text NOT NULL,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','tested','private','unlisted','published','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_version (
  id text PRIMARY KEY,
  workflow_definition_id text NOT NULL REFERENCES workflow_definition(id) ON DELETE CASCADE,
  version text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_boundaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  compatible_workers jsonb NOT NULL DEFAULT '[]'::jsonb,
  released_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE(workflow_definition_id, version)
);

CREATE TABLE IF NOT EXISTS creator_capability (
  id text PRIMARY KEY,
  creator_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  import_type text NOT NULL CHECK (import_type IN ('mcp','openapi')),
  endpoint text,
  provider text,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','tested','private','unlisted','published','retired')),
  trust_status text NOT NULL DEFAULT 'creator-imported' CHECK (trust_status IN ('creator-imported','sandbox-tested','quarantined','promoted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_capability_version (
  id text PRIMARY KEY,
  creator_capability_id text NOT NULL REFERENCES creator_capability(id) ON DELETE CASCADE,
  version text NOT NULL,
  source_digest text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  released_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE(creator_capability_id, version)
);

CREATE TABLE IF NOT EXISTS creator_capability_operation (
  id text PRIMARY KEY,
  creator_capability_version_id text NOT NULL REFERENCES creator_capability_version(id) ON DELETE CASCADE,
  original_operation text NOT NULL,
  canonical_capability_id text,
  classification text NOT NULL CHECK (classification IN ('read','prepare','execution-sensitive')),
  description text NOT NULL,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_eligibility text NOT NULL DEFAULT 'metadata-only' CHECK (runtime_eligibility IN ('metadata-only','sandbox-read','blocked')),
  UNIQUE(creator_capability_version_id, original_operation)
);

CREATE TABLE IF NOT EXISTS creator_test_run (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('worker','workflow','capability')),
  asset_id text NOT NULL,
  version_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','passed','failed','partial')),
  passed_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS creator_test_result (
  id text PRIMARY KEY,
  test_run_id text NOT NULL REFERENCES creator_test_run(id) ON DELETE CASCADE,
  name text NOT NULL,
  scenario text NOT NULL,
  expected text NOT NULL,
  passed boolean NOT NULL,
  observed text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS creator_lineage (
  child_type text NOT NULL CHECK (child_type IN ('worker','workflow','capability')),
  child_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('worker','workflow','capability')),
  source_id text NOT NULL,
  source_version_id text,
  source_name text NOT NULL,
  source_creator text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(child_type, child_id)
);

CREATE TABLE IF NOT EXISTS marketplace_listing (
  id text PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN ('worker','workflow','capability')),
  asset_id text NOT NULL,
  creator_user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  creator_name text NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('unlisted','public')),
  pricing_type text NOT NULL DEFAULT 'free' CHECK (pricing_type IN ('free','paid')),
  pricing_label text,
  sponsored boolean NOT NULL DEFAULT false,
  version text NOT NULL,
  authority_default text,
  networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE(asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listing_public_idx ON marketplace_listing(visibility, retired_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS workflow_creator_idx ON workflow_definition(creator_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_capability_creator_idx ON creator_capability(creator_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_test_owner_idx ON creator_test_run(owner_user_id, created_at DESC);

-- Release lifecycle is explicit: released versions are immutable.
CREATE OR REPLACE FUNCTION agentplace_prevent_released_worker_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.released_at IS NOT NULL AND (NEW.instructions IS DISTINCT FROM OLD.instructions OR NEW.default_autonomy IS DISTINCT FROM OLD.default_autonomy OR NEW.capability_requirements IS DISTINCT FROM OLD.capability_requirements OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'released worker versions are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS worker_version_immutable_release ON worker_version;
CREATE TRIGGER worker_version_immutable_release BEFORE UPDATE ON worker_version
FOR EACH ROW EXECUTE FUNCTION agentplace_prevent_released_worker_version_update();

-- Jobs pin the exact Worker version used for reproducibility. Existing Jobs are
-- backfilled to the latest version that existed when this migration lands;
-- all new Jobs capture the selected installed/latest version at creation time.
ALTER TABLE job_worker ADD COLUMN IF NOT EXISTS worker_version_id text;
UPDATE job_worker jw
SET worker_version_id = (
  SELECT wv.id
  FROM worker_version wv
  WHERE wv.worker_definition_id = jw.worker_id AND wv.retired_at IS NULL
  ORDER BY wv.released_at DESC, wv.id DESC
  LIMIT 1
)
WHERE jw.worker_version_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_worker_version_fk') THEN
    ALTER TABLE job_worker ADD CONSTRAINT job_worker_version_fk FOREIGN KEY(worker_version_id) REFERENCES worker_version(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE job_worker ALTER COLUMN worker_version_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS job_worker_version_idx ON job_worker(worker_version_id);

CREATE OR REPLACE FUNCTION agentplace_prevent_released_workflow_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.released_at IS NOT NULL AND ROW(NEW.version,NEW.inputs,NEW.steps,NEW.conditions,NEW.outputs,NEW.required_capabilities,NEW.safety_boundaries,NEW.compatible_workers)
    IS DISTINCT FROM ROW(OLD.version,OLD.inputs,OLD.steps,OLD.conditions,OLD.outputs,OLD.required_capabilities,OLD.safety_boundaries,OLD.compatible_workers) THEN
    RAISE EXCEPTION 'released workflow versions are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS workflow_version_immutable_release ON workflow_version;
CREATE TRIGGER workflow_version_immutable_release BEFORE UPDATE ON workflow_version
FOR EACH ROW EXECUTE FUNCTION agentplace_prevent_released_workflow_version_update();

CREATE OR REPLACE FUNCTION agentplace_prevent_released_creator_capability_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.released_at IS NOT NULL AND ROW(NEW.version,NEW.source_digest,NEW.source_metadata)
    IS DISTINCT FROM ROW(OLD.version,OLD.source_digest,OLD.source_metadata) THEN
    RAISE EXCEPTION 'released creator capability versions are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creator_capability_version_immutable_release ON creator_capability_version;
CREATE TRIGGER creator_capability_version_immutable_release BEFORE UPDATE ON creator_capability_version
FOR EACH ROW EXECUTE FUNCTION agentplace_prevent_released_creator_capability_version_update();
