# Milestone 3 deployment

Milestone 3 uses the existing Vercel + Railway + PostgreSQL topology. No new external service is required.

## Railway API

Keep:

```text
Build Command: pnpm build:api
Pre-Deploy Command: pnpm migrate
Start Command: pnpm --filter @agent-place/api start
```

The pre-deploy migration applies `0003_workers_jobs.sql` and seeds the AgentPlace Original Worker catalog.

No new secret or paid provider is required for Milestone 3.

## Vercel Web

Keep the current AgentPlace Web project and `/api` rewrite to Railway. Deploy the updated repository normally after Railway API has successfully migrated.

## Rollback note

Migration 0003 is additive. Do not manually delete Worker/Job tables in production as a rollback mechanism; redeploy the previous application version and preserve data for forward recovery.
