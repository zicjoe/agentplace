# Milestone 5 Deployment — Router v1

Milestone 5 adds one PostgreSQL migration and no new paid provider or secret.

## Required order

1. Install and validate locally.
2. Commit/push the complete v0.6.0 change.
3. Apply `0006_router_v1.sql` to the target Railway PostgreSQL environment.
4. Redeploy Railway API and Worker.
5. Redeploy Vercel Web if it does not deploy automatically from the same push.
6. Run the production acceptance checklist in `docs/MILESTONE-5-TESTING.md`.

## Local validation

```powershell
pnpm install --frozen-lockfile
pnpm check
```

## Migration

From the repository root with the target environment's `DATABASE_URL` configured:

```powershell
pnpm migrate
```

Migration `0006_router_v1.sql`:

- extends capability implementation routing metadata;
- adds Worker/capability routing compatibility;
- adds durable Route Decisions;
- adds truthful internal implementations for grounded web read/source extraction;
- does not modify wallet, signer, Mandate or Authority state.

## Environment variables

No new environment variable is required.

Existing variables continue to govern:

- deployment environment and Mainnet safety;
- OpenAI/Gemini/Anthropic server-side credentials;
- default model provider;
- AI task call/cost limits;
- database/auth configuration.

## Roll-forward safety

The migration is append-only. Do not edit already-applied M0–M4 migrations.

If deployment code fails after the migration, leave the schema in place and forward-fix/redeploy code. The added tables/columns do not grant execution authority and do not change existing wallet behavior.

## Recommended commit

```text
feat(m5): add deterministic Router v1 and durable route decisions
```
