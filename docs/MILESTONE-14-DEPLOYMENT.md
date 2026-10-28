# M14 Deployment — v0.17.0

## Order

1. Merge/push the candidate after local `pnpm check` passes.
2. Run database migrations (`pnpm migrate`) once against production PostgreSQL. M14 adds `0023_launch_readiness_observability.sql`.
3. Deploy Railway API.
4. Deploy Railway Worker.
5. Deploy Railway Scheduler.
6. Deploy Vercel Web.
7. Check `/health`, then `/ready` after Worker/Scheduler have emitted heartbeats.
8. Run the M14 production acceptance matrix.

## Required unchanged safety gates

```env
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

Do not put private keys, seed phrases, wallet signing secrets or dedicated server payment keys in Vercel/browser variables.

## Readiness semantics

- `/health`: API process liveness only. HTTP 200 if the API process can answer.
- `/ready`: operational dependency state. Database failure returns 503/not_ready. Missing/stale Worker/Scheduler heartbeat or unconfigured auth reports degraded rather than pretending all product functions are healthy.

Worker and Scheduler heartbeats normally refresh every ~30 seconds; allow a short convergence period immediately after deployment.

## Rollback

The heartbeat migration is additive. Rolling application code back to v0.16.0 does not require dropping the table. Do not roll back financial ledger or authority migrations as part of an M14 rollback.

These flags preserve the frozen Mainnet execution/autonomy safety posture.
