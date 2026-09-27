CREATE TABLE IF NOT EXISTS canonical_capability (
  id text PRIMARY KEY,
  name text NOT NULL,
  purpose text NOT NULL,
  effect text NOT NULL CHECK (effect IN ('read','write','economic-write')),
  authority_requirement text NOT NULL DEFAULT 'none',
  value_at_risk_class text NOT NULL DEFAULT 'none',
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_status text NOT NULL DEFAULT 'planned' CHECK (lifecycle_status IN ('planned','schema-validated','tested','limited-production','production-observed','agentplace-verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capability_implementation (
  id text PRIMARY KEY,
  canonical_capability_id text NOT NULL REFERENCES canonical_capability(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  supported_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_status text NOT NULL DEFAULT 'tested',
  health_status text NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','unavailable','unknown')),
  invocation_kind text NOT NULL,
  known_failure_states jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capability_implementation_capability_idx ON capability_implementation(canonical_capability_id, provider);

CREATE TABLE IF NOT EXISTS conversation_model_preference (
  conversation_id text PRIMARY KEY REFERENCES conversation(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'auto' CHECK (provider IN ('auto','openai','gemini')),
  model text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_task (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  user_message_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('manager','worker','job')),
  worker_id text,
  job_id text REFERENCES job(id) ON DELETE SET NULL,
  provider_preference text NOT NULL DEFAULT 'auto' CHECK (provider_preference IN ('auto','openai','gemini')),
  model_preference text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 2,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, conversation_id, user_message_id)
);
CREATE INDEX IF NOT EXISTS intelligence_task_queue_idx ON intelligence_task(status, created_at) WHERE status IN ('queued','running');

CREATE TABLE IF NOT EXISTS model_run (
  id text PRIMARY KEY,
  task_id text REFERENCES intelligence_task(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  job_id text REFERENCES job(id) ON DELETE SET NULL,
  worker_id text,
  provider text NOT NULL,
  model text NOT NULL,
  task_kind text NOT NULL,
  context_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_hash text NOT NULL,
  output_schema text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(18,8) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('completed','failed')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_run_owner_created_idx ON model_run(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_run_job_idx ON model_run(job_id, created_at);

CREATE TABLE IF NOT EXISTS job_evidence_source (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL,
  provider text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, url)
);
CREATE INDEX IF NOT EXISTS job_evidence_job_idx ON job_evidence_source(job_id, retrieved_at);

INSERT INTO canonical_capability (id,name,purpose,effect,authority_requirement,value_at_risk_class,input_schema,output_schema,lifecycle_status) VALUES
('research.web.search','Web search','Find current public information and source URLs relevant to a research question.','read','none','none','{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}','{"type":"object","properties":{"answer":{"type":"string"},"sources":{"type":"array"}}}','limited-production'),
('research.web.read','Web source read','Read relevant public web source content during grounded research.','read','none','none','{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}','{"type":"object","properties":{"content":{"type":"string"}}}','limited-production'),
('research.source.extract','Source evidence extraction','Extract evidence from already retrieved source material without granting authority.','read','none','none','{"type":"object","properties":{"content":{"type":"string"}}}','{"type":"object","properties":{"findings":{"type":"array"}}}','limited-production'),
('portfolio.read','Portfolio read','Read supported portfolio state from authoritative providers.','read','none','none','{}','{}','planned'),
('token.holders.analyze','Token holder analysis','Analyze holder concentration using an approved onchain data provider.','read','none','none','{}','{}','planned'),
('wallet.performance.analyze','Wallet performance analysis','Analyze historical wallet activity/performance from an approved provider.','read','none','none','{}','{}','planned'),
('wallet.activity.analyze','Wallet activity analysis','Analyze wallet flows and current activity from approved providers.','read','none','none','{}','{}','planned'),
('swap.quote','Swap quote','Obtain a non-binding swap quote.','read','none','low','{}','{}','planned'),
('swap.execute','Swap execution','Execute a validated swap through an eligible implementation.','economic-write','authority-required','high','{}','{}','planned'),
('bridge.quote','Bridge quote','Obtain a non-binding bridge quote.','read','none','low','{}','{}','planned'),
('bridge.execute','Bridge execution','Execute a validated bridge action.','economic-write','authority-required','high','{}','{}','planned')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,purpose=EXCLUDED.purpose,effect=EXCLUDED.effect,lifecycle_status=EXCLUDED.lifecycle_status,updated_at=now();

INSERT INTO capability_implementation (id,canonical_capability_id,provider,name,version,pricing,trust_status,health_status,invocation_kind,known_failure_states) VALUES
('openai-web-search-v1','research.web.search','openai','OpenAI hosted web search','responses-web-search','{"metered":true}','tested','unknown','model-hosted-web-search','["provider-unavailable","rate-limited","no-sources"]'),
('gemini-google-search-v1','research.web.search','gemini','Gemini Google Search grounding','interactions-google-search','{"metered":true}','tested','unknown','model-hosted-web-search','["provider-unavailable","rate-limited","no-sources"]')
ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,updated_at=now();
