# Milestone 14 — Production Reconciliation + Launch Readiness

AgentPlace v0.17.0 turns the frozen v0.16.0 feature set into a launch-ready production baseline. M14 does not add new custody or Mainnet autonomy. It reconciles existing UX/state, adds production observability and readiness, makes variable service-spend approval explicit, and moves repository/security checks into CI.

## Implemented

- Runtime version/milestone coherence at v0.17.0 / M14.
- API liveness (`/health`) separated from dependency readiness (`/ready`).
- Worker and Scheduler durable heartbeats with freshness reporting.
- Structured redacted API/Worker/Scheduler logging with request/trace correlation.
- Browser runtime degraded-state notice without claiming the entire product is down.
- Service Cost Review UI/API for real variable external-service spend above the user's single-Job threshold; separate from Financial Action Review and wallet authority.
- Telegraph testnet x402 service spend now respects the single-Job review threshold before signing a payment authorization.
- Responsive/accessibility reconciliation: skip link, stronger focus-visible behavior, coarse-pointer touch targets, reduced-motion support, safer mobile research tables/preformatted content, and navigation semantics.
- GitHub CI running the full repository contract.
- CodeQL, dependency review, Dependabot, and local committed-secret guard.
- Launch-readiness acceptance documentation and production deployment/runbook updates.

## Safety invariants

- `MAINNET_EXECUTION_ENABLED=false` remains the default production posture.
- `MAINNET_AUTONOMY_ENABLED=false` remains the default production posture.
- Service Cost Review authorizes service spend only; it cannot create or widen crypto authority.
- `/ready` reports degraded background runtimes but does not pretend blockchain/provider operations are reversible.
- Logs redact high-risk secret-bearing keys and never intentionally log raw private keys/signatures.
- Fixture/demo controls remain opt-in and are not enabled by default in production.

## Migration

`0023_launch_readiness_observability.sql` adds `runtime_heartbeat`. It contains operational service metadata only; no user financial state or authority model changes.

## Exit gate

A fresh production deployment must pass `pnpm check`, migration, runtime readiness, representative desktop/mobile flows, background Routine behavior, Billing/marketplace reconciliation, emergency stop, quarantine/release, and degraded-dependency behavior without manual database repair or hidden setup.
