# Milestone 5B.2 Deployment

## M5B.2.3 deployment posture

M5B.2.3 is an additive read-only intelligence integration with a dedicated AgentPlace testnet external-service payment boundary. It does not give Telegraph authority over user wallets or Agent Accounts.

### Database migration

M5B.2.3 adds:

```text
packages/db/migrations/0009_telegraph_service_payments.sql
```

The production API already runs `pnpm migrate` as the Railway Pre-Deploy Command. Use the normal deploy flow; do not run an invented manual production migration procedure.

### Railway Worker variables

To enable paid Telegraph testnet inference, configure these on the **Railway Worker service only**:

```text
TELEGRAPH_SERVICE_PAYMENT_ENABLED=true
TELEGRAPH_EVM_PRIVATE_KEY=<dedicated AgentPlace Telegraph service-payment key>
```

Never put `TELEGRAPH_EVM_PRIVATE_KEY` in Vercel, a `VITE_*` variable, the API response surface, source control, chat, logs or database. Do not reuse a user wallet, Agent Account, production treasury or provider API key.

Optional Worker-only limits/cache settings have safe defaults and may only tighten the hard implementation caps:

```text
TELEGRAPH_X402_MAX_CALL_USDC=0.02
TELEGRAPH_X402_MAX_JOB_USDC=0.10
TELEGRAPH_X402_MAX_CALLS_PER_JOB=10
TELEGRAPH_DISCOVERY_CACHE_MS=120000
```

Existing Telegraph testnet discovery overrides remain optional:

```text
TELEGRAPH_NODE_URL=https://devnode.telegraphprotocol.com
TELEGRAPH_ENGINE_URL=https://devnode.telegraphprotocol.com/engine
TELEGRAPH_DISPATCHER_URL=https://devnode.telegraphprotocol.com/miner-dispatcher
TELEGRAPH_TIMEOUT_MS=10000
TELEGRAPH_MAX_RESPONSE_BYTES=4194304
```

### Service wallet funding

The dedicated wallet needs only Base Sepolia test assets required by Telegraph/x402 acceptance. AgentPlace hard-pins the payment network and test-USDC asset and caps spend. There is no auto-top-up.

After the Worker variable is configured, run the safe status command in an environment that has that Worker secret:

```bash
pnpm telegraph:payment-status
```

It prints the public payer address and limits, never the private key. Fund only that public address. Live paid acceptance belongs to M5B.2.4.

## Normal deployment flow

```bash
pnpm install --frozen-lockfile
pnpm check
git add .
git commit -m "feat: add M5B2.3 Telegraph routing and bounded x402 fallback"
git push origin main
```

Railway applies migration `0009` through the existing Pre-Deploy migration flow.

## Production posture after deploy

- Existing M5B.1 providers remain independently routable.
- Telegraph appears only when its dedicated Worker payment boundary is explicitly enabled and current discovery yields router-ready mappings.
- Trusted native/provider implementations rank ahead of experimental Telegraph implementations.
- The intelligence runtime uses the Router candidate order for fallback.
- Telegraph failures produce evidence/error state and permit fallback; they do not disable unrelated providers.
- Telegraph remains read-only intelligence with `executionAuthority = none`.
- No product/UI redesign is introduced.
