# Milestone 5B.2 testing

## M5B.2.1 live discovery acceptance

After `pnpm check` passes and the replacement ZIP is deployed, let Railway apply migration `0009_telegraph_live_discovery.sql` through the existing API pre-deploy migration hook.

Configure the production Worker with:

```text
TELEGRAPH_DISCOVERY_ENABLED=true
TELEGRAPH_NETWORK_ENVIRONMENT=public-testnet
TELEGRAPH_NODE_URL=https://devnode.telegraphprotocol.com
TELEGRAPH_DISCOVERY_TIMEOUT_MS=12000
```

No Telegraph payment key is required for this slice.

On Worker startup, inspect the Railway log for `Telegraph live discovery refreshed`. Expected behavior:

- `networkEnvironment` is `public-testnet`;
- `status` is `healthy` when Miners, Intents and Daemon health all respond;
- `status` may be `degraded` if a Telegraph public discovery surface is temporarily unavailable;
- `minerCount` and `intentCount` reflect live responses rather than fixtures;
- existing AgentPlace Jobs continue working if Telegraph discovery is unavailable.

The database should contain a current row in `telegraph_discovery_snapshot` after a successful Worker startup refresh.

## Truth and security checks

- No `TELEGRAPH_EVM_PRIVATE_KEY` is required or consumed in M5B.2.1.
- No Telegraph implementation is inserted into `capability_implementation` yet.
- No paid inference request is issued by the discovery adapter.
- Remote Telegraph node URLs must use HTTPS and may not contain embedded credentials.
- The adapter preserves upstream failures in the snapshot `errors` field.
