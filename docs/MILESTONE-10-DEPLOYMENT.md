# Milestone 10 Deployment — v0.13.0

M10 adds read-only settlement verification and receipt persistence. It does **not** require a new signing key or proof-anchor wallet.

## Required existing infrastructure

- Railway PostgreSQL used by API/Worker;
- the server-side EVM RPC(s) already used by M9 for the networks being verified;
- API and Worker deployments from this same repository revision.

## New/updated optional variables

```text
VERIFICATION_OBSERVER_POLL_MS=5000
VERIFICATION_RETRY_BASE_MS=15000
VERIFICATION_MAX_RETRY_MS=300000
```

For stronger RPC independence, optionally configure a distinct secondary endpoint for each chain:

```text
AGENTPLACE_EVM_RPC_42161_SECONDARY=
AGENTPLACE_EVM_RPC_8453_SECONDARY=
AGENTPLACE_EVM_RPC_1_SECONDARY=
```

These are server-side variables only. Never put authenticated RPC URLs in `VITE_*` variables.

## Safety flags

Keep:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

M10 historical verification works with both flags disabled.

## Migration/deploy order

1. Deploy/migrate the v0.13.0 schema.
2. Deploy API v0.13.0.
3. Deploy Worker v0.13.0.
4. Deploy web v0.13.0.
5. Observe the historical confirmed M9 transaction being picked up by the settlement verifier.

The migration is additive. Do not delete M9 transaction attempts, preparations or approvals; M10 uses that immutable lineage to verify historical transactions.

## No proof signer in M10

Do not create any of the following for this milestone:

- raw private key environment variable;
- mnemonic/seed phrase;
- Railway hot-wallet signer;
- Arbitrum anchoring service account.

The proof queue stops at `PENDING` until a later separately approved signer/anchoring architecture exists.
