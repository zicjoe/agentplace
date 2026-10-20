-- M12 Agent Builder intelligence + deterministic draft revisions
-- LLM output is advisory. The trusted Creator core validates and applies a bounded operation set.

ALTER TABLE creator_builder_session
  ADD COLUMN IF NOT EXISTS active_revision_no integer;

CREATE TABLE IF NOT EXISTS creator_builder_turn (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES creator_builder_session(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  source_message text NOT NULL CHECK (char_length(source_message) <= 4000),
  intent text NOT NULL CHECK (intent IN ('DISCUSS','MODIFY_DRAFT','TEACH','TEST','SAVE_PRIVATE','PUBLISH','UNDO','USE_EXISTING_EXPERTISE')),
  provider text,
  model text,
  input_hash text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(18,8) NOT NULL DEFAULT 0,
  applied_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, ordinal)
);

CREATE TABLE IF NOT EXISTS creator_builder_revision (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES creator_builder_session(id) ON DELETE CASCADE,
  revision_no integer NOT NULL CHECK (revision_no >= 0),
  parent_revision_no integer,
  draft_snapshot jsonb NOT NULL,
  source_turn_id text REFERENCES creator_builder_turn(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, revision_no)
);

CREATE INDEX IF NOT EXISTS creator_builder_turn_session_idx
  ON creator_builder_turn(session_id, ordinal);
CREATE INDEX IF NOT EXISTS creator_builder_revision_session_idx
  ON creator_builder_revision(session_id, revision_no DESC);
