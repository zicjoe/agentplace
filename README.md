# AgentPlace

**Let your crypto work for you.**

AgentPlace is a multichain conversational operating system and economic coordination layer for autonomous crypto Workers. Users express outcomes; persistent Workers coordinate capabilities, wallets, protocols and chains under explicit authority, then verify what actually happened.

## Current status

**v0.2.0 — Production Milestone 1: Figma UX Integration + Production Foundation**

The approved AgentPlace UX Baseline v1 is now integrated into the production monorepo. The product shell, responsive surfaces and approved prototype interactions are preserved while routing, runtime configuration, API boundaries, fixture isolation and local milestone-state persistence have production foundations underneath them.

Milestone 1 does **not** make prototype balances, Jobs, conversations, quotes, authority decisions or financial execution real. Those remain isolated fixture behavior until their dedicated production milestones replace them.

## Locked product principles

- Goal-first and crypto-native; users should not become systems integrators.
- Multichain and chain-neutral in product identity and UX.
- Arbitrum is a deeply integrated launch network, not the identity of the product.
- Mainnet and Testnet are separate trust environments with stricter Mainnet gates.
- AI proposes; deterministic systems enforce authority, budgets and financial safety.
- Workers never receive unrestricted private keys.
- Financial state comes from authoritative sources, not remembered chat.
- Job completion means the intended outcome was verified, not merely submitted.
- Onchain proof/attestation anchoring is asynchronous unless the chain action is itself part of the Job.

## Repository shape

```text
apps/
  web/          # approved AgentPlace UX running as the production React/Vite app
  api/          # core API runtime; Milestone 1 exposes health + safe public runtime config
  worker/       # long-running Worker runtime foundation
  scheduler/    # Routine/workflow scheduling runtime foundation
packages/
  shared/       # environment, API, event, service and tracing contracts
  db/           # PostgreSQL schema/migrations
  auth/ workers/ jobs/ models/ context/
  capabilities/ router/ authority/ risk/ execution/ verification/
  wallets/ chains-evm/ chains-solana/
  notifications/ billing/ marketplace/ creator-sdk/ observability/
```

The approved Figma mock engine is intentionally isolated under `apps/web/src/fixtures/`. UI components import a state facade rather than the fixture implementation directly so later milestones can replace the fixture adapter without rebuilding the approved UX.

## Local setup

Requirements: **Node.js 22.12+** and **pnpm 10.15.1**.

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
pnpm dev
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

`pnpm dev` starts:

- AgentPlace web: `http://localhost:5173`
- AgentPlace API: `http://127.0.0.1:8787`
- API health: `http://127.0.0.1:8787/health`

The web app remains usable in Milestone 1 fixture mode if the API is temporarily unavailable because no approved production feature depends on real backend data yet.

## Milestone 1 data mode

`VITE_AGENT_PLACE_DATA_MODE=fixtures` is the only complete Milestone 1 UI data mode. Approved Figma state transitions are retained for product testing and are locally persisted by default so refreshes and real URL routes can preserve the working demo state.

`VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS=false` keeps hidden prototype scenario controls out of the normal production UI. Set it to `true` only for internal UX/resilience testing.

Do not interpret fixture screens as production financial functionality.

## Environment safety

Mainnet writes and Mainnet autonomy remain **off by default**. Browser-visible `VITE_*` settings are public configuration and must never contain API keys, private keys, secrets or signing material. See [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md).

## Security

See [`SECURITY.md`](SECURITY.md) and [`docs/SECURITY-BOUNDARIES.md`](docs/SECURITY-BOUNDARIES.md).

## Production roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md). The next planned milestone after acceptance is **Production Milestone 2 — Identity + Durable Conversations**.
