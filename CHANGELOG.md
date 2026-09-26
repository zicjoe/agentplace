# Changelog

## 0.4.0 — Production Milestone 3

- Added versioned Worker Definitions, Worker Versions and Job Contracts.
- Seeded the first-party AgentPlace Originals as real catalog records.
- Added per-user persistent Worker installations with truthful operational state and no implicit financial authority.
- Added durable Jobs, stages and Lead/Supporting Worker relationships.
- Added persistent Worker and Job Conversations linked to durable objects.
- Added factual domain events and Activity projection instead of a competing activity state store.
- Added authenticated Worker, Job, catalog and Activity APIs with owner isolation.
- Preserved prototype financial/execution branches outside the Milestone 3 durable write path.
- Reconciled the production roadmap so M4 is Capability Standard + Intelligence Foundation and M5 is Router v1.

## 0.3.0 — Production Milestone 2

- Build hotfix 2: make repository lint platform-independent and add regression coverage for prohibited source patterns.

- Added self-hosted Better Auth with Railway/PostgreSQL-compatible storage.
- Added Google OAuth and SIWE wallet identity without granting execution authority.
- Added durable conversation/message/participant/object-link persistence.
- Added guest-to-account migration, account-backed rename/pin/archive/continuation, and PostgreSQL fuzzy search.
- Added first-party-cookie-safe local/Vercel API proxying for a Railway backend.
- Preserved Mainnet execution/autonomy off defaults and introduced no financial writes.

## 0.2.0 — Production Milestone 1

- Integrated the approved AgentPlace UX Baseline v1 into the real web runtime.
- Added production URL/deep-link foundations and route hydration.
- Isolated prototype fixtures/timers behind a production-facing state facade.
- Added versioned local fixture persistence for refresh-safe Milestone 1 testing.
- Gated hidden Demo Controls behind an explicit public development flag.
- Added a typed frontend/runtime API boundary and real API health/public-config endpoints.
- Added CORS allowlisting, updated environment documentation and preserved Mainnet-off safety defaults.
- Added deterministic milestone verification and reproducible dependency-lock expectations.

## 0.1.0 — Milestone 0

- Established the AgentPlace pnpm/TypeScript monorepo.
- Added environment safety contracts with Mainnet execution/autonomy disabled by default.
- Added PostgreSQL audit/outbox foundation.
- Added trace/request ID and structured log contracts.
- Added CI, CodeQL, dependency review, Dependabot and repository secret guards.
- Added public architecture/security/environment documentation while keeping the internal master specification outside the repository.
