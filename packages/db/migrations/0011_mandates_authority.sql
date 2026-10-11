-- Milestone 7 — Mandates + Authority Engine
-- Additive, owner-scoped, fail-closed authority policy persistence.

CREATE TABLE IF NOT EXISTS mandate (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text NOT NULL REFERENCES worker_definition(id) ON DELETE RESTRICT,
  account_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','EXPIRED','REVOKED')),
  current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  paused_at timestamptz,
  expired_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (id, owner_user_id),
  FOREIGN KEY (account_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS mandate_owner_worker_account_environment_current_idx
  ON mandate(owner_user_id, worker_id, account_id, environment)
  WHERE status IN ('DRAFT','ACTIVE','PAUSED');
CREATE INDEX IF NOT EXISTS mandate_owner_status_idx
  ON mandate(owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS mandate_account_idx
  ON mandate(owner_user_id, account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS mandate_worker_idx
  ON mandate(owner_user_id, worker_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mandate_revision (
  mandate_id text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  title text NOT NULL,
  purpose text NOT NULL,
  authority_level text NOT NULL CHECK (authority_level IN ('OBSERVE','PREPARE','ACT_WITHIN_MANDATE')),
  allowed_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_scope text NOT NULL DEFAULT 'ALLOW_LIST' CHECK (asset_scope IN ('ANY','ALLOW_LIST')),
  allowed_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  protocol_scope text NOT NULL DEFAULT 'ALLOW_LIST' CHECK (protocol_scope IN ('ANY','ALLOW_LIST')),
  allowed_protocols jsonb NOT NULL DEFAULT '[]'::jsonb,
  destination_scope text NOT NULL DEFAULT 'ALLOW_LIST' CHECK (destination_scope IN ('ANY','ALLOW_LIST')),
  allowed_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  capital_limit_usd numeric(30,8),
  per_action_limit_usd numeric(30,8),
  period_budget_limit_usd numeric(30,8),
  period_budget_period text CHECK (period_budget_period IN ('day','week','month')),
  service_budget_limit_usd numeric(30,8),
  service_budget_period text CHECK (service_budget_period IN ('day','week','month')),
  approval_policy jsonb NOT NULL DEFAULT '{"mode":"ALWAYS","askForNewProtocols":true,"askForNewDestinations":true}'::jsonb,
  borrowing_allowed boolean NOT NULL DEFAULT false,
  leverage_allowed boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  change_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mandate_id, revision),
  FOREIGN KEY (mandate_id, owner_user_id) REFERENCES mandate(id, owner_user_id) ON DELETE CASCADE,
  CHECK (capital_limit_usd IS NULL OR capital_limit_usd > 0),
  CHECK (per_action_limit_usd IS NULL OR per_action_limit_usd > 0),
  CHECK (period_budget_limit_usd IS NULL OR period_budget_limit_usd > 0),
  CHECK (service_budget_limit_usd IS NULL OR service_budget_limit_usd > 0),
  CHECK ((period_budget_limit_usd IS NULL) = (period_budget_period IS NULL)),
  CHECK ((service_budget_limit_usd IS NULL) = (service_budget_period IS NULL)),
  CHECK (jsonb_typeof(allowed_capabilities) = 'array'),
  CHECK (jsonb_typeof(allowed_networks) = 'array'),
  CHECK (jsonb_typeof(allowed_assets) = 'array'),
  CHECK (jsonb_typeof(allowed_protocols) = 'array'),
  CHECK (jsonb_typeof(allowed_destinations) = 'array'),
  CHECK (jsonb_typeof(approval_policy) = 'object'),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS mandate_revision_owner_idx
  ON mandate_revision(owner_user_id, mandate_id, revision DESC);

CREATE OR REPLACE FUNCTION agentplace_guard_mandate_revision_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MANDATE_REVISION_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mandate_revision_immutable_update ON mandate_revision;
CREATE TRIGGER mandate_revision_immutable_update
BEFORE UPDATE ON mandate_revision
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_mandate_revision_immutable();

CREATE OR REPLACE FUNCTION agentplace_guard_mandate_status_transition()
RETURNS trigger AS $$
DECLARE
  v_authority_level text;
  v_allowed_capabilities jsonb;
  v_allowed_networks jsonb;
  v_asset_scope text;
  v_allowed_assets jsonb;
  v_per_action_limit numeric;
  v_period_budget_limit numeric;
  v_period_budget_period text;
  v_valid_until timestamptz;
  v_account_mode text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ACTIVE' THEN
      RAISE EXCEPTION 'MANDATE_MUST_ACTIVATE_AFTER_REVISION';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'REVOKED' AND NEW.status <> 'REVOKED' THEN
    RAISE EXCEPTION 'REVOKED_MANDATE_CANNOT_RESURRECT';
  END IF;
  IF NEW.current_revision < OLD.current_revision THEN
    RAISE EXCEPTION 'MANDATE_REVISION_CANNOT_DECREASE';
  END IF;

  IF NEW.status = 'ACTIVE' AND (OLD.status <> 'ACTIVE' OR NEW.current_revision <> OLD.current_revision) THEN
    SELECT r.authority_level,r.allowed_capabilities,r.allowed_networks,r.asset_scope,r.allowed_assets,
           r.per_action_limit_usd,r.period_budget_limit_usd,r.period_budget_period,r.valid_until,w.mode
      INTO v_authority_level,v_allowed_capabilities,v_allowed_networks,v_asset_scope,v_allowed_assets,
           v_per_action_limit,v_period_budget_limit,v_period_budget_period,v_valid_until,v_account_mode
      FROM mandate_revision r
      JOIN wallet_resource w ON w.id=NEW.account_id AND w.owner_user_id=NEW.owner_user_id
      WHERE r.mandate_id=NEW.id AND r.owner_user_id=NEW.owner_user_id AND r.revision=NEW.current_revision;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MANDATE_ACTIVE_REVISION_MISSING';
    END IF;
    IF jsonb_array_length(v_allowed_capabilities) = 0 OR jsonb_array_length(v_allowed_networks) = 0 THEN
      RAISE EXCEPTION 'MANDATE_ACTIVE_SCOPE_REQUIRED';
    END IF;
    IF v_valid_until IS NOT NULL AND v_valid_until <= now() THEN
      RAISE EXCEPTION 'MANDATE_EXPIRED';
    END IF;
    IF v_authority_level = 'ACT_WITHIN_MANDATE' THEN
      IF v_account_mode <> 'agent-account' THEN
        RAISE EXCEPTION 'ACT_MANDATE_REQUIRES_AGENT_ACCOUNT';
      END IF;
      IF v_asset_scope <> 'ALLOW_LIST' OR jsonb_array_length(v_allowed_assets) = 0 THEN
        RAISE EXCEPTION 'ACT_MANDATE_ASSET_ALLOWLIST_REQUIRED';
      END IF;
      IF v_per_action_limit IS NULL OR v_period_budget_limit IS NULL OR v_period_budget_period IS NULL THEN
        RAISE EXCEPTION 'ACT_MANDATE_HARD_LIMITS_REQUIRED';
      END IF;
      IF v_valid_until IS NULL THEN
        RAISE EXCEPTION 'ACT_MANDATE_EXPIRY_REQUIRED';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mandate_status_transition_guard ON mandate;
CREATE TRIGGER mandate_status_transition_guard
BEFORE INSERT OR UPDATE ON mandate
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_mandate_status_transition();

CREATE TABLE IF NOT EXISTS authority_control_state (
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  autonomous_execution_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, environment)
);

CREATE TABLE IF NOT EXISTS authority_decision (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  mandate_id text,
  mandate_revision integer,
  worker_id text NOT NULL,
  account_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  action_envelope jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ALLOWED','APPROVAL_REQUIRED','DENIED')),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  period_spent_before_usd numeric(30,8) NOT NULL DEFAULT 0,
  evaluated_value_usd numeric(30,8),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mandate_id, owner_user_id) REFERENCES mandate(id, owner_user_id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS authority_decision_owner_time_idx
  ON authority_decision(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authority_decision_mandate_idx
  ON authority_decision(owner_user_id, mandate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authority_decision_worker_idx
  ON authority_decision(owner_user_id, worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_budget_usage (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  mandate_id text NOT NULL,
  mandate_revision integer NOT NULL,
  authority_decision_id text NOT NULL UNIQUE REFERENCES authority_decision(id) ON DELETE NO ACTION,
  value_usd numeric(30,8) NOT NULL CHECK (value_usd > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mandate_id, owner_user_id) REFERENCES mandate(id, owner_user_id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS authority_budget_usage_window_idx
  ON authority_budget_usage(owner_user_id, mandate_id, occurred_at DESC);
