# Milestone 13 — Billing + Security Completion

AgentPlace v0.16.0 replaces billing fixtures with durable commercial/accounting state and closes the remaining production Security controls without widening financial authority.

## Scope

- append-only USD service ledger and deterministic spend controls; the single-Job confirmation threshold is persisted for billable per-Job service charges and does not fabricate a charge path where none exists
- marketplace offers, quotes, entitlements and deterministic service-balance subscription renewal at the user-accepted price snapshot
- Worker monthly pricing, Workflow one-time pricing, Capability per-invocation commercial metadata/entitlement; invocation charging activates only on a separately trusted runtime route
- Creator gross-revenue attribution with the creator/platform split intentionally unallocated
- Job-level cost attribution from usage, model telemetry, provider payments and verified receipt evidence
- testnet-only Arbitrum Sepolia USDC service-balance funding, disabled until deliberately configured
- durable Security history, exact emergency-stop semantics and Creator Worker/Capability quarantine
- empirical Discover reputation from real Job telemetry

## Locked boundaries

- Agent Account/wallet capital is never service balance.
- Buying or subscribing never creates a Mandate, Authority Grant or wallet permission.
- Paid placement/ranking never silently changes execution routing.
- Creator earnings are accounting liabilities only in M13; cash-out/settlement is not enabled.
- Mainnet execution and autonomy remain disabled.
- Emergency stop never claims to reverse a submitted blockchain transaction.
- Emergency stop invalidation is authoritative across backend approval/execution gates and live UI state; stale Action Review state cannot resurrect a stopped action.
- Quarantine blocks future eligibility while preserving historical Jobs/evidence.

## Gate

A priced Creator asset can be quoted/acquired from durable service balance, entitlement is enforced at use, Job costs and creator gross revenue reconcile, refresh preserves state, and Security can durably stop cancellable future work/quarantine Creator supply without touching already-submitted transactions.
