# Production Milestone 1 — Figma UX Integration + Production Foundation

## Scope delivered

- Integrated the approved AgentPlace UX Baseline v1 into the production `apps/web` runtime without rebuilding the approved UI.
- Kept React + Vite + Tailwind as the frontend implementation to minimize UX regression.
- Added canonical History API routes and direct-link hydration for Home, Discover, Workers, Routines, Activity/Jobs, Wallets, conversations, Security, Billing, Settings and creator studios.
- Added a calm unknown-route fallback instead of silently resetting to Home.
- Isolated the approved prototype fixture/timer engine under `apps/web/src/fixtures` behind a production-facing state facade.
- Added versioned fixture persistence for Milestone 1 testing continuity; transient overlays and identity callbacks are deliberately not persisted.
- Gated Demo Controls behind `VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS=false` by default.
- Added typed web runtime configuration and a typed API client boundary.
- Turned `apps/api` into a minimal real HTTP runtime with `/health` and `/api/v1/config` endpoints and an explicit CORS allowlist.
- Preserved the Milestone 0 environment safety contract: Mainnet execution and autonomy remain off by default.
- Added a root lockfile contract, updated CI to use frozen installs, and extended milestone verification.

## Deliberately still fixture-only

The following approved UX surfaces are present but are **not production-backed yet**:

- identity/authentication;
- durable Conversation storage/search;
- persistent Worker and Job records;
- wallet connections and Agent Accounts;
- Mandates/Authority enforcement;
- quotes, simulation and signing;
- blockchain submission/observation;
- settlement verification and receipts;
- background Routines;
- creator publication/imports;
- billing and real service spend.

Those areas remain for their dedicated production milestones. Their fixture behavior must not be interpreted as real financial functionality.

## Gate

Run:

```bash
pnpm check
```

Then run:

```bash
pnpm dev
```

Verify the approved UX visually and functionally on desktop and mobile widths, including refresh/back/forward behavior on canonical routes. Use [`MILESTONE-1-TESTING.md`](MILESTONE-1-TESTING.md) for the exact user-test sequence.
