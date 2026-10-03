# Milestone 5B.2 Testing

## M5B.2.2 automated acceptance

Run the repository contract:

```bash
pnpm check
```

M5B.2.2 verifier/test coverage includes:

- M5B.2.1 free discovery remains intact;
- exact Telegraph semantic mapping to existing AgentPlace canonical capabilities;
- unrelated/unknown Telegraph services remain unmapped;
- no new canonical capability is synthesized from Telegraph vocabulary;
- deterministic endpoint selection;
- ambiguous endpoint discovery fails closed;
- Telegraph Base Sepolia protocol/payment network is not treated as the intelligence subject network;
- subject-network hints are taken only from declared discovery metadata;
- normalized Telegraph evidence preserves service/intent/testnet/trust/no-authority provenance;
- signal hashes become Telegraph source references without altering factual status;
- warnings become partial evidence;
- errors remain errors;
- absent results remain unavailable;
- confidence is not fabricated or guessed;
- owner-scoped `intelligence_evidence` persistence remains the single durable evidence path;
- no Telegraph payment signer/private-key/x402 client is introduced.

## Optional live discovery smoke

The existing free discovery smoke remains available:

```bash
pnpm telegraph:discover
```

Expected behavior:

- exit 0 when at least one Telegraph service catalog is discoverable;
- print only public discovery metadata and source statuses;
- exit 1 when no Telegraph service catalog can be discovered;
- never request a payment signature or private key.

A degraded result can be valid when a nonessential Telegraph testnet discovery surface is unavailable.

## What this milestone does not live-test

M5B.2.2 does not invoke paid Telegraph inference. Therefore mocked/fixture normalization tests prove mapping and evidence contracts, not real paid-miner acceptance.

Real Telegraph service invocation, Router fallback and external failure behavior belong to M5B.2.3/M5B.2.4. Do not describe M5B.2 as frozen until the live acceptance milestone passes.
