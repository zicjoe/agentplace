CREATE TABLE IF NOT EXISTS worker_definition (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  origin text NOT NULL CHECK (origin IN ('agentplace-original', 'community', 'custom')),
  creator_user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  creator_name text NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL,
  responsibility text NOT NULL,
  category text NOT NULL,
  publication_status text NOT NULL DEFAULT 'published' CHECK (publication_status IN ('draft', 'private', 'unlisted', 'published', 'retired')),
  trust_status text NOT NULL DEFAULT 'unverified' CHECK (trust_status IN ('agentplace', 'verified', 'unverified', 'quarantined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_version (
  id text PRIMARY KEY,
  worker_definition_id text NOT NULL REFERENCES worker_definition(id) ON DELETE CASCADE,
  version text NOT NULL,
  instructions text,
  default_autonomy text NOT NULL,
  capability_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  released_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE(worker_definition_id, version)
);

CREATE TABLE IF NOT EXISTS job_contract (
  worker_version_id text PRIMARY KEY REFERENCES worker_version(id) ON DELETE CASCADE,
  mission text NOT NULL,
  responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  anti_jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_approval_boundary text NOT NULL,
  default_capability_requirements jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS user_worker (
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  id text NOT NULL,
  worker_definition_id text NOT NULL REFERENCES worker_definition(id),
  worker_version_id text NOT NULL REFERENCES worker_version(id),
  status text NOT NULL DEFAULT 'standby' CHECK (status IN ('working', 'monitoring', 'standby', 'needs-you', 'paused', 'limited', 'blocked', 'issue', 'removed')),
  current_focus text,
  current_job_id text,
  primary_conversation_id text,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY (owner_user_id, id),
  UNIQUE(owner_user_id, worker_definition_id)
);

CREATE INDEX IF NOT EXISTS user_worker_owner_status_idx ON user_worker(owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS job (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  title text NOT NULL,
  goal text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'PLANNED','RUNNING','PREPARING','AWAITING_APPROVAL','AUTHORIZED','SUBMITTED','CONFIRMING','SETTLING','VERIFYING','COMPLETED','RECOVERING','PAUSED','BLOCKED','FAILED_RECOVERABLE','FAILED_FINAL','REQUIRES_USER'
  )),
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  kind text NOT NULL DEFAULT 'research' CHECK (kind IN ('research','operational','financial')),
  origin_type text NOT NULL DEFAULT 'user' CHECK (origin_type IN ('user','worker','routine','agentplace')),
  origin_worker_id text,
  origin_conversation_id text,
  job_conversation_id text,
  current_stage text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_owner_status_idx ON job(owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS job_worker (
  job_id text NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text NOT NULL REFERENCES worker_definition(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('lead','supporting')),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(job_id, worker_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS job_worker_one_lead_idx ON job_worker(job_id) WHERE role='lead';

CREATE TABLE IF NOT EXISTS job_stage (
  id text NOT NULL,
  job_id text NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  label text NOT NULL,
  ordinal integer NOT NULL,
  status text NOT NULL CHECK (status IN ('done','active','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(job_id, id),
  UNIQUE(job_id, ordinal)
);

CREATE TABLE IF NOT EXISTS domain_event (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  effect text,
  status text NOT NULL,
  worker_id text,
  job_id text,
  origin_type text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS domain_event_owner_time_idx ON domain_event(owner_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS domain_event_object_idx ON domain_event(object_type, object_id, occurred_at DESC);

INSERT INTO worker_definition (id, slug, origin, creator_name, name, tagline, responsibility, category, publication_status, trust_status)
VALUES
('w-portfolio','portfolio-guardian','agentplace-original','AgentPlace','Portfolio Guardian','Monitors portfolio state, exposure and material risks.','Monitor portfolio state, exposure and material risks.','Portfolio','published','agentplace'),
('w-memescout','meme-scout','agentplace-original','AgentPlace','Meme Scout','Discovers and researches meme assets matching your criteria.','Discover and research meme assets matching user criteria.','Memes','published','agentplace'),
('w-smartmoney','smart-money-scout','agentplace-original','AgentPlace','Smart Money Scout','Tracks wallets and flows to surface meaningful activity.','Track wallets and flows and surface meaningful coordinated or high-quality wallet activity.','Smart Money','published','agentplace'),
('w-stablecoin','stablecoin-manager','agentplace-original','AgentPlace','Stablecoin Manager','Keeps stablecoin capital liquid and productive within user-defined risk limits.','Keep stablecoin capital liquid and productive inside user-defined risk limits.','Stablecoins','published','agentplace'),
('w-defi','defi-manager','agentplace-original','AgentPlace','DeFi Manager','Understands and operates supported lending, staking and DeFi positions.','Understand and operate supported lending, staking and DeFi positions.','DeFi','published','agentplace'),
('w-perps','perps-operator','agentplace-original','AgentPlace','Perps Operator','Monitors and operates supported perpetual positions.','Monitor and operate supported perpetual positions.','Perps','published','agentplace'),
('w-researcher','crypto-researcher','agentplace-original','AgentPlace','Crypto Researcher','Performs source-grounded crypto research and synthesis.','Perform source-grounded research on tokens, protocols, projects, governance and catalysts.','Research','published','agentplace'),
('w-execution','execution-operator','agentplace-original','AgentPlace','Execution Operator','Safely executes supported onchain tasks selected by the user or another Worker.','Safely execute supported onchain tasks selected by the user or another Worker.','Transactions','published','agentplace'),
('w-agent-builder','agent-builder','agentplace-original','AgentPlace','Agent Builder','Turns a described job or human expertise into an AgentPlace Worker.','Turn a described job or human expertise into an AgentPlace Worker.','Create','published','agentplace')
ON CONFLICT (id) DO UPDATE SET
  slug=EXCLUDED.slug, creator_name=EXCLUDED.creator_name, name=EXCLUDED.name, tagline=EXCLUDED.tagline,
  responsibility=EXCLUDED.responsibility, category=EXCLUDED.category, publication_status=EXCLUDED.publication_status,
  trust_status=EXCLUDED.trust_status, updated_at=now();

INSERT INTO worker_version (id, worker_definition_id, version, default_autonomy, capability_requirements)
VALUES
('wv-portfolio-1','w-portfolio','1.0.0','observe-recommend','["portfolio.read","risk.analyze"]'),
('wv-memescout-1','w-memescout','1.0.0','research-recommend','["token.discover","token.holders.analyze","wallet.activity.analyze"]'),
('wv-smartmoney-1','w-smartmoney','1.0.0','research-recommend','["wallet.performance.analyze","wallet.flows.analyze"]'),
('wv-stablecoin-1','w-stablecoin','1.0.0','observe-recommend','["wallet.balance.read","yield.compare","stablecoin.risk.analyze"]'),
('wv-defi-1','w-defi','1.0.0','observe-recommend','["lending.position.read","yield.compare"]'),
('wv-perps-1','w-perps','1.0.0','observe-recommend','["perps.market.read","perps.position.read"]'),
('wv-researcher-1','w-researcher','1.0.0','research-only','["research.web","research.protocol-docs","market.data.read"]'),
('wv-execution-1','w-execution','1.0.0','execute-with-approval','["asset.transfer","swap.execute","bridge.execute"]'),
('wv-agent-builder-1','w-agent-builder','1.0.0','recommend','["worker.define","workflow.define"]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_contract (worker_version_id, mission, responsibilities, anti_jobs, expected_outputs, success_conditions, default_approval_boundary, default_capability_requirements)
VALUES
('wv-portfolio-1','Monitor portfolio state, exposure and material risks.','["Read portfolio state","Identify material exposure and risk","Surface actionable findings"]','["Do not speculate by default","Do not use leverage","Do not move assets without explicit authority"]','["Portfolio summary","Risk findings","Recommendations"]','["Findings are grounded in available portfolio data"]','No financial execution authority','["portfolio.read","risk.analyze"]'),
('wv-memescout-1','Discover and research meme assets matching user criteria.','["Discover candidates","Assess liquidity and holder concentration","Review deployer and wallet activity","Synthesize research"]','["Do not trade by default","Do not present unsupported social claims as facts"]','["Candidate set","Risk comparison","Research summary"]','["Research is grounded in available evidence"]','Research and recommend only','["token.discover","token.holders.analyze","wallet.activity.analyze"]'),
('wv-smartmoney-1','Track wallets and flows and surface meaningful high-quality wallet activity.','["Profile wallets","Analyze flows","Identify accumulation and coordination signals"]','["Do not default to blind copy trading"]','["Wallet evidence","Flow findings","Signal summary"]','["Signals distinguish evidence from inference"]','Research and recommend only','["wallet.performance.analyze","wallet.flows.analyze"]'),
('wv-stablecoin-1','Keep stablecoin capital liquid and productive inside user-defined risk limits.','["Monitor balances and yield opportunities","Assess protocol and depeg risk","Recommend allocations"]','["No leverage by default","No capital movement without authority"]','["Liquidity view","Risk-adjusted opportunities","Recommendations"]','["Recommendations respect configured constraints"]','No execution until authority exists','["wallet.balance.read","yield.compare","stablecoin.risk.analyze"]'),
('wv-defi-1','Understand and operate supported lending, staking and DeFi positions.','["Read positions","Assess health and rewards","Recommend supported actions"]','["No borrowing or leverage unless explicitly authorized"]','["Position summary","Risk findings","Recommended actions"]','["State is grounded in supported data providers"]','No execution until authority exists','["lending.position.read","yield.compare"]'),
('wv-perps-1','Monitor and operate supported perpetual positions.','["Read markets and positions","Assess funding and liquidation risk","Prepare supported actions"]','["No autonomous leverage by default","No orders without authority"]','["Market context","Position risk","Prepared recommendations"]','["Risk is explicit before any action"]','User-approved execution first','["perps.market.read","perps.position.read"]'),
('wv-researcher-1','Perform source-grounded research on crypto assets, protocols, projects, governance and catalysts.','["Gather relevant sources","Compare claims","Synthesize evidence"]','["Do not fabricate sources","Do not turn research into authority"]','["Research brief","Source list","Evidence-backed conclusions"]','["Claims are traceable to evidence"]','Research only','["research.web","research.protocol-docs","market.data.read"]'),
('wv-execution-1','Safely execute supported onchain tasks selected by the user or another Worker.','["Prepare supported execution","Respect authority and safety decisions","Surface execution state"]','["Never bypass authority","Never invent successful execution"]','["Prepared action","Execution status","Outcome handoff"]','["Every financial action passes the authority pipeline"]','No execution without explicit authority','["asset.transfer","swap.execute","bridge.execute"]'),
('wv-agent-builder-1','Turn a described job or human expertise into an AgentPlace Worker.','["Interview creator","Define a Job Contract","Map capabilities and safe defaults"]','["Do not grant financial authority during creation"]','["Worker definition","Job Contract","Capability requirements"]','["Worker has a bounded mission and explicit exclusions"]','Creation does not grant authority','["worker.define","workflow.define"]')
ON CONFLICT (worker_version_id) DO NOTHING;
