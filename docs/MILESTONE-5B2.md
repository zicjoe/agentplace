# Milestone 5B.2 — Telegraph Protocol Integration

Status: M5B.2.1 and M5B.2.2 implemented. M5B.2.3–M5B.2.4 pending.

## Locked boundary

Telegraph is an external implementation/network beneath the AgentPlace Router. It does not replace the AgentPlace Manager, canonical capability vocabulary, deterministic Router, Worker ownership, Job state, authority, evidence normalization, or provider fallback.

M5B.2 remains read-only intelligence. Telegraph receives no wallet authority, signer authority, Agent Account control, provider secrets, or ability to change AgentPlace policy. Telegraph output is evidence, never authority.

Initial metadata remains fixed to:

- provider: `telegraph`
- environment: `testnet`
- trust level: `experimental`
- execution authority: `none`
- protocol/payment network: `base-sepolia`

The Telegraph protocol/payment network must never be confused with the blockchain/network that an intelligence result is about.

## Current Telegraph architecture

Telegraph models inference demand as Telegraph **Intents** and supply as registered **miners/services**. Telegraph's Engine can perform its own routing, while the dispatcher exposes the live integration registry and dynamic OpenAPI metadata. Telegraph also exposes a Daemon and MCP server.

AgentPlace does not adopt Telegraph Intents/miner vocabulary as its canonical product model. AgentPlace owns the canonical capability vocabulary and maps only compatible Telegraph service semantics underneath it.

The documented testnet currently uses `https://devnode.telegraphprotocol.com`. Paid Engine/miner calls use x402. The current AgentPlace slice does not enable that payment path.

## M5B.2.1 — Adapter + Discovery

`@agent-place/telegraph` discovers free public metadata from:

- Node `GET /status`
- dispatcher `GET /miner-dispatcher/healthz`
- dispatcher `GET /miner-dispatcher/integrations`
- Engine `GET /engine/v1/miners`
- Engine `GET /engine/v1/intents`
- dispatcher `GET /miner-dispatcher/openapi.json`

Discovery is bounded, fail-closed, and never invokes discovered upstream miner URLs directly.

## M5B.2.2 — Capability Mapping + Evidence Normalization

M5B.2.2 adds a deterministic mapping layer over the discovery snapshot.

### Capability mapping rules

- Only existing AgentPlace canonical capabilities may be produced.
- Mapping uses an explicit semantic allowlist of Telegraph intent/capability names.
- Unknown Telegraph semantics remain unmapped.
- AgentPlace does not silently create new canonical capabilities.
- A Telegraph service with multiple endpoints is mapped only when one endpoint can be selected deterministically from declared endpoint semantics.
- Ambiguous endpoint selection becomes `ambiguous` and is not router-ready.
- Missing endpoint metadata becomes `discovery-incomplete` and is not router-ready.
- Telegraph activation status is preserved; inactive/disabled supply is not router-ready.
- The Base Sepolia Telegraph protocol/payment network is never treated as an intelligence subject-network declaration.
- Intelligence subject-network hints are preserved only when current discovery schemas or intent names actually declare them.

The mapping layer prepares stable `telegraph:<service>:<capability>:<endpoint-hash>` implementation identifiers for the next Router milestone, but M5B.2.2 does not register those implementations with Router v1.

### Evidence normalization

`normalizeTelegraphEvidence()` converts a Telegraph result envelope into the existing AgentPlace IntelligenceEvidence structure while preserving:

- canonical AgentPlace capability;
- stable Telegraph implementation ID;
- provider = `telegraph`;
- exact Telegraph service/miner attribution where available;
- endpoint and Telegraph Intent;
- `testnet` environment;
- `experimental` trust posture;
- `executionAuthority = none`;
- Telegraph protocol network;
- signal hash and retrievable signal URL where available;
- provider timestamp;
- reported cost and latency metadata;
- warnings;
- provider label/reason fields when declared by Telegraph signal mapping;
- raw/normalized result payload with bounded serialization;
- limitations and error/unavailable state.

Telegraph warnings produce partial evidence. Telegraph errors remain errors. Missing results remain unavailable. AgentPlace does not upgrade those states into factual findings.

Provider confidence is copied into the normalized top-level confidence field only when Telegraph's declared confidence-field value is already a finite value in the unambiguous `[0,1]` range. Otherwise it remains in provider data and AgentPlace does not invent a conversion.

The existing `intelligence_evidence` table remains the single evidence store. The owner-scoped persistence helper is now exported for later M5B.2.3 invocation wiring; no second Telegraph-specific evidence database is introduced.

## Why Telegraph's auto-router is still not AgentPlace's Router

Telegraph's Engine can auto-route requests. AgentPlace will not make that a competing top-level router. M5B.2.3 must first let AgentPlace Router select an eligible Telegraph implementation for an AgentPlace canonical capability. Telegraph internal behavior after that point must remain subordinate to the selected implementation contract.

## Payment boundary

Telegraph paid calls use x402, where payment is authentication. Telegraph's MCP setup can use a payment private key. AgentPlace does not adopt that custody model by default.

Before paid Telegraph invocation is enabled, the product owner must approve an AgentPlace-controlled service-spend design covering custody/signing, service budgets, payment asset/network, per-call limits, accounting, failure/refund behavior and secret isolation.

M5B.2.2 adds no payment signer, x402 library, paid dependency or Telegraph payment secret.

## Remaining sequence

### M5B.2.3 — Router Integration + Fallback

- register only mapped, eligible Telegraph implementations beneath Router v1;
- preserve environment, trust, network, provider configuration and health gates;
- keep existing M5B.1 providers independently routable;
- invoke only the Telegraph service/endpoint selected by AgentPlace;
- persist normalized Telegraph evidence through the existing owner-scoped evidence path;
- ensure Telegraph failure cannot take down another eligible implementation;
- keep payment disabled unless the separate service-spend decision is approved.

### M5B.2.4 — Testnet Acceptance + Freeze

- validate current Telegraph discovery and mapped invocation against the real testnet;
- validate malformed/offline/partial/fallback behavior;
- validate evidence provenance and owner isolation;
- validate no payment or authority expansion beyond the approved boundary;
- freeze M5B only after live testnet acceptance passes.
