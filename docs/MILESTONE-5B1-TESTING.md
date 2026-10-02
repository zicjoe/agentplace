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
