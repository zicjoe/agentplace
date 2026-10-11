# Milestone 6 deployment

M6 adds one additive PostgreSQL migration: `0010_wallet_foundation.sql`.

Production Railway API predeploy already runs the repository migration flow, so no manual SQL procedure should be invented. Deploy the normal repository build after `pnpm check` passes and let the existing migration process apply the new schema.

No new paid service, wallet provider API key, private key or signer secret is required for M6. Connected EVM state is read from the user's browser wallet provider. Agent Account deployment is intentionally not part of this milestone.
