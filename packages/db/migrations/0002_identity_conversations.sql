CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS app_user_email_idx
  ON app_user (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('manager', 'worker', 'job')),
  worker_id text,
  job_id text,
  title text NOT NULL,
  title_source text NOT NULL DEFAULT 'auto' CHECK (title_source IN ('auto', 'user')),
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope <> 'worker') OR worker_id IS NOT NULL),
  CHECK ((scope <> 'job') OR job_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS conversation_owner_activity_idx
  ON conversation(owner_user_id, archived, pinned, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS conversation_title_trgm_idx
  ON conversation USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS conversation_message (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'manager', 'specialist')),
  specialist_name text,
  specialist_role text,
  content text NOT NULL,
  ui_card text,
  job_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_message_conversation_idx
  ON conversation_message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_message_content_trgm_idx
  ON conversation_message USING gin (content gin_trgm_ops);

CREATE TABLE IF NOT EXISTS conversation_participant (
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  participant_type text NOT NULL CHECK (participant_type IN ('user', 'agentplace', 'worker')),
  participant_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, participant_type, participant_id)
);

CREATE TABLE IF NOT EXISTS conversation_object_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  message_id text REFERENCES conversation_message(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id text NOT NULL,
  relation text NOT NULL,
  historical_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_object_link_lookup_idx
  ON conversation_object_link(conversation_id, object_type, object_id);
