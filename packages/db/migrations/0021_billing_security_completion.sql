-- M13 Billing + Security Completion
-- Durable service accounting, commercial entitlements, creator revenue attribution,
-- testnet-only service funding evidence and security quarantine/control records.
-- Service balances are separate from wallet/Agent Account capital and never create authority.

CREATE TABLE IF NOT EXISTS billing_account (
  owner_user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free','pro','builder')),
  monthly_variable_limit_cents bigint NOT NULL DEFAULT 2500 CHECK (monthly_variable_limit_cents >= 0),
  single_job_threshold_cents bigint NOT NULL DEFAULT 500 CHECK (single_job_threshold_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_ledger_entry (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  category text NOT NULL CHECK (category IN (
    'service-topup','agentplace-service','external-worker','external-capability','external-provider','subscription','refund','adjustment'
  )),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  description text NOT NULL,
  paid_by text NOT NULL CHECK (paid_by IN ('service-balance','included-in-plan','user-wallet','covered-by-agentplace','external-subscription')),
  source_type text NOT NULL,
  source_id text NOT NULL,
  job_id text,
  routine_id text,
  worker_id text,
  creator_asset_type text CHECK (creator_asset_type IS NULL OR creator_asset_type IN ('worker','workflow','capability')),
  creator_asset_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS billing_ledger_owner_time_idx ON billing_ledger_entry(owner_user_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS billing_ledger_job_idx ON billing_ledger_entry(owner_user_id,job_id,occurred_at DESC) WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_usage_event (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('agentplace-service','external-worker','external-capability','external-provider','onchain-gas','bridge-fee','protocol-fee','subscription')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  description text NOT NULL,
  paid_by text NOT NULL CHECK (paid_by IN ('service-balance','included-in-plan','user-wallet','agent-account','covered-by-agentplace','external-subscription')),
  job_id text,
  routine_id text,
  worker_id text,
  creator_asset_type text CHECK (creator_asset_type IS NULL OR creator_asset_type IN ('worker','workflow','capability')),
  creator_asset_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS billing_usage_owner_time_idx ON billing_usage_event(owner_user_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS billing_usage_job_idx ON billing_usage_event(owner_user_id,job_id,occurred_at DESC) WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketplace_offer (
  id text PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN ('worker','workflow','capability')),
  asset_id text NOT NULL,
  creator_user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  pricing_model text NOT NULL CHECK (pricing_model IN ('free','monthly','one-time','per-invocation')),
  price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_type,asset_id)
);
CREATE INDEX IF NOT EXISTS marketplace_offer_creator_idx ON marketplace_offer(creator_user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_entitlement (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES marketplace_offer(id) ON DELETE RESTRICT,
  asset_type text NOT NULL CHECK (asset_type IN ('worker','workflow','capability')),
  asset_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','revoked')),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(owner_user_id,asset_type,asset_id)
);
CREATE INDEX IF NOT EXISTS marketplace_entitlement_owner_idx ON marketplace_entitlement(owner_user_id,status,acquired_at DESC);

CREATE TABLE IF NOT EXISTS billing_subscription (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  entitlement_id text NOT NULL REFERENCES marketplace_entitlement(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES marketplace_offer(id) ON DELETE RESTRICT,
  price_cents bigint NOT NULL CHECK (price_cents > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past-due','pending-cancel','cancelled')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,entitlement_id)
);
CREATE INDEX IF NOT EXISTS billing_subscription_owner_idx ON billing_subscription(owner_user_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS creator_revenue_entry (
  id text PRIMARY KEY,
  creator_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('worker','workflow','capability')),
  asset_id text NOT NULL,
  entitlement_id text REFERENCES marketplace_entitlement(id) ON DELETE SET NULL,
  subscription_id text REFERENCES billing_subscription(id) ON DELETE SET NULL,
  job_id text,
  gross_cents bigint NOT NULL CHECK (gross_cents >= 0),
  creator_payable_cents bigint,
  platform_share_cents bigint,
  allocation_status text NOT NULL DEFAULT 'unallocated' CHECK (allocation_status IN ('unallocated','allocated')),
  payout_status text NOT NULL DEFAULT 'not-payable-yet' CHECK (payout_status IN ('not-payable-yet','pending','settled')),
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS creator_revenue_creator_time_idx ON creator_revenue_entry(creator_user_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS billing_service_payment (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  wallet_id text NOT NULL,
  environment text NOT NULL DEFAULT 'testnet' CHECK (environment='testnet'),
  network_id text NOT NULL CHECK (network_id='arbitrum-sepolia'),
  chain_id bigint NOT NULL CHECK (chain_id=421614),
  asset_symbol text NOT NULL DEFAULT 'USDC' CHECK (asset_symbol='USDC'),
  asset_address text NOT NULL,
  treasury_address text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  amount_atomic text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  transaction_hash text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE(owner_user_id,transaction_hash),
  FOREIGN KEY(wallet_id,owner_user_id) REFERENCES wallet_resource(id,owner_user_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS billing_service_payment_owner_idx ON billing_service_payment(owner_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS security_quarantine (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('worker','capability')),
  target_id text NOT NULL,
  reason text NOT NULL,
  previous_trust_status text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS security_quarantine_active_target_idx ON security_quarantine(owner_user_id,target_type,target_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS security_quarantine_owner_idx ON security_quarantine(owner_user_id,status,created_at DESC);
