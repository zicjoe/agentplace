# AgentPlace Milestone 5B.1 — Core Crypto Intelligence Fabric

Version: **0.7.0**

M5B.1 turns Router v1 capability decisions into real provider-backed read-only crypto intelligence. It does not add wallet authority, signing or financial execution.

## Delivered

- New `@agent-place/intelligence` controlled-runtime package.
- First-class durable `intelligence_evidence` records, owner- and Job-scoped.
- Structured Manager `intelligenceSubjects` for token, wallet, protocol and stablecoin targets.
- Real provider adapters for CoinGecko, DEX Screener, Nansen, GoPlus, Birdeye, Bubblemaps, DefiLlama and Blockscout.
- Free/no-key production paths for DEX Screener, DefiLlama and supported Blockscout explorers.
- Key-gated eligibility for CoinGecko, Nansen, GoPlus, Birdeye and Bubblemaps. Missing credentials make only that implementation ineligible; they do not create fake data.
- Canonical token, wallet, smart-money, protocol/DeFi and stablecoin capability families.
- Evidence normalization: capability, provider, implementation, network/address, status, fetched/observed time, source URL, structured data, derivation version and limitations.
- Provider-attributed structured evidence is supplied to the existing grounded research synthesis alongside web research.
- AgentPlace-derived Smart Money accumulation is bounded to preserved provider evidence and never invents a proprietary wallet-quality score.
- `wallet.cluster.analyze` remains test-only/experimental; related-wallet and holder-cluster evidence never implies common ownership.
- Job Workspace progressive disclosure for **Structured crypto intelligence**.
- Owner-scoped API access at `/api/v1/jobs/:jobId/intelligence-evidence`.

## Provider posture

| Provider | M5B.1 role | Configuration |
|---|---|---|
| DEX Screener | token market/liquidity + token resolution | no key |
| DefiLlama | protocol TVL/metrics/yields + stablecoin supply/market | no key |
| Blockscout | independent EVM holder verification on supported explorer networks | no key |
| CoinGecko | market aggregation | optional server key |
| Nansen | holders, wallet profile/performance/activity, Smart Money | optional server key |
| GoPlus | token security + deployer/owner signals | server-side app key + app secret; AgentPlace mints/refreshes access tokens automatically (static token override remains supported) |
| Birdeye | Solana market/liquidity/holder enrichment | optional server key |
| Bubblemaps | holder distribution + experimental relationship map | optional server key |

Exact paid-plan upgrades remain a product/cost decision. M5B.1 does not require subscribing to a paid plan.

## Truth boundaries

- Provider signals remain attributed to the provider.
- A holder cluster or related-wallet relation does **not** prove common ownership.
- Security findings do **not** make AgentPlace declare a token safe/scam.
- TVL is not a solvency guarantee; APY is not a return guarantee.
- Smart Money labels/cohorts are provider-defined.
- Provider failures are persisted as unavailable/error evidence and never converted into factual findings.
- When sources disagree, the synthesis should surface the discrepancy rather than silently averaging it.

## Read-only boundary

M5B.1 adds no signing, no Connected Wallet execution, no Agent Account authority, no swaps/bridges, no autonomous capital movement and no user-key exposure to providers.
