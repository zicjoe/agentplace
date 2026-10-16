# Milestone 11 Manual Acceptance — v0.14.0

M11 is not frozen until `pnpm check` passes and the production background-work behavior below is manually accepted.

## 1. Draft and explicit activation

From a Worker conversation request a safe Routine such as:

```text
Check stablecoin opportunities every weekday morning. Only tell me when something materially improves.
```

Expected: a durable Routine **Draft** opens. Nothing is scheduled until **Activate Routine** is pressed.

## 2. Persistence

Activate, refresh and reopen AgentPlace. Expected: the same Routine and next-run state persist.

## 3. Run now

Press **Run now**. Expected: exactly one RoutineRun creates a real Job, the Job links back to the Routine, and Routine history links to the Job. The future schedule is unchanged.

## 4. Browser-independent background work

Use a short safe schedule, close the browser, allow it to become due, then reopen. Expected: the server-side Scheduler created the Job without browser timers.

## 5. Pause/resume/stop

Pause across a due time: no automatic Job. Resume: future scheduling returns without a catch-up storm. Stop: future runs remain stopped while history stays available.

## 6. Condition trigger

Create a deterministic market condition known to be false. Expected: background `NO_CHANGE` checks, no noisy Job and no model call. Use a threshold known to become/are true. Expected: one Job, followed by cooldown rather than repeated Jobs.

## 7. Event trigger

Activate a supported AgentPlace-domain event Routine and cause the event once. Expected: one RoutineRun/Job. Scheduler restart must not duplicate it.

## 8. Budget/Limited

Configure a deliberately small service budget. Expected: AgentPlace refuses new paid background work when exhausted, Routine becomes **Limited**, and a durable Needs-you notification appears.

## 9. Notifications

Produce one material Routine result. Expected: notification persists through refresh, read state persists and the item deep-links to the owning Routine/Job.

## 10. Make this recurring

From a suitable completed non-Routine Job press **Make this recurring**. Expected: a prefilled Routine Draft. It must not activate automatically.

## 11. Financial boundary

Throughout testing confirm no Routine can sign a transaction. Connected Wallet remains user-signed; Watch-only remains read-only; Agent Account execution remains unavailable; Mainnet execution/autonomy stay disabled.
