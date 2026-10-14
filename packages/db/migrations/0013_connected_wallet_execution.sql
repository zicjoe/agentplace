-- Milestone 9 — Connected Wallet Execution + Transaction Observation
-- Real user-signed execution with durable idempotency, observation and fail-closed unknown-state handling.

CREATE TABLE IF NOT EXISTS transaction_attempt (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  prepared_revision integer NOT NULL,
  action_digest text NOT NULL,
  approval_id text NOT NULL REFERENCES action_approval(id) ON DELETE NO ACTION,
  execution_key text NOT NULL,
  account_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  network_family text NOT NULL,
  network_id text NOT NULL,
  chain_id bigint NOT NULL CHECK (chain_id > 0),
  signer_mode text NOT NULL CHECK (signer_mode='connected-wallet'),
  status text NOT NULL CHECK (status IN (
    'WALLET_PROMPTED',
    'USER_REJECTED',
    'PRE_SUBMISSION_FAILED',
    'SUBMITTED',
    'CONFIRMING',
    'CONFIRMED',
    'REVERTED',
    'MISMATCH',
    'UNKNOWN'
  )),
  from_address text NOT NULL,
  transaction_request jsonb NOT NULL,
  transaction_hash text,
  wallet_prompt_token_hash text,
  wallet_prompted_at timestamptz,
  wallet_prompt_expires_at timestamptz,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  block_number text,
  receipt_status text,
  observation_provider text,
  observation_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, execution_key),
  UNIQUE (owner_user_id, action_id, prepared_revision),
  UNIQUE (owner_user_id, transaction_hash),
  FOREIGN KEY (action_id, prepared_revision) REFERENCES prepared_action_revision(action_id, revision) ON DELETE NO ACTION,
  FOREIGN KEY (account_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS transaction_attempt_owner_status_idx
  ON transaction_attempt(owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS transaction_attempt_observation_idx
  ON transaction_attempt(status, updated_at ASC)
  WHERE status IN ('SUBMITTED','CONFIRMING','UNKNOWN','WALLET_PROMPTED');
