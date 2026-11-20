-- Repair Phase 2 identity-evidence persistence (M14, 2026-11-20).
-- intelligence_evidence.capability_id is a foreign key to canonical_capability(id).
-- The read-only resolver emits token.identity.resolve evidence; the canonical
-- identity capability was missing from the capability registry migrations.
-- This is provenance-only registration: no routable provider, signer,
-- financial authority, wallet permission or scheduler change is introduced.

INSERT INTO canonical_capability (
  id, name, purpose, effect, authority_requirement,
  value_at_risk_class, input_schema, output_schema, lifecycle_status
) VALUES (
  'token.identity.resolve',
  'Token identity resolution',
  'Preserve an explicit or pinned network-and-token-address identity for read-only intelligence evidence; not a verification of market or wallet metrics.',
  'read',
  'none',
  'none',
  '{"type":"object","properties":{"query":{"type":"string"},"network":{"type":"string"},"address":{"type":"string"}}}'::jsonb,
  '{"type":"object","properties":{"network":{"type":"string"},"address":{"type":"string"},"resolutionMethod":{"type":"string"}}}'::jsonb,
  'limited-production'
)
ON CONFLICT (id) DO NOTHING;
