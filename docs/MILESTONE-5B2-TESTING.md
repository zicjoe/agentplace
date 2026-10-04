# Milestone 5B.2 Testing

## M5B.2.3 automated acceptance

Run:

```bash
pnpm check
```

The M5B.2 verifier/test suite covers the frozen M5B.2.1/M5B.2.2 contracts plus M5B.2.3:

- dynamic Telegraph implementations are subordinate to AgentPlace Router v1;
- only the narrow `telegraph` + `telegraph-direct-x402` path receives experimental trust eligibility;
- existing trusted provider supply sorts ahead of experimental Telegraph supply;
- the Worker passes Router-ordered candidate lists into structured intelligence;
- unavailable/error provider evidence falls through to the next eligible implementation;
- verified/partial evidence stops fallback;
- direct Telegraph invocation targets `/engine/v1/ask/{subnet_id}` and never arbitrary discovered upstream URLs;
- request payloads contain only declared fields deterministically bound from the AgentPlace subject;
- x402 accepts only the exact Base Sepolia network, pinned test-USDC asset, supported exact/EIP-3009 scheme, matching Engine resource and bounded amount;
- redirects and unsupported extensions fail closed;
- hard limits remain $0.02/call, $0.10/job and 10 paid calls/job;
- payment status is disabled by default and never exposes the private key;
- paid-request unknown outcome is not automatically retried;
- service-payment accounting is owner/job scoped and request-fingerprint unique;
- the Telegraph payment ledger creates no wallet/Agent Account/Authority Grant linkage;
- other provider credentials are not coupled into the Telegraph runtime;
- normalized Telegraph results continue through owner-scoped `intelligence_evidence` persistence.

## Free discovery smoke

```bash
pnpm telegraph:discover
```

This remains no-payment discovery and can be used whether the payment boundary is enabled or not.

## Safe service-payment status

With Worker variables available:

```bash
pnpm telegraph:payment-status
```

Expected output contains only safe public configuration:

- enabled/ready;
- Base Sepolia payment network;
- pinned test-USDC address;
- public payer address;
- per-call/per-job/call-count caps.

It must never print `TELEGRAPH_EVM_PRIVATE_KEY`.

## M5B.2.4 live acceptance still required

Automated tests do not prove a real Telegraph x402 settlement occurred. M5B.2.4 must perform a deliberately bounded live testnet invocation using the dedicated low-funded service wallet, confirm settlement/provenance, exercise fallback/degradation, then freeze M5B.2.
