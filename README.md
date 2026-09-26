# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.4.0 — Production Milestone 3: Workers + Jobs**

The approved AgentPlace UX Baseline v1 remains intact. Identity and durable Conversations from v0.3.0 are joined by PostgreSQL-backed Worker definitions/versions, per-user Worker installations, durable Jobs, Lead/Supporting Worker relationships, Worker/Job Conversations and factual Activity projection.

Milestone 3 performs **no financial execution** and adds **no wallet authority**. Wallets, Agent Accounts, Mandates, Authority, Routines, capability execution, model intelligence and billing remain outside this milestone.

## Architecture

```text
AgentPlace Web (Vite/React; Vercel-ready)
        │ same-origin /api
        ▼
AgentPlace API (Railway)
   ├─ Better Auth (Google + SIWE wallet identity)
   ├─ durable Conversation API
   ├─ Worker + Job APIs
   ├─ factual Activity projection
   └─ application authorization
        │
        ▼
PostgreSQL (Railway-compatible)
   ├─ auth.*              # Better Auth-owned schema
   ├─ app_user            # AgentPlace application identity
   ├─ conversation
   ├─ conversation_message
   ├─ conversation_participant
   ├─ conversation_object_link
   ├─ worker_definition / worker_version / job_contract
   ├─ user_worker
   ├─ job / job_worker / job_stage
   └─ domain_event
```

A wallet used to sign in is **identity only**. It is not a Connected Wallet and grants no execution authority.

## Local setup

Requirements: Node.js 22.12+ and pnpm 10.15.1.

```powershell
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --no-frozen-lockfile
Copy-Item .env.example .env
```

Configure the production variables in `.env`, then run:

```powershell
pnpm migrate
pnpm check
pnpm dev
```

Local endpoints:

- Web: `http://localhost:5173`
- API (direct): `http://127.0.0.1:8787`
- API through the web/same-origin proxy: `http://localhost:5173/api/v1/config`
- API health (direct): `http://127.0.0.1:8787/health`

For a clean v0.4.0 checkout, `pnpm install --frozen-lockfile` should be used.

See `docs/MILESTONE-3-TESTING.md` for the acceptance checklist, `docs/MILESTONE-3-DEPLOYMENT.md` for deployment, and `.env.example` for variables.

## Locked safety principles

- Goal-first, multichain and chain-neutral UX.
- Conversation is history/context, never financial authority.
- Mainnet and Testnet remain separate trust environments.
- AI does not enforce financial authority.
- Raw user signing secrets never enter model context.
- Wallet login does not imply wallet execution access.
- Financial truth comes from authoritative systems, not remembered chat.
