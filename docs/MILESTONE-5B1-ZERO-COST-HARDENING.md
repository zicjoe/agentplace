# AgentPlace M5B.1 — Zero-Cost Intelligence Hardening

Version: **0.7.1**

This patch keeps M5B.1 read-only while reducing dependence on premium data vendors.

## Runtime posture

- **No-key baseline:** DEX Screener, DefiLlama, Blockscout.
- **Free-tier optional:** Etherscan V2, Alchemy, The Graph.
- **Optional enrichment:** Nansen, GoPlus, Birdeye, Bubblemaps, CoinGecko.
- **Evaluated/deferred:** Chainbase Data Cloud. Useful production queries require query/schema-specific IDs, so AgentPlace does not pretend a generic Chainbase key alone creates a routable intelligence capability.

## Deterministic holder concentration

AgentPlace now calculates top-1/top-5/top-10/top-20 concentration from preserved raw holder balances and provider-reported token supply. This is deterministic arithmetic, not an LLM score. LP, treasury, burn, bridge, exchange and contract addresses are not automatically excluded unless separately established by evidence.

## Arbitrum/EVM

- Blockscout supplies no-key holder evidence on supported EVM explorer networks.
- Etherscan V2 can supply contract creator/creation transaction evidence and bounded wallet activity when a free API key is configured.
- The Graph connector is schema-pinned to an explicitly configured Uniswap V3 Arbitrum subgraph; it cannot become a generic protocol claim source.

## Solana

Alchemy can supply ranked holders at a current slot, token supply and recent wallet signature activity when a free API key is configured. AgentPlace calculates concentration from the returned raw balances and supply.

## Safety

No new provider receives user signing material. No result grants wallet authority. No provider signal is treated as identity proof, security certification, Smart Money classification or permission to transact.
