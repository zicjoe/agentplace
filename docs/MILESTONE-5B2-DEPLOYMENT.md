# Milestone 5B.2 Deployment

## M5B.2.2

M5B.2.2 is additive and read-only.

It introduces no database migration and no required Railway variable.

The existing Telegraph discovery defaults remain:

```text
TELEGRAPH_NODE_URL=https://devnode.telegraphprotocol.com
TELEGRAPH_ENGINE_URL=https://devnode.telegraphprotocol.com/engine
TELEGRAPH_DISPATCHER_URL=https://devnode.telegraphprotocol.com/miner-dispatcher
```

These values are optional overrides; the adapter has the documented testnet defaults built in. Existing optional timeout/response-size settings remain supported.

Do not add Telegraph payment private keys, payment-signing variables or x402 libraries for M5B.2.2.

## Normal deployment flow

```bash
pnpm install --frozen-lockfile
pnpm check
git add .
git commit -m "feat: add M5B2.2 Telegraph capability mapping and evidence"
git push origin main
```

Railway does not need a new migration for this release.

## Optional no-payment smoke

```bash
pnpm telegraph:discover
```

This validates current public Telegraph discovery availability only. It does not make a paid inference request.

## Production posture after deploy

- AgentPlace Router behavior is unchanged.
- Existing M5B.1 providers remain unchanged.
- Telegraph is not yet registered as routable capability supply.
- Telegraph mappings/evidence normalizers are ready for M5B.2.3 wiring.
- No user-facing UX change is introduced.
- No wallet, signer, Agent Account, execution or policy authority is granted to Telegraph.
