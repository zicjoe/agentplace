# Milestone 5B.2 Testing

## M5B.2.1 automated acceptance

Run the repository contract:

```bash
pnpm check
```

M5B.2.1 adds tests for:

- successful free discovery from Node, dispatcher, Engine and dynamic OpenAPI surfaces;
- merging dispatcher and Engine miner metadata;
- preserving testnet/experimental/no-authority metadata;
- documented `intent_registry` failure degrading discovery without inventing intents;
- total Telegraph discovery failure becoming `unavailable` and producing no routable supply claim;
- discovered upstream miner URLs remaining metadata only;
- absence of Telegraph x402 signer/private-key implementation.

## Optional live discovery smoke

The free discovery adapter can be checked against the current configured Telegraph testnet without enabling payment:

```bash
pnpm telegraph:discover
```

Expected behavior:

- exit 0 when at least one miner/service catalog is discovered, with `healthy` or `degraded` status;
- print only public discovery metadata and source statuses;
- exit 1 when no Telegraph miner/service catalog can be discovered;
- never request a payment signature or private key.

A degraded result is valid when a nonessential testnet discovery surface is down. In particular, Telegraph currently documents `/engine/v1/intents` as potentially failing on testnet because of an `intent_registry` schema gap. The adapter must keep the available miner catalog and disclose the limitation.

Live Telegraph availability is external state. Do not claim testnet acceptance from mocked tests alone; M5B.2.4 requires a real testnet acceptance run.
