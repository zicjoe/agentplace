ALTER TABLE conversation_model_preference
  DROP CONSTRAINT IF EXISTS conversation_model_preference_provider_check;
ALTER TABLE conversation_model_preference
  ADD CONSTRAINT conversation_model_preference_provider_check
  CHECK (provider IN ('auto','openai','gemini','anthropic'));

ALTER TABLE intelligence_task
  DROP CONSTRAINT IF EXISTS intelligence_task_provider_preference_check;
ALTER TABLE intelligence_task
  ADD CONSTRAINT intelligence_task_provider_preference_check
  CHECK (provider_preference IN ('auto','openai','gemini','anthropic'));

INSERT INTO capability_implementation (
  id,canonical_capability_id,provider,name,version,pricing,trust_status,health_status,invocation_kind,known_failure_states
) VALUES (
  'anthropic-web-search-v1',
  'research.web.search',
  'anthropic',
  'Claude hosted web search',
  'messages-web-search-20260318',
  '{"metered":true}',
  'tested',
  'unknown',
  'model-hosted-web-search',
  '["provider-unavailable","rate-limited","no-sources"]'
)
ON CONFLICT (id) DO UPDATE SET
  version=EXCLUDED.version,
  updated_at=now();
