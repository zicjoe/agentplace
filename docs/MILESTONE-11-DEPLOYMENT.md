# Milestone 11 Deployment — v0.14.0

M11 adds a dedicated long-running Scheduler service. It does **not** require a wallet key, signer or new blockchain contract.

## Migration

The normal API pre-deploy migration applies:

```text
0016_routines_background_work.sql
```

The migration is additive to frozen M10 data.

## Existing API and Worker

Deploy API and Worker from the same v0.14.0 repository revision. The Worker continues normal intelligence/execution-observation/verification duties; Routine scheduling itself is owned by the Scheduler service.

## New Railway Scheduler service

Create one Railway service from the same repository with:

```text
Build command: pnpm build:scheduler
Start command: pnpm start:scheduler
```

Give the Scheduler the same production `DATABASE_URL` and the provider variables required by the read-only Worker capabilities a Routine may use. Do not add wallet signing secrets.

Optional Scheduler settings:

```text
ROUTINE_SCHEDULER_POLL_MS=5000
ROUTINE_SCHEDULER_BATCH_SIZE=25
ROUTINE_DEFAULT_SERVICE_BUDGET_USD=5
ROUTINE_DEFAULT_MAX_COST_PER_RUN_USD=1
```

The defaults are safe launch values and can be overridden later after cost evidence is available.

## Safety flags

Keep:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

Do not add a private key, seed phrase, mnemonic, autonomous Connected Wallet signer, Agent Account signer or proof-anchor signer for M11.

## Suggested deploy order

1. Apply migration `0016` through the normal API deploy process.
2. Deploy API v0.14.0.
3. Deploy Worker v0.14.0.
4. Deploy Scheduler v0.14.0.
5. Deploy web v0.14.0.
6. Run the M11 manual acceptance contract.
