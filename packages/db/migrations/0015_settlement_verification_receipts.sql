-- Milestone 10 — Settlement Verification + Verified Outcomes + Verified Receipts
-- Deterministic post-confirmation verification, immutable verified outcomes/receipts,
-- exact gas accounting, and an asynchronous proof queue. No signing key is introduced.

CREATE TABLE IF NOT EXISTS verification_contract (
  id text PRIMARY KEY,
  capability_id text NOT NULL REFERENCES canonical_capability(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  network_family text NOT NULL,
  verifier_kind text NOT NULL,
  rules jsonb NOT NULL,
  code_digest text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, version, network_family)
);

INSERT INTO verification_contract (
  id, capability_id, version, network_family, verifier_kind, rules, code_digest, status
) VALUES (
  'vc_asset_transfer_evm_v1',
  'asset.transfer',
  1,
  'eip155',
  'evm-transfer-v1',
  '{"lineage":["prepared-revision","action-digest","exact-approval"],"native":["chain","sender","recipient","value","empty-calldata","successful-receipt"],"erc20":["chain","sender","token-contract","transfer-calldata","recipient","amount","transfer-event","successful-receipt"],"costs":["gas-used","effective-gas-price"]}'::jsonb,
  'sha256:d6ddfa267b53a60e01428159f685b9c62aa9601006dc047093c1041b26faa7c2',
  'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION agentplace_guard_verification_contract_immutable()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'VERIFICATION_CONTRACT_IMMUTABLE'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS verification_contract_immutable_update ON verification_contract;
CREATE TRIGGER verification_contract_immutable_update BEFORE UPDATE ON verification_contract
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_verification_contract_immutable();

CREATE TABLE IF NOT EXISTS settlement_observation (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  transaction_attempt_id text NOT NULL REFERENCES transaction_attempt(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  verification_contract_id text NOT NULL REFERENCES verification_contract(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('VERIFYING','VERIFIED','NOT_VERIFIED','UNKNOWN','PARTIAL')),
  retryable boolean NOT NULL DEFAULT true,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_check_at timestamptz,
  lease_until timestamptz,
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  transaction_hash text NOT NULL,
  block_number text,
  block_hash text,
  observed_from text,
  observed_to text,
  observed_value_atomic text,
  observed_input text,
  receipt_status text,
  gas_used text,
  effective_gas_price text,
  gas_cost_atomic text,
  gas_asset text,
  relevant_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  rpc_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash text,
  reason_code text,
  reason_summary text,
  first_checked_at timestamptz,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, transaction_attempt_id, verification_contract_id),
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS settlement_observation_retry_idx
  ON settlement_observation(status, next_check_at, lease_until)
  WHERE status IN ('VERIFYING','UNKNOWN');
CREATE INDEX IF NOT EXISTS settlement_observation_owner_idx
  ON settlement_observation(owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS verified_outcome (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  transaction_attempt_id text NOT NULL REFERENCES transaction_attempt(id) ON DELETE NO ACTION,
  action_id text NOT NULL,
  job_id text,
  verification_contract_id text NOT NULL REFERENCES verification_contract(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('VERIFIED','NOT_VERIFIED','PARTIAL')),
  expected_outcome jsonb NOT NULL,
  actual_outcome jsonb NOT NULL,
  checks jsonb NOT NULL,
  evidence_hash text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, transaction_attempt_id, verification_contract_id),
  FOREIGN KEY (action_id, owner_user_id) REFERENCES financial_action(id, owner_user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS verified_outcome_owner_idx
  ON verified_outcome(owner_user_id, verified_at DESC);

CREATE OR REPLACE FUNCTION agentplace_guard_verified_outcome_immutable()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'VERIFIED_OUTCOME_IMMUTABLE'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS verified_outcome_immutable_update ON verified_outcome;
CREATE TRIGGER verified_outcome_immutable_update BEFORE UPDATE ON verified_outcome
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_verified_outcome_immutable();

CREATE TABLE IF NOT EXISTS verified_receipt (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  verified_outcome_id text NOT NULL REFERENCES verified_outcome(id) ON DELETE NO ACTION,
  transaction_attempt_id text NOT NULL REFERENCES transaction_attempt(id) ON DELETE NO ACTION,
  action_id text NOT NULL,
  job_id text,
  receipt_version integer NOT NULL DEFAULT 1 CHECK (receipt_version = 1),
  user_goal text NOT NULL,
  worker_id text,
  worker_name text NOT NULL,
  worker_attribution text NOT NULL CHECK (worker_attribution IN ('explicit','execution-path-default')),
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  network_family text NOT NULL,
  network_id text NOT NULL,
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  receipt_core jsonb NOT NULL,
  receipt_salt text NOT NULL,
  receipt_commitment text NOT NULL UNIQUE,
  evidence_root text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, verified_outcome_id),
  UNIQUE (owner_user_id, transaction_attempt_id),
  FOREIGN KEY (action_id, owner_user_id) REFERENCES financial_action(id, owner_user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS verified_receipt_owner_idx
  ON verified_receipt(owner_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION agentplace_guard_verified_receipt_immutable()
RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'VERIFIED_RECEIPT_IMMUTABLE'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS verified_receipt_immutable_update ON verified_receipt;
CREATE TRIGGER verified_receipt_immutable_update BEFORE UPDATE ON verified_receipt
FOR EACH ROW EXECUTE FUNCTION agentplace_guard_verified_receipt_immutable();

CREATE TABLE IF NOT EXISTS proof_anchor_queue (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  receipt_id text NOT NULL REFERENCES verified_receipt(id) ON DELETE NO ACTION,
  receipt_commitment text NOT NULL,
  subject_commitment text NOT NULL,
  evidence_root text NOT NULL,
  target_network_family text NOT NULL DEFAULT 'eip155',
  target_network_id text NOT NULL DEFAULT 'arbitrum',
  target_chain_id bigint NOT NULL DEFAULT 42161 CHECK (target_chain_id > 0),
  anchor_mode text NOT NULL DEFAULT 'BATCH' CHECK (anchor_mode='BATCH'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','BATCHED','ANCHORING','ANCHORED','FAILED')),
  batch_id text,
  anchor_transaction_hash text,
  anchor_block_number text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  anchored_at timestamptz,
  UNIQUE (owner_user_id, receipt_id),
  UNIQUE (receipt_commitment)
);
CREATE INDEX IF NOT EXISTS proof_anchor_queue_pending_idx
  ON proof_anchor_queue(status, queued_at ASC)
  WHERE status IN ('PENDING','FAILED');
