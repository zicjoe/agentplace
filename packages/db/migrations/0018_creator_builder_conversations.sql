-- M12 Creator conversation continuity
-- Builder chat is durable once a Worker draft has a canonical creator asset.
-- Conversation history is creator-owned and never grants authority.

CREATE TABLE IF NOT EXISTS creator_builder_session (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  worker_definition_id text NOT NULL REFERENCES worker_definition(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'initial-response',
  teach_mode boolean NOT NULL DEFAULT false,
  test_job_id text,
  draft_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, worker_definition_id)
);

CREATE TABLE IF NOT EXISTS creator_builder_message (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES creator_builder_session(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  role text NOT NULL CHECK (role IN ('user','builder')),
  content text NOT NULL CHECK (char_length(content) <= 12000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, ordinal)
);

CREATE INDEX IF NOT EXISTS creator_builder_owner_idx
  ON creator_builder_session(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_builder_message_session_idx
  ON creator_builder_message(session_id, ordinal);
