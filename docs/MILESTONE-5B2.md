# Milestone 5B.2 — Telegraph Protocol Integration

Status: M5B.2.1, M5B.2.2 and M5B.2.3 implemented. M5B.2.4 live testnet acceptance + freeze pending.

## Locked boundary

Telegraph is an external implementation/network beneath the AgentPlace Router. It does not replace the AgentPlace Manager, canonical capability vocabulary, deterministic Router, Worker ownership, Job state, authority, evidence normalization, or provider fallback.

M5B.2 remains read-only intelligence. Telegraph receives no user-wallet authority, signer authority, Agent Account control, provider secrets, or ability to change AgentPlace policy. Telegraph output is evidence, never authority.

Initial metadata remains:

- provider: `telegraph`
- environment: `testnet`
- trust level: `experimental`
- execution authority: `none`
- Telegraph protocol/payment network: `base-sepolia`

The Telegraph payment network is infrastructure for an AgentPlace external-service cost. It must never be confused with the blockchain/network being analyzed and never grants Telegraph financial authority over user capital.

## M5B.2.1 — Adapter + Discovery

`@agent-place/telegraph` discovers free public Telegraph metadata from the documented testnet Node, Engine and miner-dispatcher surfaces. Discovery is bounded, fail-closed and never invokes arbitrary discovered miner URLs.

## M5B.2.2 — Capability Mapping + Evidence Normalization

Telegraph service semantics are mapped through an explicit allowlist into existing AgentPlace canonical capabilities. Unknown/ambiguous semantics remain unmapped. Stable `telegraph:<service>:<capability>:<endpoint-hash>` implementation IDs preserve the provider-specific implementation without changing AgentPlace's canonical vocabulary.

Telegraph results normalize into the existing owner-scoped `IntelligenceEvidence` contract with Telegraph/service attribution, environment/trust posture, timestamps, result data, source/provenance, warnings, confidence only when explicitly supported, and limitations. Warnings/errors/unavailable responses are preserved rather than upgraded into facts.

## M5B.2.3 — Router Integration + Fallback

M5B.2.3 makes eligible Telegraph mappings available to Router v1 without introducing a competing router.

### Router ownership

The flow is:

```text
Manager goal
  -> AgentPlace canonical capability
  -> AgentPlace Router eligibility + ordering
  -> selected implementation
       native/provider implementation
       OR telegraph:<service>:<capability>:<endpoint-hash>
  -> provider invocation
  -> normalized IntelligenceEvidence
```

AgentPlace uses Telegraph direct service inference at `/engine/v1/ask/{subnet_id}` after AgentPlace has selected the exact mapped service. It does not hand the top-level routing decision to Telegraph's automatic LLM router.

Only Telegraph implementations that remain discoverable, mapping-safe, endpoint-safe, subject-network-aware and service-payment-ready are added to Router supply. Telegraph remains `experimental` and is allowed through a narrow Router exception only when `provider=telegraph` and `invocationKind=telegraph-direct-x402`.

Trusted existing M5B.1 implementations sort ahead of experimental Telegraph supply. Telegraph can therefore act as eligible fallback without silently displacing existing production/provider-verified implementations.

### Structured intelligence fallback

The Worker now sends the full Router-ordered candidate list for each structured intelligence capability into the intelligence runtime. The runtime attempts candidates in Router order and persists every attempted evidence result. It stops on `verified` or `partial` evidence and continues to the next eligible implementation on `unavailable` or `error`.

This means a Telegraph outage, malformed result, rejected x402 challenge, payment-budget rejection or service disappearance does not take down a capability when another eligible AgentPlace implementation exists.

## Approved x402 service-payment boundary

Telegraph inference uses an AgentPlace-owned service-payment wallet. It is not a user wallet, not an Agent Account and not an authority grant.

Hard M5B.2.3 controls:

- Base Sepolia only (`eip155:84532`).
- Pinned Base Sepolia test USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Exact x402 scheme with EIP-3009-style `TransferWithAuthorization` signing.
- Dedicated low-funded Worker-only EVM key.
- Maximum $0.02 USDC per Telegraph call.
- Maximum $0.10 USDC per Job.
- Maximum 10 paid Telegraph calls per Job.
- Environment variables may tighten but cannot raise those hard limits.
- No automatic top-up.
- No Mainnet payment network.
- No user capital or user-wallet signer.
- No Nansen, GoPlus, Alchemy, Etherscan or other provider keys forwarded to Telegraph.
- Redirects are rejected.
- The x402 resource must match the exact Telegraph Engine request URL.
- Unsupported payment networks/assets/extensions fail closed.
- A paid request is sent at most once. If its outcome becomes unknown after authorization is sent, AgentPlace records `unknown` and does not automatically pay/retry the same request.

The private key never enters browser configuration, model context, the database, normalized evidence or logs. `pnpm telegraph:payment-status` reports only safe public configuration such as the derived payer address and limits.

## Service-spend accounting

Migration `0009_telegraph_service_payments.sql` adds `telegraph_service_payment`, an owner/job/task-scoped external-service-cost ledger. It records reservation/settlement state, amount, payer/payee public addresses and settlement metadata. It does not reference or create wallet authority, Agent Accounts or Authority Grants.

A transaction-scoped advisory lock plus `(owner_user_id, job_id, request_fingerprint)` uniqueness prevents concurrent budget races and repeat payment for the same exact request. `reserved`, `settled` and `unknown` payments count against the current Job's service-spend budget.

## M5B.2.4 — Testnet Acceptance + Freeze

M5B.2.4 must validate the real Telegraph testnet end to end after the dedicated service-payment wallet is configured/funded:

- current discovery and mapping;
- safe public payment-status output;
- one bounded direct paid inference;
- x402 settlement evidence;
- normalized IntelligenceEvidence provenance;
- Router preference for existing trusted providers;
- Telegraph fallback where an eligible path exists;
- Telegraph unavailable/malformed/budget-rejected behavior;
- owner/job spend isolation and duplicate-payment protection;
- no user-wallet or Agent Account authority expansion.

M5B.2 is frozen only after that live acceptance passes.
