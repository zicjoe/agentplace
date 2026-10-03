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
  - **Milestone 5B.2 — Telegraph Intelligence Network Adapter** — M5B.2.1 discovery and M5B.2.2 capability mapping/evidence normalization are implemented through v0.8.1. Telegraph remains experimental/testnet/no-authority; unknown Telegraph semantics stay unmapped; Router registration/fallback (M5B.2.3) and live testnet acceptance/freeze (M5B.2.4) remain pending. Machine-service payment stays behind a separate AgentPlace-controlled service-spend boundary.
- **Milestone 6 — Wallet Foundation** — Watch-only, Connected Wallets, Agent Accounts and real account/network state.
- **Milestone 7 — Mandates + Authority Engine**
- **Milestone 8 — Action Preparation + Action Review**
- **Milestone 9 — Testnet Execution + Observation**
- **Milestone 10 — Settlement + Verification + Receipts**
- **Milestone 11 — Routines + Background Work**
- **Milestone 12 — Discover + Creator System**
- **Milestone 13 — Billing + Security Completion**
- **Milestone 14 — Production Reconciliation + Launch Readiness**

Milestone boundaries may be refined only through the project discussion gate when a product, provider, authority, custody, security, cost, network or other material architectural decision is involved.
