CREATE TABLE IF NOT EXISTS wallet_resource (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('watch-only','connected','agent-account')),
  namespace text NOT NULL CHECK (namespace IN ('eip155','solana')),
  address text,
  address_normalized text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected','setup','removed')),
  connection_source text NOT NULL CHECK (connection_source IN ('watch','browser-eip1193','agent-account')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  removed_at timestamptz,
  UNIQUE (id, owner_user_id),
  CHECK (
    (mode = 'agent-account' AND connection_source = 'agent-account')
    OR
    (mode <> 'agent-account' AND address IS NOT NULL AND address_normalized IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_resource_owner_address_mode_idx
  ON wallet_resource(owner_user_id, namespace, address_normalized, mode)
  WHERE removed_at IS NULL AND address_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_resource_owner_status_idx
  ON wallet_resource(owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS wallet_network_state (
  wallet_id text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  network_id text NOT NULL,
  namespace text NOT NULL CHECK (namespace IN ('eip155','solana')),
  chain_reference text NOT NULL,
  address text NOT NULL,
  connection_state text NOT NULL CHECK (connection_state IN ('observed','connected','disconnected')),
  native_balance_atomic text CHECK (native_balance_atomic IS NULL OR native_balance_atomic ~ '^[0-9]{1,100}$'),
  observation_source text NOT NULL CHECK (observation_source IN ('user-supplied','browser-provider','agentplace')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_id, network_id),
  FOREIGN KEY (wallet_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wallet_network_state_owner_idx
  ON wallet_network_state(owner_user_id, network_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS agent_account (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  wallet_id text NOT NULL,
  name text NOT NULL,
  owner_wallet_id text NOT NULL,
  account_standard text NOT NULL DEFAULT 'unassigned' CHECK (account_standard IN ('unassigned','erc-4337','solana-program-account')),
  lifecycle_status text NOT NULL DEFAULT 'setup' CHECK (lifecycle_status IN ('setup','ready-for-deployment','deployed','limited','paused','failed')),
  deployment_status text NOT NULL DEFAULT 'not-deployed' CHECK (deployment_status IN ('not-deployed','deploying','deployed','failed')),
  account_address text,
  preferred_network_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, wallet_id),
  FOREIGN KEY (wallet_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE CASCADE,
  FOREIGN KEY (owner_wallet_id, owner_user_id) REFERENCES wallet_resource(id, owner_user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS agent_account_owner_idx
  ON agent_account(owner_user_id, created_at DESC);
