-- M5B.2.3 Telegraph service-payment accounting and replay-safe budget reservation.
-- This ledger accounts only for AgentPlace-owned testnet service spend. It grants no user-wallet or financial execution authority.

CREATE TABLE IF NOT EXISTS telegraph_service_payment (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES intelligence_task(id) ON DELETE CASCADE,
  capability_id text NOT NULL REFERENCES canonical_capability(id) ON DELETE RESTRICT,
  implementation_id text NOT NULL,
  service_id text NOT NULL,
  request_fingerprint text NOT NULL,
  payment_network text NOT NULL CHECK (payment_network = 'eip155:84532'),
  asset_address text NOT NULL,
  pay_to text NOT NULL,
  payer_address text NOT NULL,
  amount_atomic bigint NOT NULL CHECK (amount_atomic > 0),
  status text NOT NULL CHECK (status IN ('reserved','settled','failed','released','unknown')),
  transaction_hash text,
  error_code text,
  settlement_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, job_id, request_fingerprint)
);

CREATE INDEX IF NOT EXISTS telegraph_service_payment_owner_job_idx
  ON telegraph_service_payment(owner_user_id, job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telegraph_service_payment_budget_idx
  ON telegraph_service_payment(owner_user_id, job_id, status)
  WHERE status IN ('reserved','settled','unknown');
