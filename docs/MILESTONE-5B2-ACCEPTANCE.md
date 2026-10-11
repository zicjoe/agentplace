# Milestone 5B.2.4 — Telegraph Live Testnet Acceptance

Status: acceptance tooling implemented; **M5B.2 remains unfrozen until one deliberate live run passes and its safe report is reviewed**.

This acceptance step exists because automated tests cannot prove that the current external Telegraph testnet still matches the assumptions implemented in M5B.2.1–M5B.2.3 or that a real x402 settlement succeeds today.

## Safety boundary

The live runner is deliberately difficult to trigger accidentally:

- it runs only when `TELEGRAPH_LIVE_ACCEPTANCE_ENABLED=true`;
- it additionally requires the exact acknowledgement `TELEGRAPH_LIVE_ACCEPTANCE_CONFIRM=ONE_BOUNDED_TESTNET_X402_CALL`;
- the existing Worker-only `TELEGRAPH_EVM_PRIVATE_KEY` must already be configured and valid;
- the user must select one exact implementation discovered by the no-payment planning command;
- the runtime retains the hard M5B.2.3 caps: Base Sepolia only, pinned test-USDC, at most $0.02/call, $0.10/Job and 10 calls/Job;
- the runner intentionally performs only one successful paid request;
- replay and budget probes are designed to fail before a second payment can be sent;
- the report never prints the private key, EIP-3009 signature, nonce, raw query or raw provider result;
- the acceptance fixture has no user wallet, Agent Account, Authority Grant or financial execution authority.

Do not paste a private key into chat, source code, screenshots or the acceptance report.

## 1. Run normal repository acceptance first

```bash
pnpm check
```

M5B.2.4 is not a substitute for the repository test suite. The existing M5B.2 tests continue to validate Router ordering, fallback/degradation behavior, malformed challenge rejection, owner/Job spend scoping and authority isolation.

## 2. Plan the live acceptance without spending

Choose a harmless public intelligence subject and set only its public parameters. Example:

```bash
TELEGRAPH_ACCEPTANCE_SUBJECT_KIND=token \
TELEGRAPH_ACCEPTANCE_QUERY=ETH \
TELEGRAPH_ACCEPTANCE_NETWORK=ethereum \
pnpm telegraph:acceptance:plan
```

The planning command performs current Telegraph discovery/mapping only. It does not invoke paid inference and does not send a payment authorization.

Review the output and choose exactly one `implementationId` from `candidates`. If there are no safe candidates, stop. That is a failed compatibility check, not permission to guess an endpoint or bypass the Router boundary.

## 3. Confirm the dedicated service-payment wallet is ready

Run in the Railway Worker environment (or another trusted environment containing the Worker-only variables):

```bash
pnpm telegraph:payment-status
```

Fund only the public payer address with the Base Sepolia test assets required by the current Telegraph x402 challenge. Never reuse a user wallet, Agent Account or production treasury.

## 4. Run one live bounded acceptance call

Set the same subject plus the exact implementation selected in the plan:

```bash
TELEGRAPH_LIVE_ACCEPTANCE_ENABLED=true \
TELEGRAPH_LIVE_ACCEPTANCE_CONFIRM=ONE_BOUNDED_TESTNET_X402_CALL \
TELEGRAPH_ACCEPTANCE_IMPLEMENTATION_ID=<exact-plan-candidate> \
TELEGRAPH_ACCEPTANCE_SUBJECT_KIND=token \
TELEGRAPH_ACCEPTANCE_QUERY=ETH \
TELEGRAPH_ACCEPTANCE_NETWORK=ethereum \
pnpm telegraph:acceptance:run
```

The runner creates an internal testnet-only acceptance Job and performs:

1. fresh Telegraph discovery from the current documented `/api/miners` source of truth plus exact mapping revalidation;
2. one direct bounded x402 inference through the existing M5B.2.3 runtime;
3. settlement receipt validation;
4. normalized Telegraph `IntelligenceEvidence` provenance validation;
5. an exact-request replay probe that must be rejected before a second paid send;
6. a same-Job constrained-budget probe that must be rejected before a second paid send;
7. ledger validation requiring exactly one settled payment row for the acceptance Job.

A passing report has:

```text
passed: true
freezeEligible: true
settlement.status: settled
settlement.transactionHash: <non-empty>
ledger.settledCount: 1
replayProtection.passed: true
jobBudgetProtection.passed: true
authorityBoundary.executionAuthority: none
```

## 5. Failure and unknown-outcome rule

If the runner reports `passed: false`, M5B.2 remains unfrozen.

If a paid request has an unknown outcome, **do not automatically retry it**. The existing runtime records the payment as `unknown`, counts it against the Job service-spend budget and rejects an exact replay. Review the ledger/chain state first.

If live discovery, payment network, x402 shape, routing semantics or settlement requirements have materially changed, stop at the project discussion gate. Do not silently rewrite AgentPlace around a changed external provider.

## 6. Freeze procedure after a pass

After a passing safe report is reviewed:

- update `docs/MILESTONE-5B2-ACCEPTANCE-RECORD.md` with only safe public acceptance metadata (timestamp, implementation/capability, public payer, amount, network, transaction hash and evidence status);
- update `docs/MILESTONE-5B2.md`, `docs/ROADMAP.md`, `README.md` and `CHANGELOG.md` to mark M5B.2 frozen;
- do not commit a private key, payment signature, nonce, raw provider secrets or raw private user content;
- preserve Telegraph as `experimental`, `testnet`, `executionAuthority = none` unless a separately approved milestone changes that boundary.

The freeze is a documentation/acceptance state change, not permission to expand Telegraph's authority.

## Current Telegraph protocol references

The acceptance candidate was checked against Telegraph's current public documentation before the live run:

- Engine inference: `https://docs.telegraphprotocol.com/docs/using/engine-ask`
- x402 payment flow: `https://docs.telegraphprotocol.com/docs/using/x402-inference`

Those docs currently identify `GET /api/miners` as the live miner source of truth, retain direct `POST /engine/v1/ask/{minerId}` inference, and document Base Sepolia USDC (`eip155:84532`, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`) as an accepted testnet payment path. The live acceptance command still treats the actual 402 challenge as authoritative and fails closed on unsupported changes.
