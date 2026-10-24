-- M12 Workflow Studio conversation continuity
-- Saved Workflow drafts can be reopened with their creator transcript intact.
-- This state is creator-owned and never grants authority or execution rights.

CREATE TABLE IF NOT EXISTS creator_workflow_builder_session (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  workflow_definition_id text NOT NULL REFERENCES workflow_definition(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'draft-formed',
  draft_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, workflow_definition_id)
);

CREATE TABLE IF NOT EXISTS creator_workflow_builder_message (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES creator_workflow_builder_session(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  role text NOT NULL CHECK (role IN ('user','studio')),
  content text NOT NULL CHECK (char_length(content) <= 12000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, ordinal)
);

CREATE INDEX IF NOT EXISTS creator_workflow_builder_owner_idx
  ON creator_workflow_builder_session(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_workflow_builder_message_session_idx
  ON creator_workflow_builder_message(session_id, ordinal);
