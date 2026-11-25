-- M17: allow a longer creator-authored teaching turn without losing the source text.
-- Existing sessions and draft revisions remain intact. This does not change Worker authority.
ALTER TABLE creator_builder_turn
  DROP CONSTRAINT IF EXISTS creator_builder_turn_source_message_check;

ALTER TABLE creator_builder_turn
  ADD CONSTRAINT creator_builder_turn_source_message_check
  CHECK (char_length(source_message) <= 8000);
