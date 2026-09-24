# Public architecture overview

AgentPlace uses a strongly modular TypeScript/pnpm monorepo with a small number of independently deployable runtimes rather than premature microservices.

## Runtime classes

- **Web** — React/Vite browser/PWA-ready interface based on the approved AgentPlace UX Baseline v1.
- **API** — identity/session, configuration and application API boundary. Milestone 2 adds self-hosted identity/session and durable Conversation APIs while preserving the same boundary.
- **Worker** — long-running Jobs and Worker execution.
- **Scheduler** — Routines, triggers and workflow scheduling.
- **Signer** — future isolated trusted service; intentionally not implemented inside the general API process.

## Milestone 1 frontend boundary

The approved UX is preserved under `apps/web/src/components`. Prototype fixture data, timers and demo flows are isolated under `apps/web/src/fixtures` behind `state/AppContext.tsx`, which is the production-facing facade imported by components.

Production URL routing is represented with the browser History API and canonical paths for conversations, Discover items, Workers, Jobs, Wallets, Routines and creator studios. Fixture state uses a versioned local-storage adapter only to preserve Milestone 1 testing continuity. It is not an authoritative financial store.

The browser also has a typed API boundary. Runtime health/configuration comes from `apps/api`; later milestones will replace fixture domains through that boundary instead of letting UI components call protocols or providers directly.

## Trust zones

**Untrusted:** LLM outputs, creator code, web content, external APIs and capability providers.

**Controlled runtime:** Job engine, Worker runtime, router and context assembly.

**Trusted core:** authority, risk/security enforcement, transaction inspection, signing, billing ledger, verification and audit.

The closer a component gets to moving money, the less arbitrary intelligence it is allowed to exercise.

## Initial request lineage

Every meaningful operation must carry a trace ID across API, planning, Worker, capability, provider, execution and verification boundaries. Structured audit and outbox records preserve the same lineage.

## Data direction

PostgreSQL is the future transactional source of truth for durable production records. Redis/object storage/semantic retrieval are introduced only when a milestone needs them. Financial truth must never be sourced from semantic memory or Milestone 1 browser fixtures.


## Milestone 2 identity and Conversation boundary

Better Auth runs inside the AgentPlace API and uses the PostgreSQL `auth` schema. AgentPlace application identity is projected into `app_user`; Conversation access is always scoped by the authenticated `app_user.id`. The browser never receives database credentials. Authenticated Conversation state comes from PostgreSQL, while guest work remains temporary browser state until explicit persistence. Wallet identity signatures are not financial authority.
