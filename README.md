# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.3.0 — Production Milestone 2: Identity + Durable Conversations**

The approved AgentPlace UX Baseline v1 remains intact. Identity and conversation persistence are now wired to production architecture: self-hosted Better Auth in the AgentPlace API, PostgreSQL durable conversations, guest-to-account migration, account-backed rename/pin/archive/continuation and PostgreSQL exact/fuzzy history search.

Milestone 2 performs **no financial execution**. Workers, Jobs, Wallets, Agent Accounts, Mandates, Authority, Routines and billing remain fixture-backed until their dedicated production milestones.

## Architecture

```text
AgentPlace Web (Vite/React; Vercel-ready)
        │ same-origin /api
        ▼
AgentPlace API (Railway)
   ├─ Better Auth (Google + SIWE wallet identity)
   ├─ durable Conversation API
   └─ application authorization
        │
        ▼
PostgreSQL (Railway-compatible)
   ├─ auth.*              # Better Auth-owned schema
   ├─ app_user            # AgentPlace application identity
   ├─ conversation
   ├─ conversation_message
   ├─ conversation_participant
   └─ conversation_object_link
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

Configure the Milestone 2 variables in `.env`, then run:

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

The first `pnpm install --no-frozen-lockfile` after upgrading from v0.2.0 intentionally refreshes `pnpm-lock.yaml` for the new Better Auth/PostgreSQL/SIWE dependencies. Commit the refreshed lockfile with the milestone.

See `docs/MILESTONE-2-TESTING.md` for the acceptance checklist, `docs/MILESTONE-2-DEPLOYMENT.md` for the Railway/Vercel setup, and `.env.example` for all variables.

## Locked safety principles

- Goal-first, multichain and chain-neutral UX.
- Conversation is history/context, never financial authority.
- Mainnet and Testnet remain separate trust environments.
- AI does not enforce financial authority.
- Raw user signing secrets never enter model context.
- Wallet login does not imply wallet execution access.
- Financial truth comes from authoritative systems, not remembered chat.
