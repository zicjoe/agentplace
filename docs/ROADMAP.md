# AgentPlace production build sequence

The repository follows the approved production sequence while preserving the Master Product + Engineering Specification as the architecture authority.

- **Milestone 0 — Repository and Engineering Foundation** — complete.
- **Milestone 1 — Figma UX Integration + Production Foundation** — accepted/frozen in v0.2.0.
- **Milestone 2 — Identity + Durable Conversations** — accepted/frozen in v0.3.0.
- **Milestone 3 — Workers + Jobs** — v0.4.0.
- **Milestone 4 — Capability Standard + Intelligence Foundation** — accepted/frozen in v0.5.0.
- **Milestone 5 — Router v1** — v0.6.0; durable intent/capability graph, deterministic eligibility, Worker routing, provider implementation routing and bounded Auto fallback.
- **Milestone 5B — Read-Only Crypto Intelligence Capability Expansion** — split into two implementation slices while preserving one read-only milestone boundary.
  Canonical scope includes `token.market.read`, `token.liquidity.analyze`, `token.holders.analyze`, `token.deployer.analyze`, `token.security.assess`, `wallet.profile`, `wallet.performance.analyze`, `wallet.activity.analyze`, `smartmoney.flow.read`, `smartmoney.accumulation.detect`, `wallet.cluster.analyze`, `token.smartmoney.read`, protocol/DeFi metrics and stablecoin intelligence.
  - **Milestone 5B.1 — Core Crypto Intelligence Fabric** — v0.7.1 hardening candidate; provider-backed token market/liquidity/holders/deployer/security, wallet profile/performance/activity, Smart Money, protocol/DeFi and stablecoin intelligence with first-class evidence provenance. Zero-cost-first paths use DEX Screener, DefiLlama, Blockscout plus optional free-tier Etherscan/Alchemy/The Graph connectors; Nansen, GoPlus, Birdeye, Bubblemaps and CoinGecko remain optional enrichments. `wallet.cluster.analyze` remains test-only/experimental. No financial execution or authority.
  - **Milestone 5B.2 — Telegraph Intelligence Network Adapter** — M5B.2.1 discovery, M5B.2.2 capability mapping/evidence normalization and M5B.2.3 Router integration/bounded x402 fallback are implemented. v0.8.5 adds the M5B.2.4 fail-closed live acceptance planner/runner. The paid live acceptance is deliberately deferred rather than used as a blocker for subsequent product milestones; Telegraph remains experimental/testnet/no-authority and is not represented as fully live-accepted.
- **Milestone 6 — Wallet Foundation** — v0.9.1 frozen (viewport/layout hardened); durable Watch-only resources, real browser-observed Connected EVM Wallet state, undeployed Agent Account setup, and owner-scoped account/network state. No financial authority or execution.
- **Milestone 7 — Mandates + Authority Engine** — v0.10.0 frozen; durable immutable-revision mandates, deterministic fail-closed authority decisions, separated service/capital/transaction/period budgets, approval policy, Worker/account/Security authority UX, pause/revoke/expiry and durable audit evidence. No signer or transaction execution added.
- **Milestone 8 — Action Preparation + Action Review** — v0.11.0 frozen; durable exact-action preparation, live/truthful quote interface, preflight/risk evidence, M7 authority binding and exact-action approval. No signing/submission.
- **Milestone 9 — Connected Wallet Execution + Transaction Observation** — v0.12.0 frozen; approved product-boundary update replaces the older testnet-only wording. Exact user-approved Connected Wallet actions may execute on Mainnet only when the explicit production gate is enabled; signing remains in the user's wallet, transaction attempts are idempotent/durable, and deterministic RPC observation never automatically resubmits an uncertain action. Confirmation is not verified completion.
- **Milestone 10 — Settlement Verification + Verified Outcomes + Verified Receipts** — v0.13.0 frozen; deterministic direct EVM transfer outcome verification, immutable receipts, exact gas accounting, historical M9 backfill and a durable pending Arbitrum proof queue with no production anchor signer.
- **Milestone 11 — Routines + Background Work** — v0.14.0 candidate; durable scheduled/condition/event triggers, exactly-once RoutineRuns, Routine → Job orchestration, service budgets, Limited/Needs-you and in-app notifications. No autonomous signing.
- **Milestone 12 — Discover + Creator System**
- **Milestone 13 — Billing + Security Completion**
- **Milestone 14 — Production Reconciliation + Launch Readiness**

Milestone boundaries may be refined only through the project discussion gate when a product, provider, authority, custody, security, cost, network or other material architectural decision is involved.


## Current frozen/active sequence

- v0.10.0 — M7 Mandates + Authority Engine: frozen.
- v0.11.0 — M8 Action Preparation + Action Review: frozen; preparation and exact-action approval only, no signing/submission.
- v0.12.0 — M9 Connected Wallet Execution + Transaction Observation: frozen; user-signed execution and durable observation, with Mainnet disabled by default and autonomy still disabled.
- v0.13.0 — M10 Settlement Verification + Verified Outcomes + Verified Receipts: frozen after real Arbitrum Mainnet historical-transfer backfill and Verified Receipt acceptance.
- v0.14.0 — M11 Routines + Background Work: implementation candidate; no autonomous signing or Mainnet autonomy.
