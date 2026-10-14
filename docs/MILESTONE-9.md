# M9 — Connected Wallet Execution + Transaction Observation

AgentPlace v0.12.0 crosses the first real state-changing boundary: an exact M8 action can be handed to the user's own Connected Wallet, signed there, submitted, and observed durably by AgentPlace.

## Approved product boundary

M9 is **not** a testnet-only milestone. The production path supports user-signed Mainnet execution when the explicit `MAINNET_EXECUTION_ENABLED` safety gate is enabled. Testnet remains a supported environment but is not a prerequisite or user-facing milestone gate.

Execution remains deliberately narrow:

- Connected EVM Wallet only.
- Exact current M8 preparation and exact-action approval are required.
- The browser wallet owns signing and broadcast through EIP-1193 `eth_sendTransaction`.
- AgentPlace never receives a user private key, seed phrase, or raw signer secret.
- Watch-only accounts never execute.
- Agent Account signing/autonomy remains out of scope while Agent Account is only an undeployed setup.
- Mainnet autonomy remains disabled separately from user-signed Mainnet execution.
- There is no automatic financial retry from an ambiguous submission state.

## What is real

### Durable transaction attempts

Migration `0013_connected_wallet_execution.sql` adds an owner-scoped `transaction_attempt` bound to:

- Financial Action ID;
- exact prepared revision;
- action digest;
- exact approval;
- account;
- environment/network/chain;
- deterministic execution key;
- exact wallet transaction request;
- transaction hash and observation evidence.

A unique execution key and unique action/revision constraint make repeated UI clicks, API retries, refreshes, and Worker restarts unable to create a second execution attempt for the same exact preparation.

### Pre-sign revalidation

Before AgentPlace asks the browser wallet to sign, the trusted execution core re-checks:

- current prepared revision/digest;
- preparation and quote expiry;
- validation/risk/simulation blocking states;
- exact current one-time approval;
- current deterministic Authority Engine decision;
- Connected Wallet mode/status/address;
- environment/network consistency;
- explicit environment execution gate;
- provider transaction payload or deterministic transfer payload;
- server-side `eth_estimateGas` preflight.

The gas estimate receives a bounded buffer, but the economic transaction payload remains exact.

### Browser-wallet signing

The web client checks the currently selected browser-wallet account and chain before calling `eth_sendTransaction`. The request contains only the exact server-prepared transaction. Signing remains entirely inside the wallet extension/application.

Known user rejection or known account/chain mismatch is safe to retry. An ambiguous wallet/provider error becomes `UNKNOWN` and AgentPlace will **not** automatically request another signature.

### Independent transaction observation

The Railway Worker runs a deterministic observer loop separate from the LLM task loop. It uses configured RPC endpoints to:

1. look up the transaction by hash;
2. compare observed `from`, `to`, calldata and value with the exact approved wallet request;
3. reject a definite mismatch as `MISMATCH`;
4. observe the receipt;
5. persist `CONFIRMING`, `CONFIRMED`, `REVERTED`, or `UNKNOWN` truthfully.

Primary/secondary RPC fallback is allowed for observation. It never creates a second broadcast. If a wallet-returned hash remains absent from all configured RPCs beyond the bounded unknown-state window, the attempt becomes `UNKNOWN` and remains non-resubmittable.

Routine transaction observation uses **zero additional LLM calls**.

## Transaction attempt states

- `WALLET_PROMPTED` — exact request handed to the user's wallet; no proven submission yet.
- `USER_REJECTED` — user rejected; nothing submitted by this attempt.
- `PRE_SUBMISSION_FAILED` — known account/chain/browser precondition failed before submission.
- `SUBMITTED` — browser wallet returned a transaction hash.
- `CONFIRMING` — exact transaction observed/pending, or hash known but not yet receipted.
- `CONFIRMED` — receipt succeeded and the observed transaction matches the exact approved request.
- `REVERTED` — onchain receipt failed.
- `MISMATCH` — transaction found by hash does not match the exact approved request.
- `UNKNOWN` — AgentPlace cannot prove submission/observation state; automatic resubmission is prohibited.

## Confirmation is not completion

M9 stops at:

> **Transaction confirmed · Verifying outcome**

A successful transaction receipt is not equivalent to the user's requested economic outcome. M9 never labels a transaction `Completed · AgentPlace Verified`.

Settlement observation, independent economic verification, Verified Receipts and proof anchoring remain M10 work.

## Supported initial execution payloads

M9 can execute:

- deterministic native EVM transfers prepared by AgentPlace;
- deterministic ERC-20 transfers where AgentPlace has an explicit token contract address;
- swap/bridge preparations only when M8 persisted a valid provider transaction request and all M9 revalidation gates pass.

Arbitrary user-supplied contract calldata is not introduced.

## Safety gates

Safe defaults remain:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

An operator must deliberately enable user-signed Mainnet execution and configure an RPC for the source chain. Mainnet autonomy remains a different gate and is not enabled by M9.
