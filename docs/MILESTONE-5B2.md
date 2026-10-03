# Milestone 5B.2 — Telegraph Protocol Integration

Status: M5B.2.1 implemented; M5B.2.2–M5B.2.4 intentionally pending.

## Locked boundary

Telegraph is an external implementation/network beneath the AgentPlace Router. It does not replace the AgentPlace Manager, canonical capability vocabulary, deterministic Router, Worker ownership, Job state, authority, evidence normalization, or provider fallback.

M5B.2 is read-only intelligence. Telegraph receives no wallet authority, signer authority, Agent Account control, provider secrets, or ability to change AgentPlace policy. Telegraph output is evidence, never authority.

Initial metadata is fixed to:

- provider: `telegraph`
- environment: `testnet`
- trust level: `experimental`
- execution authority: `none`
- protocol network: `base-sepolia`

## Current Telegraph architecture researched for M5B.2.1

Telegraph models inference demand as canonical Telegraph **Intents** and supply as registered **miners**. Telegraph's Engine can perform its own miner routing, while its dispatcher exposes the live registered integrations and a dynamically generated OpenAPI description. Telegraph also exposes a Daemon for autonomous signal generation and an MCP server that wraps Node, Engine, Daemon, and dynamically discovered miner tools.

AgentPlace must not adopt Telegraph's Intent/miner vocabulary as its own canonical domain model. M5B.2.2 will map selected Telegraph services into existing AgentPlace canonical capabilities only where semantics match.

The documented testnet currently uses `https://devnode.telegraphprotocol.com`, with Engine under `/engine`. Telegraph documents Base Sepolia as the payment/testnet network. Current Telegraph testnet documentation also notes that the testnet is single-signer and does not yet provide the production BFT validator threshold; therefore AgentPlace keeps Telegraph experimental/testnet even when individual endpoints are healthy.

## M5B.2.1 implementation

`@agent-place/telegraph` is a controlled-runtime discovery adapter. A discovery snapshot reads only free public metadata endpoints:

- Node `GET /status`
- mounted dispatcher `GET /miner-dispatcher/healthz`
- mounted dispatcher `GET /miner-dispatcher/integrations`
- Engine `GET /v1/miners`
- Engine `GET /v1/intents`
- mounted dispatcher `GET /miner-dispatcher/openapi.json`

The adapter:

- normalizes miner/service identity, declared capabilities, supported Telegraph intents, endpoint schemas, advertised price metadata, and on-chain metadata;
- merges overlapping dispatcher and Engine catalog records without fabricating missing values;
- records per-source availability and HTTP status;
- bounds request time and response size;
- treats missing discovery sources as degraded/unavailable instead of inventing supply;
- tolerates the documented current testnet `intent_registry` gap as partial discovery;
- never invokes a discovered upstream miner URL directly;
- does not perform paid inference or x402 payment;
- does not add any Telegraph implementation to the AgentPlace Router yet;
- does not persist IntelligenceEvidence yet, because capability mapping/evidence normalization belongs to M5B.2.2.

No UI surface changes are introduced.

## Why M5B.2.1 does not use Telegraph's auto-router

Telegraph's Engine offers an auto-routed inference path. AgentPlace will not make that a competing top-level router. In M5B.2.3, AgentPlace's deterministic Router must first select an eligible `telegraph:<service>` implementation for an AgentPlace canonical capability. Any Telegraph-internal routing used after that point must remain subordinate to that exact implementation contract and must not silently broaden capability, authority, network, or spend.

## Payment boundary discovered during research

Telegraph's paid Engine/miner calls use x402, where payment is authentication. Telegraph's MCP instructions currently require a payment private key for paid calls. AgentPlace M5B.2.1 deliberately implements none of that.

Before any paid Telegraph invocation is enabled, the product owner must approve an AgentPlace-controlled service-spend design covering custody/signing, service budgets, payment asset/network, per-call limits, accounting, failure/refund behavior, and secret isolation. No arbitrary Telegraph service may receive existing Nansen, GoPlus, Etherscan, Alchemy, or other provider credentials.

## Remaining sequence

### M5B.2.2 — Capability Mapping + Evidence Normalization

- inspect live Telegraph services discovered through M5B.2.1;
- map only semantically compatible services to existing AgentPlace canonical capabilities;
- stop for approval before adding a genuinely new canonical capability;
- normalize Telegraph output into owner-scoped `IntelligenceEvidence` with explicit provider/service/testnet attribution and limitations;
- keep paid calls disabled unless the service-spend decision has been approved.

### M5B.2.3 — Router Integration + Fallback

- register mapped `telegraph:<service>` implementations as experimental/testnet supply;
- reuse Router v1 lifecycle/environment/network/configuration/health/trust eligibility;
- make native/provider M5B.1 implementations remain independently routable;
- ensure Telegraph outage/malformed output cannot take down an existing capability.

### M5B.2.4 — Testnet Acceptance + M5B Freeze

- validate discovery and mapped invocation against current Telegraph testnet;
- validate malformed/offline/partial/fallback behavior;
- validate evidence provenance and owner isolation;
- validate no payment/authority expansion beyond the approved boundary;
- freeze M5B only after production acceptance passes.
