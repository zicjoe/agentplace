# Milestone 11 — Routines + Background Work

Version: **AgentPlace v0.14.0 candidate**

## Goal

M11 turns the approved Routine UX into durable production background work. A Routine is recurrence/triggering owned by a Worker; it never grants wallet authority or signing power.

The production lifecycle is:

```text
User intent → Routine draft → explicit Activate
→ Railway Scheduler → exactly-one RoutineRun
→ deterministic trigger evaluation
→ real Worker Job when work is required
→ durable result / Needs you / Limited
→ in-app notification when policy requires it
```

Closing the browser does not stop an active Routine.

## Durable model

Migration `0016_routines_background_work.sql` adds:

- `routine` — owner, Worker, environment and current operating state;
- immutable `routine_revision` — instruction, trigger, budget, notification and authority-reference configuration;
- `routine_run` — one durable attempt/occurrence with duplicate-run protection;
- `notification` and `notification_preference`;
- Routine/Run links on Jobs;
- explicit `USER_MESSAGE | ROUTINE | SYSTEM` intelligence provenance so background work never fabricates a user-authored message.

Routine revisions are append-only. Existing runs remain bound to the revision that caused them.

## Trigger types

### Scheduled

Structured schedules are calculated server-side using an IANA timezone. The LLM/browser may help create a draft, but the Scheduler determines when an approved Routine fires.

### Condition

M11 conditions use deterministic typed market metrics and predicates. A false condition becomes `NO_CHANGE` with no Job and no model call. A matching condition creates one real Worker Job and respects cooldown.

### Event

M11 supports AgentPlace-domain events such as `job.completed`, `outcome.verified`, `action.blocked`, `worker.added`, `wallet.connected`, `wallet.disconnected` and `authority.expiring`. Event identity is persisted so the same event cannot fire the same Routine twice. Routine-origin `job.completed` events are excluded from event-trigger chaining to prevent recursive Routine loops.

General external/onchain webhook infrastructure is deferred.

## Scheduler

`apps/scheduler` is a dedicated long-running Railway service. It uses PostgreSQL leases and `FOR UPDATE SKIP LOCKED` so multiple Scheduler replicas cannot claim the same due occurrence simultaneously.

PostgreSQL remains the source of truth; Redis/BullMQ/Temporal are not introduced in M11.

## Routine → Job

Meaningful scheduled/event/condition triggers create a durable Job with:

- `origin_type = routine`;
- `origin_routine_id`;
- `routine_run_id`;
- a Job conversation containing an AgentPlace-generated provenance note;
- an intelligence task with `input_source = ROUTINE` and the approved Routine instruction.

No fake user message is created.

## Budgets and failure behavior

Each Routine can carry a service-spend period limit and per-run ceiling. Budget is checked before paid background work starts. The Routine does not gain capital authority from a service budget.

Repeated provider/Job failures move the Routine to `LIMITED`; AgentPlace stops future automatic work and creates a durable Needs-you notification. `Retry once` is deliberately separate from `Resume future checks`.

## Notifications

M11 makes the existing in-app Notification Inbox durable, including read state, dedupe keys, quiet-hours preferences, privacy-preview preference and deep links. No email/SMS/push/Telegram provider is selected in this milestone.

## Authority and custody boundary

M11 adds no signer or custody.

- Watch-only remains non-executable.
- Connected Wallet background work may research/recommend/prepare supported future work, but the user still signs every financial transaction.
- Agent Account execution remains unavailable/undeployed.
- A Routine may reference current authority but cannot create, widen or preserve revoked/expired authority.
- `ACT_WITHIN_AUTHORITY` is rejected in the M11 production Routine path.
- Routine-origin intelligence is explicitly blocked from the Worker’s direct transfer/bridge preparation shortcut.
- `MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false` remain the production defaults.

## Make this recurring

A suitable completed Job can create a **prefilled Routine draft**. The user must still review the Routine and press **Activate Routine**. The conversion never silently schedules future work.

## Deliberately deferred

M11 does not add autonomous Mainnet execution, Agent Account signing, Connected Wallet auto-signing, external notification delivery, arbitrary webhooks, high-frequency bots, LLM-polled conditions, Redis/BullMQ/Temporal, new financial execution capabilities, additional Verification Contracts, Routine marketplace publishing, billing settlement or live proof anchoring.
