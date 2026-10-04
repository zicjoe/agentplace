<p align="center">
  <img src="apps/web/public/brand/agentplace-icon-512.png" alt="AgentPlace" width="128" />
</p>

<h1 align="center">AgentPlace</h1>

<p align="center"><strong>A multichain operating system for autonomous crypto Workers.</strong></p>

<p align="center">
  <a href="https://www.agentplace.tech"><strong>Live App</strong></a>
  ·
  <a href="docs/ARCHITECTURE.md">Architecture</a>
  ·
  <a href="docs/ROADMAP.md">Roadmap</a>
  ·
  <a href="SECURITY.md">Security</a>
</p>

---

## What is AgentPlace?

AgentPlace is a multichain conversational operating system and coordination layer for autonomous crypto work.

A user starts with a goal — research a token, investigate Smart Money, monitor a portfolio, compare DeFi opportunities, or eventually execute an onchain action — instead of manually choosing agents, APIs, providers and chains.

AgentPlace turns that goal into durable work owned by specialist **Workers**, maps the work to provider-neutral **canonical capabilities**, and uses an AgentPlace-owned deterministic **Router** to select eligible implementations. Provider output is preserved as structured evidence with provenance rather than being treated as unquestioned truth.

> **The user describes the outcome. AgentPlace coordinates the work.**

### What is a crypto Worker?

A crypto Worker is a persistent AI specialist designed to own a specific crypto job. A Worker has a defined responsibility, operating context, capabilities and boundaries. Workers can research and coordinate work today; future execution capabilities remain subject to explicit deterministic authority and safety controls.

AgentPlace also has a supply-side model: experts can turn methods into Workers or Workflows, while developers and protocols can expose software as reusable Capabilities. The production creator/publishing system is still on the roadmap; the current submission focuses on the orchestration, Router and intelligence foundation.

---

## Submission status

| Submission metadata | Value |
|---|---|
| Version | `v0.8.2` submission build |
| Production app | https://www.agentplace.tech |
| Frontend | Vercel |
| API + background Worker | Railway |
| Database | PostgreSQL on Railway |
| Onchain component | Robinhood Chain Testnet |

| Platform area | Current status |
|---|---|
| Production web application | Live |
| Google + SIWE identity through Better Auth | Implemented |
| Durable conversations | Implemented |
| Persistent Worker definitions and user Workers | Implemented |
| Durable Jobs and multi-Worker collaboration | Implemented |
| AgentPlace Router v1 | Implemented |
| Provider-backed read-only crypto intelligence | Implemented |
| Durable `IntelligenceEvidence` provenance | Implemented |
| Provider fallback / rerouting | Implemented |
| Telegraph discovery, mapping and Router integration | Implemented — experimental/testnet |
| Telegraph live paid testnet acceptance | Pending M5B.2.4 |
| Robinhood Chain receipt registry | Deployed on testnet |
| Connected-wallet financial execution | Not enabled in this submission |
| Agent Account financial authority | Not enabled in this submission |
| Autonomous capital movement | Not enabled in this submission |

The current submission intentionally stops at the read-only intelligence and orchestration boundary rather than presenting unfinished financial execution as complete.

---

## How AgentPlace works

```text
User goal
   │
   ▼
AgentPlace Manager
   │
   ├── understands the request
   ├── proposes specialist responsibility
   └── proposes canonical capabilities
   │
   ▼
Persistent Worker / durable Job
   │
   ▼
AgentPlace Router
   │
   ├── lifecycle eligibility
   ├── environment eligibility
   ├── network compatibility
   ├── provider configuration
   ├── provider health
   ├── trust
   └── availability
   │
   ▼
Eligible implementation
   ├── DEX Screener
   ├── Blockscout
   ├── Etherscan
   ├── Nansen
   ├── GoPlus
   ├── The Graph
   ├── Alchemy
   ├── DefiLlama
   ├── optional enrichments
   └── Telegraph (experimental/testnet)
   │
   ▼
Normalized IntelligenceEvidence
   │
   ▼
Grounded synthesis + durable Job state
```

