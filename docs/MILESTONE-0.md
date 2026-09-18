# Milestone 0 — Repository and Engineering Foundation

## Scope delivered

- pnpm monorepo with four runtime classes and modular domain packages;
- strict TypeScript contracts and shared environment/event/tracing schemas;
- formatting, lint, typecheck, build and test commands;
- GitHub CI, CodeQL, dependency review and Dependabot readiness;
- secret-file and secret-pattern repository guardrails;
- explicit development/testnet/read-only-mainnet/production-mainnet environment contracts;
- PostgreSQL baseline migration with environment registry, audit events and transactional outbox;
- structured trace/request identifiers and structured logging primitives;
- public architecture/security/environment docs without committing the internal master specification.

## Gate

Run:

```bash
pnpm check
```

Expected final line from repository verification:

```text
PASS: AgentPlace Milestone 0 repository/security foundation verified.
```

Mainnet execution remains disabled by default. No wallet, signer or financial action is implemented in this milestone.
