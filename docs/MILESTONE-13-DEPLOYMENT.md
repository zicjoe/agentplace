# Milestone 13 — Deployment

## Migration

The normal API predeploy migration path applies `0021_billing_security_completion.sql`. Do not manually mutate production tables.

## New optional environment variables

```env
BILLING_TESTNET_TOPUP_ENABLED=false
BILLING_TESTNET_USDC_ADDRESS=
BILLING_SERVICE_TREASURY_ADDRESS=
ARBITRUM_SEPOLIA_RPC_URL=
```

The funding rail remains disabled until all three funding values/RPC access are deliberately configured. No private key is required by AgentPlace for user top-ups; the user signs from the Connected Wallet.

## Safety invariants

```env
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

Deploy in the normal order: Railway API → Worker → Scheduler → Vercel Web.
