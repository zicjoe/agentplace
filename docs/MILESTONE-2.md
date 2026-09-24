# Production Milestone 2 — Identity + Durable Conversations

AgentPlace v0.3.0 makes identity and conversation history production-backed while preserving the approved UX Baseline v1.

## Production-real in this milestone

- Better Auth runs inside the AgentPlace API; no managed authentication SaaS is required.
- Better Auth tables live in the `auth` PostgreSQL schema; AgentPlace application users remain in `app_user`. Authentication rate limits use the same database so protection remains consistent across API replicas.
- Google OAuth is optional and wallet identity uses SIWE/ERC-4361 through an injected EVM wallet.
- Wallet sign-in is identity only. It does not register a Connected Wallet, create execution authority, sign a transaction or move funds.
- Guest use remains available. Only the originating guest conversation is migrated when a persistence-gated action triggers sign-in; an account-menu sign-in does not silently upload unrelated guest history.
- Manager/Worker/Job conversation scopes are represented durably.
- Conversation messages, user-title precedence, rename, pin, archive/unarchive, continuation and deep-link state are durable.
- Authenticated history search is executed by PostgreSQL using exact/substring and `pg_trgm` fuzzy matching.
- Semantic/embedding search remains architecturally deferred so Milestone 2 adds no paid model/embedding dependency.
- Vite uses a same-origin `/api` proxy locally. A Vercel serverless proxy forwards the same path to Railway in production so Better Auth cookies remain first-party even when the API runs on Railway.

## Deliberately still fixture-backed

Workers, Jobs, Activity events, Wallets, Agent Accounts, Mandates, Authority Grants, Routines, billing and financial execution remain on the approved prototype adapter until their dedicated production milestones.

Milestone 2 moves no funds and does not introduce Mainnet write authority.

## Data ownership rule

Conversation history records what was said. It is not the source of truth for balances, mandates, financial authority, Job runtime state or verified outcomes. Those remain structured systems in later milestones.
