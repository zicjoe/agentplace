# Production Milestone 2 — Railway + Vercel Deployment

This milestone uses the infrastructure AgentPlace already has: the web app on Vercel and the API on Railway. Better Auth is self-hosted inside the AgentPlace API. Railway PostgreSQL stores both Better Auth data (in the `auth` schema) and AgentPlace conversation data.

## Railway PostgreSQL

1. In the existing Railway project, choose **+ New -> Database -> PostgreSQL**.
2. Keep the database private. Do not enable public TCP access for normal production operation.
3. In the AgentPlace API service, add a Railway reference variable:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

If the PostgreSQL service has a different Railway service name, replace `Postgres` with that exact service name.

## Railway API variables

Set these on the AgentPlace API service. Replace the example web/API domains with the real deployed domains.

```text
AGENT_PLACE_ENV=testnet
LOG_LEVEL=info
TRACE_HEADER=x-agent-place-trace-id
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=false
DATABASE_POOL_MAX=10
TESTNET_EXECUTION_ENABLED=true
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
API_HOST=0.0.0.0
WEB_ORIGINS=https://YOUR-VERCEL-WEB-DOMAIN
BETTER_AUTH_SECRET=YOUR_RANDOM_SECRET
BETTER_AUTH_URL=https://YOUR-VERCEL-WEB-DOMAIN
AUTH_TRUSTED_ORIGINS=https://YOUR-VERCEL-WEB-DOMAIN
SIWE_DOMAIN=YOUR-VERCEL-WEB-HOSTNAME
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`SIWE_DOMAIN` is the hostname only (for example `agentplace.vercel.app`), without `https://`. Google is optional. Wallet sign-in remains available without Google credentials.

Generate `BETTER_AUTH_SECRET` locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Railway build/deploy commands

For the AgentPlace API service:

```text
Build Command: pnpm build:api
Pre-Deploy Command: pnpm migrate
Start Command: pnpm start:api
```

The pre-deploy migration runs before the new API deployment. If it fails, the deployment should not proceed.

Generate a public Railway domain for the API service; Vercel needs that public HTTP origin for its same-origin `/api` proxy. The database itself remains private.

## Vercel variable

On the existing AgentPlace web project, add this **server-side** environment variable:

```text
AGENT_PLACE_API_ORIGIN=https://YOUR-RAILWAY-API-DOMAIN
```

Do not prefix it with `VITE_`. The browser should call the same web origin at `/api`; the Vercel function proxies that request to Railway.

The browser-safe web variables remain:

```text
VITE_AGENT_PLACE_API_BASE_URL=
VITE_AGENT_PLACE_AUTH_BASE_URL=
VITE_AGENT_PLACE_DATA_MODE=api
VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS=false
VITE_AGENT_PLACE_PERSIST_FIXTURES=true
```

## Optional Google OAuth

If Google sign-in is enabled, configure the Google OAuth client with this authorized redirect URI:

```text
https://YOUR-VERCEL-WEB-DOMAIN/api/auth/callback/google
```

For local Google testing, also allow:

```text
http://localhost:5173/api/auth/callback/google
```

Then place the Google client ID/secret in Railway only. The client secret must never be a `VITE_*` variable.

## Cost-conscious local database access

For local testing against Railway PostgreSQL, prefer the Railway CLI tunnel instead of enabling database Public Access:

```powershell
railway link
railway connect postgres --tunnel-only
```

Leave that terminal running. In a second terminal, set the local `.env` `DATABASE_URL` using the host/port/user/password/database printed by Railway, then run `pnpm migrate`, `pnpm check`, and `pnpm dev`.

A local PostgreSQL installation is also fine. Do not put production database credentials in the repository.
