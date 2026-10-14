# M9 deployment notes

## Database

Railway API release continues to run:

```powershell
pnpm migrate
```

This applies `0013_connected_wallet_execution.sql`.

## API / Worker server variables

Keep these server-side only:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
EXECUTION_OBSERVER_POLL_MS=4000
EXECUTION_UNKNOWN_AFTER_MS=600000
```

To perform the deliberate M9 Mainnet acceptance test, change `MAINNET_EXECUTION_ENABLED=true` only after all other checks pass.

Configure a source-chain RPC using either the named existing variable or chain-ID form. Examples:

```text
ARBITRUM_MAINNET_RPC_URL=<server-side RPC>
# optional fallback
AGENTPLACE_EVM_RPC_42161_SECONDARY=<server-side secondary RPC>
```

or:

```text
AGENTPLACE_EVM_RPC_42161=<server-side primary RPC>
AGENTPLACE_EVM_RPC_42161_SECONDARY=<server-side secondary RPC>
```

Equivalent chain-ID variables work for supported EVM chains. Do not expose authenticated RPC URLs through `VITE_*`.

## Vercel

No wallet secret is configured in Vercel. The web app uses the user's injected EIP-1193 wallet at signing time and receives only the public account/network state and transaction hash.

## Railway Worker

The Worker owns deterministic transaction observation. Ensure its deploy watch paths include at minimum:

```text
apps/worker/**
packages/execution/**
packages/db/**
packages/authority/**
packages/risk/**
pnpm-lock.yaml
pnpm-workspace.yaml
package.json
```

The observer performs no LLM calls.

## Safe rollout

1. Deploy/migrate with Mainnet execution disabled.
2. Confirm M8 preparation/approval regression tests still pass.
3. Confirm RPC preflight works for the intended chain.
4. Enable Mainnet execution deliberately.
5. Run one tiny transfer to an address you control.
6. Disable the gate again if you are not ready to leave the Connected Wallet execution path available in production.

Mainnet autonomy remains disabled throughout M9.
