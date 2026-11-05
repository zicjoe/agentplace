-- M14 Stage 3 — Read-only, owner-scoped orchestration evidence.
-- No authority, custody, signer, wallet, billing or mainnet changes.
CREATE TABLE IF NOT EXISTS job_orchestration_step (
  job_id text NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  id text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_id text,
  kind text NOT NULL CHECK (kind IN ('provider-evidence','specialist-research','lead-synthesis')),
  purpose text NOT NULL,
  depends_on text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  result_excerpt text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id,id)
);
CREATE INDEX IF NOT EXISTS job_orchestration_step_owner_job_idx
  ON job_orchestration_step(owner_user_id,job_id);

-- Avoid paying for an identical LLM Manager plan again when a leased task is
-- reclaimed after a Worker restart. Each task is already owner-scoped.
ALTER TABLE intelligence_task ADD COLUMN IF NOT EXISTS manager_plan_snapshot jsonb;
