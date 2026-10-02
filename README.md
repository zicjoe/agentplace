# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.7.0 — Milestone 5B.1: Core Crypto Intelligence Fabric**

AgentPlace now combines the frozen M5 deterministic Router with a provider-backed crypto intelligence fabric. Token, wallet, Smart Money, protocol/DeFi and stablecoin capabilities can route to eligible direct providers and preserve structured provider-attributed evidence alongside grounded web research.

Current production Jobs remain **read-only**. M5B.1 does not grant wallet authority, sign transactions or enable financial execution. Provider credentials stay server-side; missing credentials make only the affected implementation ineligible rather than producing synthetic data.

## Architecture

```text
AgentPlace Web (Vite/React; Vercel-ready)
        │ same-origin /api
        ▼
AgentPlace API (Railway)
   ├─ Better Auth (Google + SIWE wallet identity)
   ├─ durable Conversation API
   ├─ Worker + Job APIs
   ├─ durable Route Decision inspection
   ├─ structured intelligence evidence inspection
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
   ├─ canonical_capability / capability_implementation
   ├─ worker_capability_route / route_decision
   ├─ intelligence_evidence
   └─ domain_event
```

A wallet used to sign in is **identity only**. It is not a Connected Wallet and grants no execution authority.

## Local setup

Requirements: Node.js 22.12+ and pnpm 10.15.1.

```powershell
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
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

For a clean v0.7.0 checkout, `pnpm install --frozen-lockfile` should be used.

See `docs/MILESTONE-5B1-TESTING.md` for the acceptance checklist, `docs/MILESTONE-5B1-DEPLOYMENT.md` for deployment, and `.env.example` for variables.

## Locked safety principles

- Goal-first, multichain and chain-neutral UX.
- Conversation is history/context, never financial authority.
- Mainnet and Testnet remain separate trust environments.
- AI does not enforce financial authority.
- Raw user signing secrets never enter model context.
- Wallet login does not imply wallet execution access.
- Financial truth comes from authoritative systems, not remembered chat.


### Model providers

AgentPlace Model Gateway supports configured Gemini, OpenAI, and Anthropic Claude providers. Provider API keys are server-side only; the browser receives only the safe model catalog.
