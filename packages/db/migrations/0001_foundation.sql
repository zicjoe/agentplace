BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_environment (
  slug text PRIMARY KEY,
  execution_mode text NOT NULL CHECK (execution_mode IN ('development', 'testnet', 'mainnet-readonly', 'mainnet')),
  mainnet_execution_enabled boolean NOT NULL DEFAULT false,
  mainnet_autonomy_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT mainnet_autonomy_enabled OR mainnet_execution_enabled),
  CHECK (execution_mode <> 'mainnet-readonly' OR mainnet_execution_enabled = false)
);

INSERT INTO service_environment (slug, execution_mode, mainnet_execution_enabled, mainnet_autonomy_enabled)
VALUES
  ('development', 'development', false, false),
  ('testnet', 'testnet', false, false),
  ('staging-mainnet-readonly', 'mainnet-readonly', false, false),
  ('production-mainnet', 'mainnet', false, false)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  environment_slug text NOT NULL REFERENCES service_environment(slug),
  trace_id text NOT NULL,
  request_id text,
  actor_type text NOT NULL,
  actor_id text,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_event_trace_idx ON audit_event(trace_id, created_at);
CREATE INDEX IF NOT EXISTS audit_event_aggregate_idx ON audit_event(aggregate_type, aggregate_id, created_at);

CREATE TABLE IF NOT EXISTS outbox_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  environment_slug text NOT NULL REFERENCES service_environment(slug),
  trace_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_event_pending_idx
  ON outbox_event(status, created_at)
  WHERE status IN ('pending', 'failed');

COMMIT;
