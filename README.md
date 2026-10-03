# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.8.1 — Milestone 5B.2.2: Telegraph Capability Mapping + Evidence Normalization**

M5B.1 remains frozen. AgentPlace now has a production-quality Telegraph testnet adapter that discovers current Telegraph supply, deterministically maps only exact compatible service semantics into existing AgentPlace canonical capabilities, and normalizes Telegraph responses into the existing IntelligenceEvidence contract without turning Telegraph into AgentPlace's top-level router.

M5B.2.2 remains **read-only**. Telegraph capability mappings are an explicit semantic allowlist over the existing AgentPlace vocabulary; unknown Telegraph intents stay unmapped and no new canonical capability is created silently. Normalized Telegraph output is structurally compatible with owner-scoped IntelligenceEvidence persistence, but paid inference, x402 signing, Router registration and financial authority remain disabled until later M5B.2 gates.

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

For a clean v0.8.1 checkout, `pnpm install --frozen-lockfile` should be used.

See `docs/MILESTONE-5B2-TESTING.md` for the current acceptance checklist, `docs/MILESTONE-5B2-DEPLOYMENT.md` for deployment, and `.env.example` for variables.

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


### M5B.1 zero-cost-first intelligence

AgentPlace v0.7.1 can use DEX Screener, DefiLlama and Blockscout without paid subscriptions, and can optionally activate free-tier Etherscan, Alchemy and schema-pinned The Graph integrations. Premium intelligence providers remain optional enrichments rather than production prerequisites.


### M5B.2.2 Telegraph mapping + evidence

`@agent-place/telegraph` discovers Telegraph testnet supply through free public metadata endpoints, maps only exact compatible service intents/capabilities to existing AgentPlace canonical capabilities, keeps protocol settlement network separate from the intelligence subject network, and normalizes Telegraph result envelopes into provider-attributed evidence. Run `pnpm telegraph:discover` for a no-payment live discovery smoke. Router registration and paid inference remain deliberately deferred.
