<p align="center">
  <img src="apps/web/public/brand/agentplace-icon-512.png" alt="AgentPlace logo" width="120" />
</p>

# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.8.2 — Milestone 5B.2.3: Telegraph Router Integration + Bounded x402 Fallback**

M5B.1 remains frozen. Telegraph testnet supply now plugs underneath AgentPlace Router v1 as dynamic experimental read-only implementations. AgentPlace still owns canonical capabilities, deterministic eligibility/ordering and fallback; trusted existing M5B.1 providers rank ahead of Telegraph.

M5B.2.3 adds direct Telegraph service inference through a tightly bounded AgentPlace-owned x402 service-payment wallet on Base Sepolia. This pays only for external intelligence service calls; it is not a user wallet, Agent Account or financial authority path. Results continue into owner-scoped IntelligenceEvidence and provider failure falls through to the next Router-eligible implementation where available.

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
   ├─ telegraph_service_payment
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

For a clean v0.8.2 checkout, `pnpm install --frozen-lockfile` should be used.

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


### M5B.2.3 Telegraph routing + bounded x402 service payment

`@agent-place/telegraph` discovers and maps Telegraph testnet supply, exposes only router-ready mapped implementations beneath AgentPlace Router, and invokes the exact Router-selected Telegraph service through the documented direct inference surface. A dedicated Worker-only Base Sepolia service-payment boundary hard-caps spend at $0.02/call, $0.10/job and 10 calls/job; no user wallet or Agent Account is used. Run `pnpm telegraph:discover` for free discovery and `pnpm telegraph:payment-status` to print only safe public payment-wallet status. Live paid testnet acceptance is M5B.2.4.
