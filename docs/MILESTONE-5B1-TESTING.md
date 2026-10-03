# Milestone 5B.1 production acceptance

Run after migration `0007_core_intelligence_fabric.sql` and API/Worker/Web deployment.

1. **Free market/liquidity path** — ask for current market context and liquidity for BONK or WIF. Route should select DEX Screener when no higher-priority configured market provider is available. Job should preserve structured intelligence evidence.
2. **Protocol path** — ask for Aave TVL/current protocol metrics. Route should select DefiLlama and structured evidence should show provider-attributed TVL/metadata.
3. **Stablecoin path** — ask for USDC supply/market context. DefiLlama evidence should be preserved.
4. **Key-gated truthfulness** — before configuring Nansen/GoPlus/Birdeye/Bubblemaps, a request for holder concentration/security/smart-money must show those provider implementations as unavailable rather than fabricate data.
5. **Keyed-provider test** — after intentionally configuring a provider key, repeat its supported capability and confirm the route becomes eligible and evidence appears.
6. **Evidence ownership** — refresh/sign out/sign in; evidence remains. A second account/direct URL must not access the Job or evidence.
7. **Cluster boundary** — `wallet.cluster.analyze` must remain unavailable in production-mainnet because it is test-only/experimental.
8. **No authority regression** — Job Workspace still states read-only/no financial authority and no financial action is created.

M5B.1 is not frozen until the configured-provider tests relevant to the production deployment pass.

## v0.7.1 zero-cost hardening acceptance

1. **Blockscout holder concentration (no key):** on an Arbitrum/Base/Ethereum ERC-20 request, `token.holders.analyze` should route to Blockscout and preserve **and visibly summarize** top-1/top-5/top-10/top-20 deterministic concentration metrics.
2. **Etherscan free-tier:** with only `ETHERSCAN_API_KEY`, an EVM token deployer request should route to Etherscan and preserve creator + creation transaction evidence; wallet activity remains a bounded sample.
3. **Alchemy free-tier:** with only `ALCHEMY_API_KEY`, a Solana token-holder request should calculate concentration from `getTokenHoldersAtSlot` + `getTokenSupply`; wallet profile may span supported launch networks.
4. **The Graph:** only route `protocol.dex.metrics.read` when both Graph variables are configured and the request is Uniswap V3 on Arbitrum. Schema mismatch must become partial/unavailable evidence, never a fabricated metric.
5. Missing optional keys must leave only those implementations ineligible; DEX Screener, DefiLlama and Blockscout continue operating.
6. No provider result may create financial authority or an ownership/identity assertion.


## Network alias regression

For chain-aware provider tests, human network labels such as `Arbitrum One`, `Arbitrum Mainnet`, `ARB`, `Base Mainnet`, `BNB Chain`, and `Solana Mainnet` must normalize to canonical AgentPlace network IDs before Router eligibility and provider execution. A display-name alias must never make an otherwise eligible implementation appear unavailable.


### Network canonicalization regression

- Manager emits canonical network IDs rather than display labels.
- `Arbitrum One`, `Arbitrum One (42161)`, and `Arbitrum Mainnet / chain 42161` canonicalize to `arbitrum`.
- Explicit testnets remain distinct and cannot accidentally route to mainnet-only intelligence implementations.
- If no implementation is eligible, advanced route detail includes per-provider rejection reasons rather than only a generic message.


### Deployer-to-wallet evidence chaining regression

- When `token.deployer.analyze` verifies exactly one EVM creator/deployer address for the same network, a dependent `wallet.activity.analyze` subject that explicitly refers to that creator/deployer may bind to that preserved address.
- The binding is deterministic, same-Job, same-network evidence chaining; it does not infer real-world identity or beneficial ownership.
- If zero or multiple creator candidates exist, AgentPlace must leave wallet activity unresolved rather than guess.