The LLM proposes. The deterministic Router validates and selects.

Provider names do not become AgentPlace's canonical domain model. For example, `token.security.assess` is the capability; GoPlus or another eligible provider is an implementation underneath it.

---

## Core product concepts

| Concept | Responsibility |
|---|---|
| **Manager** | Platform-level orchestration and user-facing coordination |
| **Worker** | Persistent specialist responsible for a class of crypto work |
| **Job** | One durable bounded unit of work |
| **Capability** | Provider-neutral atomic ability such as `token.market.read` |
| **Implementation** | Provider/network-specific way to satisfy a capability |
| **Router** | Deterministic eligibility, ordering and fallback across implementations |
| **IntelligenceEvidence** | Durable provider-attributed structured evidence used for synthesis |
| **Conversation** | Persistent discussion/history; never financial authority |
| **Authority** | Future deterministic permission boundary for financial execution |

---

## AgentPlace Originals

The repository defines first-party Worker roles including:

- **Portfolio Guardian** — portfolio state, exposure and material-risk monitoring.
- **Meme Scout** — meme-token discovery and research.
- **Smart Money Scout** — wallet, flow and accumulation intelligence.
- **Stablecoin Manager** — stablecoin opportunity analysis and, in later milestones, bounded management.
- **DeFi Manager** — lending, staking and DeFi position intelligence/operation.
- **Perps Operator** — perpetual-market and position workflows.
- **Crypto Researcher** — source-grounded token, protocol, project and catalyst research.
- **Execution Operator** — future controlled onchain execution responsibility.
- **Agent Builder** — turns described jobs or expertise into Worker definitions.

Not every role has financial execution enabled in the current submission. M5B is deliberately read-only.

---

## Intelligence fabric

AgentPlace does not hardwire one data provider into the product. Router v1 evaluates provider-specific implementations beneath canonical capabilities and the intelligence runtime normalizes results into owner-scoped `IntelligenceEvidence`.

### Current provider integrations

| Provider | Current role | Configuration posture |
|---|---|---|
| **DEX Screener** | Token market, liquidity and token resolution | No key |
| **DefiLlama** | Protocol TVL/metrics/yields and stablecoin intelligence | No key |
| **Blockscout** | EVM holder evidence and deterministic holder concentration | No key on supported explorers |
| **Etherscan V2** | Contract creator/deployer evidence and bounded wallet activity | Optional server key |
| **Alchemy** | Multichain wallet intelligence and Solana holder/activity paths | Optional server key |
| **The Graph** | Schema-pinned Uniswap V3 Arbitrum metrics | Optional server key + subgraph ID |
| **Nansen** | Wallet, holder and Smart Money intelligence | Optional server key |
| **GoPlus** | Token-security and deployer/owner signals | Server-side credentials |
| **CoinGecko** | Market aggregation | Optional server key |
| **Birdeye** | Solana market/liquidity/holder enrichment | Optional server key |
| **Bubblemaps** | Holder distribution and experimental relationship evidence | Optional server key |
| **Telegraph** | Experimental testnet capability supply beneath AgentPlace Router | Optional testnet service-payment boundary |

Provider signals remain attributed to the provider. Missing, stale, conflicting or failed evidence is represented as such; AgentPlace does not fabricate replacement data.

### Representative canonical capabilities

```text
token.market.read
token.liquidity.analyze
token.holders.analyze
token.deployer.analyze
token.security.assess
wallet.profile
wallet.performance.analyze
wallet.activity.analyze
smartmoney.flow.read
smartmoney.accumulation.detect
wallet.cluster.analyze
token.smartmoney.read
protocol.dex.metrics.read
```

Additional protocol, DeFi and stablecoin intelligence capabilities are defined in the registry.

---

## Telegraph integration

