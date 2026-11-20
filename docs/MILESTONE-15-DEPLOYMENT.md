# M15 Stage 1 — Deployment

- Applies as a full replacement ZIP over the current v0.17.0/M14 post-identity-fix repo. Back up any uncommitted local changes first.
- Run `pnpm check`. Do not commit or deploy on failure.
- No database migrations are introduced. Keep all existing migration and auth setup unchanged.
- Push the verified commit to the existing connected GitHub branch. Wait for Railway API/Worker/Scheduler and Vercel success. No separate local UX acceptance.
- Keep existing Railway Scheduler on; infrastructure cost reduction remains deferred.
- Preserve Mainnet execution/autonomy safety defaults and current keys; do not paste provider API credentials in the chat or logs.
- Rollback: revert the M15 Stage 1 commit, rebuild and redeploy the prior version. No data migration rollback is needed; evidence already persisted by the candidate may include additional JSON provenance fields that earlier code ignores.
