-- M14 Production Reconciliation + Launch Readiness
-- Safe runtime heartbeats only. No user authority, custody, billing balance or execution semantics change.

CREATE TABLE IF NOT EXISTS runtime_heartbeat (
  instance_id text PRIMARY KEY,
  service_name text NOT NULL,
  runtime_class text NOT NULL CHECK (runtime_class IN ('api','worker','scheduler')),
  version text NOT NULL,
  milestone integer NOT NULL CHECK (milestone >= 0),
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','degraded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runtime_heartbeat_class_seen_idx ON runtime_heartbeat(runtime_class,last_seen_at DESC);


-- Bind variable service-cost approval to the exact external paid request. Existing
-- generic reviews remain valid for their original uses; paid Telegraph reviews
-- write a fingerprint and cannot authorize a different invocation accidentally.
ALTER TABLE service_cost_review ADD COLUMN IF NOT EXISTS request_fingerprint text;
CREATE INDEX IF NOT EXISTS service_cost_review_request_fingerprint_idx
  ON service_cost_review(owner_user_id,job_id,request_fingerprint,created_at DESC)
  WHERE request_fingerprint IS NOT NULL;