Telegraph is integrated as **experimental testnet capability supply beneath AgentPlace Router v1**. It does not replace the AgentPlace Manager, canonical capability vocabulary, Router, Job state or evidence model.

Implemented through M5B.2.3:

- free Telegraph discovery;
- explicit Telegraph-to-AgentPlace capability mapping;
- normalized Telegraph evidence;
- Router participation only for mapping-safe, endpoint-safe services;
- Router-ordered fallback;
- direct service inference after AgentPlace selects the implementation;
- isolated Base Sepolia x402 service-payment accounting with hard spend caps.

Telegraph receives no user-wallet authority and no unrestricted provider secrets. Live paid testnet acceptance remains pending M5B.2.4.

See [`docs/MILESTONE-5B2.md`](docs/MILESTONE-5B2.md).

---

## Robinhood Chain — onchain receipt registry

AgentPlace includes a narrow non-custodial proof component on **Robinhood Chain Testnet**.

### `AgentPlaceReceiptRegistry`

**Network:** Robinhood Chain Testnet
**Chain ID:** `46630`
**Contract:** `0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd`
**Explorer:** [View the deployed contract](https://explorer.testnet.chain.robinhood.com/address/0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd)

The contract stores privacy-safe cryptographic commitments for selected AgentPlace Job receipts. Full Jobs, conversations, provider evidence, user data and secrets remain offchain.

```text
AgentPlace Job / evidence
        │
        ▼
Canonical offchain receipt
        │
        ├── receiptHash
        ├── jobHash
        └── evidenceRoot
        │
        ▼
AgentPlaceReceiptRegistry
        │
        ▼
Robinhood Chain Testnet
```

Security properties:

- no custody or token-transfer logic;
- no user private keys or raw prompts onchain;
- append-only receipt anchors;
- duplicate and zero-hash rejection;
- explicit anchorer authorization;
- two-step ownership transfer;
- no proxy, `delegatecall`, `selfdestruct` or arbitrary external-call surface.

The current Blockscout source-verification status is **verified (partial match)**. The source is publicly inspectable on the explorer. Automated production receipt anchoring is not on the user-facing Job critical path in this submission.

Contract source and tests: [`contracts/agentplace-receipt-registry/`](contracts/agentplace-receipt-registry/)
Deployment notes: [`docs/ROBINHOOD-CHAIN-RECEIPT-REGISTRY.md`](docs/ROBINHOOD-CHAIN-RECEIPT-REGISTRY.md)

---

## Authentication and authority boundaries

AgentPlace separates **identity** from **financial authority**.

A wallet used for SIWE sign-in proves identity only. It is not automatically a Connected Wallet, is not an Agent Account and grants no permission to move assets.

Locked safety principles include:

- goal-first, multichain and chain-neutral UX;
- conversation is context/history, never authority;
- Mainnet and Testnet are separate trust environments;
- AI does not enforce financial permission;
- provider output is evidence, not authority;
- raw signing secrets never enter model context;
- financial truth must come from authoritative systems, not remembered chat;
- external provider failure must degrade or reroute honestly rather than fabricate success.

See [`SECURITY.md`](SECURITY.md) and [`docs/SECURITY-BOUNDARIES.md`](docs/SECURITY-BOUNDARIES.md).

---

## Repository architecture

AgentPlace is a TypeScript-first pnpm monorepo with a small number of deployable runtimes and strongly separated domain packages.

```text
agent-place/
├── apps/
│   ├── web/                 # React/Vite product UI
│   ├── api/                 # identity, conversations, Jobs, evidence APIs
│   ├── worker/              # long-running Job/Worker execution
│   └── scheduler/           # future routine/scheduling runtime
├── packages/
│   ├── auth/                # Better Auth + AgentPlace identity projection
│   ├── capabilities/        # canonical capabilities + implementation registry
│   ├── context/             # model/Worker context assembly
│   ├── db/                  # PostgreSQL schema + migrations
│   ├── intelligence/        # provider adapters + IntelligenceEvidence
│   ├── jobs/                # durable Job model
│   ├── models/              # model gateway
│   ├── router/              # deterministic Router v1
│   ├── telegraph/           # Telegraph discovery/mapping/inference boundary
│   ├── workers/             # Worker definitions/runtime contracts
│   └── ...                  # future authority, wallets, execution, verification, etc.
├── contracts/
│   └── agentplace-receipt-registry/
├── docs/
├── scripts/
└── tests/
```

PostgreSQL is the durable source of truth for production application state. The browser never receives database credentials or provider secrets.

---

## Local development

### Requirements

- Node.js `22.12+` and `<25`
- pnpm `10.15.1`
- PostgreSQL

### Install

```powershell
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Configure the required local variables in `.env`. Never commit real secrets.

### Database + application

```powershell
pnpm migrate
pnpm check
pnpm dev
```

Local endpoints:

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:8787`
- API health: `http://127.0.0.1:8787/health`
- Same-origin API proxy example: `http://localhost:5173/api/v1/config`

### Quality gate

```powershell
pnpm check
```

The repository-wide check runs cleaning, formatting, linting, strict TypeScript checking, builds, tests and milestone verifiers.

Telegraph development helpers:

```powershell
pnpm telegraph:discover
pnpm telegraph:payment-status
```

`telegraph:payment-status` prints safe public configuration only; it must never print the service-payment private key.

---

## Production deployment

Current production topology:

```text
www.agentplace.tech
       │
       ▼
Vercel — Web
       │ /api
       ▼
Railway — API
       │
       ├── Railway PostgreSQL
       └── Railway Worker
```

The Railway API runs `pnpm migrate` as its pre-deploy command, so normal additive migrations use the existing deployment flow rather than ad hoc manual production migration steps.

For environment-specific setup, see:

- [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md)
- [`docs/MILESTONE-5B1-DEPLOYMENT.md`](docs/MILESTONE-5B1-DEPLOYMENT.md)
- [`docs/MILESTONE-5B2-DEPLOYMENT.md`](docs/MILESTONE-5B2-DEPLOYMENT.md)

---

## Buildathon submission highlights

During the buildathon, AgentPlace progressed from the repository foundation to a deployed production application with:

- production web/API/Worker architecture;
- Better Auth + SIWE identity;
- durable Manager/Worker/Job conversations;
- persistent Workers and durable Jobs;
- multi-Worker collaboration;
- model-provider gateway support;
- Router v1 deterministic eligibility and fallback;
- provider-neutral canonical capabilities;
- multi-provider structured crypto intelligence;
- owner-scoped evidence provenance and limitations;
- Telegraph experimental testnet capability-network integration;
- a deployed Robinhood Chain Testnet receipt-registry contract.

The submission does **not** claim unfinished wallet execution, Agent Account authority or autonomous financial execution as complete.

---

## Roadmap

Completed/frozen or implemented submission milestones:

```text
M0    Repository & engineering foundation
M1    Product UX integration
M2    Identity + durable conversations
M3    Workers + Jobs
M4    Research / evidence foundation
M5    Router v1
M5B.1 Core crypto intelligence fabric
M5B.2 Telegraph integration through M5B.2.3
```

Next major platform layers include:

```text
M6    Wallet Foundation
M7    Mandates + Authority Engine
M8    Action Preparation + Action Review
M9    Testnet Execution + Observation
M10   Settlement + Verification + Receipts
M11   Routines + Background Work
M12   Discover + Creator System
M13   Billing + Security Completion
M14   Production Reconciliation + Launch Readiness
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the current production sequence.

---

## Security

Security issues should be reported privately according to [`SECURITY.md`](SECURITY.md). Do not open a public issue containing secrets, signing material or exploitable production details.

AgentPlace assumes external APIs, models, web content and capability providers can be stale, wrong or malicious. No external intelligence source is allowed to create financial authority by itself.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository contribution guidance.

---

<p align="center"><strong>AgentPlace — Give your crypto a job.</strong></p>
