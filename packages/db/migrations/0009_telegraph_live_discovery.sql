-- M5B.2.1 Telegraph live network discovery.
-- Stores the latest normalized public discovery snapshot only. No user wallet authority,
-- payment signer, paid inference, or execution capability is introduced here.

CREATE TABLE IF NOT EXISTS telegraph_discovery_snapshot (
  id text PRIMARY KEY,
  network_environment text NOT NULL CHECK (network_environment IN ('public-testnet','mainnet','custom')),
  node_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','degraded','unavailable')),
  miner_count integer NOT NULL DEFAULT 0 CHECK (miner_count >= 0),
  intent_count integer NOT NULL DEFAULT 0 CHECK (intent_count >= 0),
  miners jsonb NOT NULL DEFAULT '[]'::jsonb,
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  daemon_health jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegraph_discovery_snapshot_updated_idx
  ON telegraph_discovery_snapshot(updated_at DESC);
