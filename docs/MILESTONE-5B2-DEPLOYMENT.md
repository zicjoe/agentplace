# Milestone 5B.2 Deployment

## M5B.2.1

M5B.2.1 is additive and read-only.

### Database

No migration is required. The discovery snapshot is not persisted in this slice.

### Railway variables

No new Railway variable is required for the documented Telegraph testnet defaults.

Optional server-side operational overrides are:

```text
TELEGRAPH_NODE_URL
TELEGRAPH_ENGINE_URL
TELEGRAPH_DISPATCHER_URL
TELEGRAPH_TIMEOUT_MS
TELEGRAPH_MAX_RESPONSE_BYTES
```

The defaults use Telegraph's documented `devnode.telegraphprotocol.com` testnet surfaces, including the `/miner-dispatcher` mount.

Do **not** add a Telegraph EVM/Solana private key, x402 payment signer, or payment library for M5B.2.1. Paid Telegraph inference remains outside this slice pending an explicit AgentPlace service-spend/custody decision.

### Normal deployment flow

```bash
pnpm check
git add .
git commit -m "feat: add M5B2.1 Telegraph testnet discovery adapter"
git push origin main
```

The existing Railway migration/pre-deploy process remains unchanged.

### Runtime smoke

If outbound access to Telegraph is available from the environment, run:

```bash
pnpm telegraph:discover
```

This is a free public discovery check only. It does not validate paid inference or M5B.2.2 capability mapping.
