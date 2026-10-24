# Database migrations

Migrations are append-only and ordered by numeric prefix. Never edit an applied production migration; add a new migration instead.

Milestone 0 uses plain PostgreSQL SQL deliberately so the database contract is not coupled to an ORM before the domain model stabilizes.

Apply locally with your preferred migration runner or, for a disposable development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/migrations/0001_foundation.sql
```

Production deployment must apply migrations through a controlled release job with backups and rollback/forward-fix procedures.

## 0011_mandates_authority.sql

Adds M7 durable Mandates with immutable policy revisions, deterministic authority decision evidence, separate capital/transaction/period/service budget fields, owner/environment autonomy pause state, and idempotent authority budget usage accounting. Revoked Mandates are guarded against resurrection at the database boundary.


## 0012_action_preparation_review.sql

Adds M8 durable Financial Actions, immutable prepared revisions/digests, quote/preflight/risk evidence, exact-action approvals, and separate service-cost reviews. It adds no signer, private-key custody or transaction submission path.


## 0013_connected_wallet_execution.sql

Adds M9 durable exact-action `transaction_attempt` state for user-signed Connected Wallet execution, idempotent execution keys, wallet-prompt/submission/confirmation/unknown/mismatch states, transaction-hash evidence and deterministic observation metadata. It stores no private key or seed phrase and creates no Agent Account signer.

## 0015_settlement_verification_receipts.sql

Adds M10 deterministic post-confirmation verification: versioned Verification Contracts, durable Settlement Observations, immutable Verified Outcomes, immutable Verified Receipts, exact receipt-gas accounting, and a privacy-preserving asynchronous Arbitrum proof queue. M10 queues commitments only; it does not introduce an anchoring signer or backend private key.

- `0016_routines_background_work.sql` — M11 durable Routines, immutable revisions, exactly-once RoutineRuns, notification inbox/preferences, Routine→Job provenance, and background intelligence-task provenance without fabricated user messages.

### 0017_discover_creator_system.sql
M12 durable Discover/Creator foundation: versioned workflows, isolated creator-imported capabilities, creator test evidence, lineage and marketplace listings. Released Worker versions are immutable; public listing never implies authority or trusted capability eligibility.

M12 Workflow Studio continuity adds `0020_creator_workflow_builder_conversations.sql`, persisting creator-owned Workflow Studio transcript/draft state without granting authority.

### 0021_billing_security_completion.sql
Adds M13 append-only service billing ledger/usage events, deterministic spend controls, marketplace offers/entitlements/subscriptions, creator gross-revenue attribution, testnet-only USDC service-payment evidence and owner-scoped Worker/capability quarantine records. Billing service balance is never wallet capital and commercial acquisition never creates authority.
