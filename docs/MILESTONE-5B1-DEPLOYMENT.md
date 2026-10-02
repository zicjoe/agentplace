# Milestone 5B.1 deployment

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm check`.
3. Commit locally.
4. Railway API pre-deploy `pnpm migrate` applies append-only migration `0007_core_intelligence_fabric.sql` and `0008_zero_cost_intelligence_hardening.sql` before the new API becomes active.
5. Push only after the local gate passes.
6. Confirm API and Worker are online and Vercel is ready.

## Server-only provider variables

Optional: `COINGECKO_DEMO_API_KEY` or `COINGECKO_API_KEY`, `NANSEN_API_KEY`, `GOPLUS_APP_KEY` + `GOPLUS_APP_SECRET` (preferred; AgentPlace mints/refreshes the bearer token automatically), optional `GOPLUS_ACCESS_TOKEN` override, `BIRDEYE_API_KEY`, `BUBBLEMAPS_API_KEY`, free-tier `ETHERSCAN_API_KEY`, free-tier `ALCHEMY_API_KEY`, and optional `THEGRAPH_API_KEY` + `THEGRAPH_UNISWAP_V3_ARBITRUM_SUBGRAPH_ID`. `CHAINBASE_API_KEY` is documented for future work but is not routed by default.

Never expose them as `VITE_*` values. DEX Screener, DefiLlama and supported Blockscout paths require no key.
