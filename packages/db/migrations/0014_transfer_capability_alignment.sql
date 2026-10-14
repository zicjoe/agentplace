-- M9 transfer capability alignment
-- Canonical transfer capability used by the frozen Execution Operator worker contract.

INSERT INTO canonical_capability (
  id,
  name,
  purpose,
  effect,
  authority_requirement,
  value_at_risk_class,
  input_schema,
  output_schema,
  lifecycle_status
) VALUES (
  'asset.transfer',
  'Asset transfer',
  'Execute a validated direct asset transfer to an approved destination.',
  'economic-write',
  'authority-required',
  'high',
  '{}',
  '{}',
  'limited-production'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  effect = EXCLUDED.effect,
  authority_requirement = EXCLUDED.authority_requirement,
  value_at_risk_class = EXCLUDED.value_at_risk_class,
  lifecycle_status = EXCLUDED.lifecycle_status,
  updated_at = now();

-- No historical financial action rewrite is required: M9 had not yet exposed
-- the transfer capability in the mandate editor before this migration.
