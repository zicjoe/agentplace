-- Milestone 8 — Action Preparation + Action Review
-- Durable financial actions, immutable preparation revisions, quotes, preflight/risk evidence,
-- exact-action approvals and separate service-spend reviews. No signing or submission.

CREATE TABLE IF NOT EXISTS financial_action (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text REFERENCES worker_definition(id) ON DELETE SET NULL,
  job_id text,
  account_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  action_type text NOT NULL CHECK (action_type IN ('transfer','swap','bridge')),
  capability_id text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  network_family text NOT NULL,
  network_id text NOT NULL,
  destination_network_family text,
  destination_network_id text,
  asset text NOT NULL,
  asset_address text,
  output_asset text,
  output_asset_address text,
  amount_display text NOT NULL,
  amount_atomic text,
  value_usd numeric(30,8),
  protocol text,
  destination text,
  slippage_bps integer CHECK (slippage_bps IS NULL OR (slippage_bps >= 0 AND slippage_bps <= 5000)),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PREPARED','APPROVAL_REQUIRED','DENIED','READY_FOR_EXECUTION','REJECTED','EXPIRED')),
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (account_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS financial_action_owner_time_idx ON financial_action(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS financial_action_account_idx ON financial_action(owner_user_id, account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS financial_action_worker_idx ON financial_action(owner_user_id, worker_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS prepared_action_revision (
  action_id text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  action_digest text NOT NULL,
  prepared_payload jsonb NOT NULL,
  validation jsonb NOT NULL,
  authority_decision_id text REFERENCES authority_decision(id) ON DELETE NO ACTION,
  authority_decision text NOT NULL CHECK (authority_decision IN ('ALLOWED','APPROVAL_REQUIRED','DENIED')),
  authority_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_status text NOT NULL CHECK (risk_status IN ('PASS','WARNING','FAILED')),
  risk_summary jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, revision),
  UNIQUE(action_digest),
  FOREIGN KEY (action_id, owner_user_id) REFERENCES financial_action(id, owner_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prepared_action_owner_idx ON prepared_action_revision(owner_user_id, action_id, revision DESC);

CREATE OR REPLACE FUNCTION agentplace_guard_prepared_revision_immutable()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'PREPARED_ACTION_REVISION_IMMUTABLE'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS prepared_action_revision_immutable_update ON prepared_action_revision;
CREATE TRIGGER prepared_action_revision_immutable_update BEFORE UPDATE ON prepared_action_revision
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_prepared_revision_immutable();

CREATE TABLE IF NOT EXISTS action_quote (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('AVAILABLE','NOT_AVAILABLE','FAILED')),
  input_amount text,
  estimated_output text,
  minimum_output text,
  estimated_cost text,
  route_summary text,
  raw_evidence jsonb,
  quoted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS action_quote_action_idx ON action_quote(owner_user_id, action_id, prepared_revision DESC);

CREATE TABLE IF NOT EXISTS simulation_result (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('PASSED','FAILED','NOT_AVAILABLE','STALE')),
  method text NOT NULL,
  summary text NOT NULL,
  gas_estimate text,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_assessment (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS','WARNING','FAILED')),
  checks jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_approval (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  action_digest text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED','INVALIDATED','EXPIRED')),
  approval_scope text NOT NULL DEFAULT 'EXACT_ACTION' CHECK (approval_scope='EXACT_ACTION'),
  expires_at timestamptz,
  decided_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  UNIQUE(owner_user_id, action_id, prepared_revision),
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS action_approval_owner_idx ON action_approval(owner_user_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS service_cost_review (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text REFERENCES worker_definition(id) ON DELETE SET NULL,
  job_id text,
  provider text NOT NULL,
  service_description text NOT NULL,
  amount_usd numeric(30,8) NOT NULL CHECK (amount_usd > 0),
  threshold_usd numeric(30,8),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS service_cost_review_owner_idx ON service_cost_review(owner_user_id, created_at DESC);
