CREATE TABLE IF NOT EXISTS routine (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text NOT NULL REFERENCES worker_definition(id) ON DELETE RESTRICT,
  title text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('mainnet','testnet')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','ACTIVE','WATCHING','WAITING_FOR_EVENT','COOLING_DOWN','PAUSED','LIMITED','NEEDS_USER','EXPIRED','STOPPED'
  )),
  current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_meaningful_run_at timestamptz,
  activated_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  limited_reason_code text,
  limited_reason_summary text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz
);
CREATE INDEX IF NOT EXISTS routine_owner_status_idx ON routine(owner_user_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS routine_due_idx ON routine(next_run_at,status) WHERE status IN ('ACTIVE','WATCHING','COOLING_DOWN');

CREATE TABLE IF NOT EXISTS routine_revision (
  routine_id text NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  instruction text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('SCHEDULED','CONDITION','EVENT')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_behavior text NOT NULL DEFAULT 'RECOMMEND_ONLY' CHECK (execution_behavior IN ('RECOMMEND_ONLY','ACT_WITHIN_AUTHORITY')),
  authority_grant_id text,
  notification_policy jsonb NOT NULL DEFAULT '{"mode":"needs-user"}'::jsonb,
  service_budget_limit_usd numeric(18,8) CHECK (service_budget_limit_usd IS NULL OR service_budget_limit_usd >= 0),
  service_budget_period_days integer NOT NULL DEFAULT 30 CHECK (service_budget_period_days > 0 AND service_budget_period_days <= 366),
  max_cost_per_run_usd numeric(18,8) CHECK (max_cost_per_run_usd IS NULL OR max_cost_per_run_usd >= 0),
  gas_budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_seconds integer NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0),
  expires_at timestamptz,
  created_by text NOT NULL DEFAULT 'user' CHECK (created_by IN ('user','agentplace')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(routine_id,revision)
);


CREATE OR REPLACE FUNCTION agentplace_reject_routine_revision_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'routine_revision is immutable; create a new revision instead';
END;
$$;
DROP TRIGGER IF EXISTS routine_revision_immutable_update ON routine_revision;
CREATE TRIGGER routine_revision_immutable_update
BEFORE UPDATE ON routine_revision
FOR EACH ROW EXECUTE FUNCTION agentplace_reject_routine_revision_update();

CREATE TABLE IF NOT EXISTS routine_run (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  routine_id text NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
  routine_revision integer NOT NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('SCHEDULE','CONDITION','EVENT','MANUAL','RETRY')),
  occurrence_key text NOT NULL,
  event_id text,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED','EVALUATING','RUNNING','COMPLETED','NO_CHANGE','BLOCKED','NEEDS_USER','FAILED_RETRYABLE','FAILED_FINAL'
  )),
  job_id text REFERENCES job(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  meaningful boolean NOT NULL DEFAULT false,
  result_code text,
  summary text,
  service_cost_usd numeric(18,8) NOT NULL DEFAULT 0 CHECK (service_cost_usd >= 0),
  gas_cost_atomic numeric(78,0),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(routine_id,routine_revision,occurrence_key),
  FOREIGN KEY(routine_id,routine_revision) REFERENCES routine_revision(routine_id,revision) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS routine_run_owner_idx ON routine_run(owner_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS routine_run_routine_idx ON routine_run(routine_id,created_at DESC);
CREATE INDEX IF NOT EXISTS routine_run_job_idx ON routine_run(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routine_run_active_idx ON routine_run(routine_id,status) WHERE status IN ('QUEUED','EVALUATING','RUNNING');
CREATE UNIQUE INDEX IF NOT EXISTS routine_run_event_once_idx ON routine_run(routine_id,event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('INFORMATIONAL','IMPORTANT','NEEDS_USER','CRITICAL')),
  title text NOT NULL,
  summary text NOT NULL,
  why text NOT NULL,
  target_type text CHECK (target_type IN ('routine','job','action','worker','wallet','system')),
  target_id text,
  group_key text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_owner_created_idx ON notification(owner_user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notification_owner_dedupe_idx ON notification(owner_user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_preference (
  owner_user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '22:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  time_zone text NOT NULL DEFAULT 'UTC',
  critical_bypass_quiet_hours boolean NOT NULL DEFAULT true,
  preview_detail text NOT NULL DEFAULT 'private' CHECK (preview_detail IN ('full','hide-amounts','private')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job ADD COLUMN IF NOT EXISTS origin_routine_id text REFERENCES routine(id) ON DELETE SET NULL;
ALTER TABLE job ADD COLUMN IF NOT EXISTS routine_run_id text REFERENCES routine_run(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS job_origin_routine_idx ON job(origin_routine_id,updated_at DESC) WHERE origin_routine_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_routine_run_once_idx ON job(routine_run_id) WHERE routine_run_id IS NOT NULL;

ALTER TABLE intelligence_task ALTER COLUMN user_message_id DROP NOT NULL;
ALTER TABLE intelligence_task ADD COLUMN IF NOT EXISTS input_source text NOT NULL DEFAULT 'USER_MESSAGE';
ALTER TABLE intelligence_task ADD COLUMN IF NOT EXISTS input_text text;
ALTER TABLE intelligence_task ADD COLUMN IF NOT EXISTS routine_run_id text REFERENCES routine_run(id) ON DELETE SET NULL;
ALTER TABLE intelligence_task DROP CONSTRAINT IF EXISTS intelligence_task_input_source_check;
ALTER TABLE intelligence_task ADD CONSTRAINT intelligence_task_input_source_check CHECK (input_source IN ('USER_MESSAGE','ROUTINE','SYSTEM'));
ALTER TABLE intelligence_task DROP CONSTRAINT IF EXISTS intelligence_task_owner_user_id_conversation_id_user_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS intelligence_task_user_message_once_idx
  ON intelligence_task(owner_user_id,conversation_id,user_message_id)
  WHERE user_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS intelligence_task_routine_run_once_idx
  ON intelligence_task(routine_run_id)
  WHERE routine_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS domain_event_type_time_idx ON domain_event(event_type,occurred_at DESC);
