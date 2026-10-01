ALTER TABLE capability_implementation
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;
ALTER TABLE capability_implementation
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE capability_implementation
  ADD COLUMN IF NOT EXISTS environment_eligibility jsonb NOT NULL DEFAULT '["development","testnet","staging-mainnet-readonly","production-mainnet"]'::jsonb;

CREATE TABLE IF NOT EXISTS worker_capability_route (
  worker_version_id text NOT NULL REFERENCES worker_version(id) ON DELETE CASCADE,
  canonical_capability_id text NOT NULL REFERENCES canonical_capability(id) ON DELETE CASCADE,
  suitability text NOT NULL DEFAULT 'supporting' CHECK (suitability IN ('primary','supporting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_version_id, canonical_capability_id)
);
CREATE INDEX IF NOT EXISTS worker_capability_route_capability_idx
  ON worker_capability_route(canonical_capability_id, suitability);

CREATE TABLE IF NOT EXISTS route_decision (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES intelligence_task(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  job_id text REFERENCES job(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('routable','partially-routable','blocked')),
  intent_domain text NOT NULL,
  goal text NOT NULL,
  deployment_environment text NOT NULL,
  requested_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_worker_id text NOT NULL REFERENCES worker_definition(id) ON DELETE RESTRICT,
  supporting_worker_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_workers jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_graph jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  unavailable_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  routing_explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, task_id)
);
CREATE INDEX IF NOT EXISTS route_decision_owner_job_idx
  ON route_decision(owner_user_id, job_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS route_decision_owner_conversation_idx
  ON route_decision(owner_user_id, conversation_id, updated_at DESC);

INSERT INTO capability_implementation (
  id,canonical_capability_id,provider,name,version,supported_networks,pricing,trust_status,health_status,
  invocation_kind,known_failure_states,priority,enabled,environment_eligibility
) VALUES
(
  'agentplace-grounded-web-read-v1','research.web.read','agentplace','AgentPlace grounded web read','1',
  '[]','{"metered":false}','tested','healthy','bundled-model-grounded-read','["upstream-provider-unavailable"]',
  10,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'
),
(
  'agentplace-source-extract-v1','research.source.extract','agentplace','AgentPlace source evidence extraction','1',
  '[]','{"metered":false}','tested','healthy','bundled-source-extraction','["no-source-content"]',
  10,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'
)
ON CONFLICT (id) DO UPDATE SET
  version=EXCLUDED.version,
  supported_networks=EXCLUDED.supported_networks,
  pricing=EXCLUDED.pricing,
  trust_status=EXCLUDED.trust_status,
  health_status=EXCLUDED.health_status,
  invocation_kind=EXCLUDED.invocation_kind,
  known_failure_states=EXCLUDED.known_failure_states,
  priority=EXCLUDED.priority,
  enabled=EXCLUDED.enabled,
  environment_eligibility=EXCLUDED.environment_eligibility,
  updated_at=now();

UPDATE capability_implementation
SET priority = CASE provider
  WHEN 'openai' THEN 20
  WHEN 'anthropic' THEN 30
  WHEN 'gemini' THEN 40
  ELSE priority
END,
enabled = true,
environment_eligibility = '["development","testnet","staging-mainnet-readonly","production-mainnet"]'::jsonb,
updated_at = now()
WHERE canonical_capability_id = 'research.web.search';

INSERT INTO worker_capability_route (worker_version_id, canonical_capability_id, suitability) VALUES
('wv-researcher-1','research.web.search','primary'),
('wv-researcher-1','research.web.read','primary'),
('wv-researcher-1','research.source.extract','primary'),
('wv-memescout-1','research.web.search','supporting'),
('wv-memescout-1','research.web.read','supporting'),
('wv-memescout-1','research.source.extract','supporting'),
('wv-memescout-1','token.holders.analyze','primary'),
('wv-memescout-1','wallet.activity.analyze','supporting'),
('wv-smartmoney-1','research.web.search','supporting'),
('wv-smartmoney-1','research.web.read','supporting'),
('wv-smartmoney-1','research.source.extract','supporting'),
('wv-smartmoney-1','wallet.performance.analyze','primary'),
('wv-smartmoney-1','wallet.activity.analyze','primary'),
('wv-portfolio-1','research.web.search','supporting'),
('wv-portfolio-1','research.web.read','supporting'),
('wv-portfolio-1','research.source.extract','supporting'),
('wv-portfolio-1','portfolio.read','primary'),
('wv-execution-1','swap.quote','primary'),
('wv-execution-1','swap.execute','primary'),
('wv-execution-1','bridge.quote','primary'),
('wv-execution-1','bridge.execute','primary')
ON CONFLICT (worker_version_id, canonical_capability_id) DO UPDATE SET
  suitability=EXCLUDED.suitability,
  updated_at=now();
