# Milestone 5B.2 — Telegraph Intelligence Network Adapter

## Status

In progress. M5B.1 Core Intelligence Fabric is accepted and frozen. M5B.2 adds Telegraph as an external intelligence network behind the AgentPlace Router without giving Telegraph control of AgentPlace's canonical capability vocabulary, user authority, Worker state or routing policy.

## Approved boundary

AgentPlace remains the system of record for goals, Workers, canonical capabilities, deterministic eligibility, evidence, provenance and authority. Telegraph is an external intelligence network implementation source.

The integration must preserve these rules:

- AgentPlace canonical capability IDs remain provider-neutral.
- Telegraph intents are mapped into AgentPlace capabilities; they do not replace them.
- Telegraph output is untrusted external evidence until normalized and preserved by AgentPlace.
- Telegraph cannot grant wallet authority or execution permission.
- User/provider secrets are not forwarded to Telegraph Miners.
- Existing M5B.1 providers remain eligible independently of Telegraph.
- Telegraph failure must not break unrelated AgentPlace routing.
- Service-spend payment is separate from financial-action authority.

## M5B.2.1 — live discovery adapter

This slice connects the production Worker to Telegraph's real public network discovery surfaces. It reads the public Miner catalogue, public Intent registry and Daemon health, normalizes the response, and stores the latest snapshot in PostgreSQL.

This is not a mock or AgentPlace staging integration. AgentPlace production uses the live Telegraph public node. Telegraph publicly lists Mainnet for January 2027, so the live network available in October 2026 is Telegraph's public testnet. The integration is environment-configurable so Mainnet can later be selected without rewriting the adapter.

M5B.2.1 intentionally does not:

- submit paid `/engine/v1/ask` requests;
- hold an x402 payment signer;
- add Telegraph as an eligible capability implementation yet;
- create user-wallet or Agent Account authority;
- expose a new UX surface.

Those changes belong to capability mapping/normalization and service-spend stages after discovery is verified against the live network.

## Discovery surfaces

The adapter reads:

- `GET /engine/v1/miners` — public Miner catalogue;
- `GET /engine/v1/intents` — public Intent registry;
- `GET /daemon/health` — live Daemon health.

Each request is independent. A failing Intent endpoint, for example, results in a degraded discovery snapshot rather than fabricated data or a failure of AgentPlace's existing Router.

## Durable state

Migration `0009_telegraph_live_discovery.sql` adds `telegraph_discovery_snapshot`. It stores the latest normalized Miner/Intent catalogue, health response, errors, network environment and fetch timestamp. It stores no private key and no user-scoped financial authority.
