# AgentPlace M14 Phase 2 — identity-evidence foreign-key repair

**Date:** 20 November 2026
**Repository:** AgentPlace v0.17.0 (Phase 2 typecheck-fix ZIP baseline)
**Status:** Source correction prepared; production acceptance pending.

## Confirmed production symptom

The Railway Worker logged `insert or update on table "intelligence_evidence" violates foreign key constraint "intelligence_evidence_capability_id_fkey"` while handling a read-only BONK investigation (attempt 2; final). This is a database foreign-key failure, **not** a model output-token failure. The exact SQL value was not included in that log, but the Phase 2 code introduces `capabilityId:'token.identity.resolve'` as a new provenance record before provider research. No earlier migration inserts this canonical capability, which explains the failure.

## Minimal fix

Add `packages/db/migrations/0025_token_identity_evidence_capability.sql` to register `token.identity.resolve` as a **read-only** canonical capability. The existing `intelligence_evidence.capability_id` foreign key can then accept identity-provenance rows. The migration is additive and idempotent (`ON CONFLICT (id) DO NOTHING`), tracked by the existing schema_migration mechanism. It does not register a routable implementation or change the router, AI model, worker logic, financial authority, signing, Mainnet flags, Scheduler, billing, or user interface.

## Deployment gate

1. Apply the replacement ZIP to the existing repository, then run `pnpm check`. Do not deploy a failing check.
2. Push the commit using the usual workflow. **Confirm the Railway API pre-deploy step runs `pnpm migrate` and finishes successfully before accepting new Worker research.** It should log `Applied 0025_token_identity_evidence_capability.sql` (or show the migration already applied) and `AgentPlace database migrations complete.`
3. Confirm the Railway Worker deployed the same commit, and `/ready` returns a healthy Worker. If the migration is absent, do **not** retry the investigation repeatedly: fix deployment/migration ordering first. Never run a production database migration from a local laptop pointing to production credentials.
4. Start a **new** BONK-on-Solana research conversation. Confirm no intelligence_evidence foreign-key error, report appears inline, the mint is `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`, missing data remains labeled as unavailable, and no financial actions occur. Inspect the Worker logs for the new task.
5. Previous failed tasks remain historical; this repair does not replay them automatically.

## Tests performed on candidate

The targeted migration regression, Phase 2 research/UX regression, formatting, lint, and M14 verifier are executed separately. Full `pnpm check` still must be run on the user's machine. No live Railway database access or production migration was performed during packaging.

## Rollback consideration

The migration is an additive read-only registry entry. Reverting application code need not remove it, and a rollback should not delete canonical capabilities that may already be referenced by audit/evidence rows.
