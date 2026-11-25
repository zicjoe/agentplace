# Milestone 17 — AEGIS complex Teach Mode recovery

## Observed production failure

During a large AEGIS methodology teaching turn, Agent Builder returned a generic API `internal_error` with request ID `req_deb571df46bc4a6cb2f8f65d61c6dc34`. The Builder stated the saved draft was not changed.

The live API/server code had a 4,000-character `requiredString` limit for the teaching `message`; a too-long message generated `INVALID_CREATOR_BUILDER_MESSAGE`, which the generic HTTP catcher turned into a 500. The persisted `creator_builder_turn.source_message` column *also* imposed a 4,000-character CHECK, so simply raising the API limit without a migration would cause a database failure. A separate deterministic bug let `SET_MISSION` copy a 2,000-character mission into the 1,000-character responsibility field.

These code-level defects can account for this symptom. The exact original request's server log has not been reviewed, so it is not possible to guarantee that no other production error occurred.

## Changes

- Creator Builder teaching turn limit increased to 8,000 characters across UI, API, marketplace persistence, and PostgreSQL constraint (migration `0026_creator_builder_teaching_message_limit.sql`). Initial *new Worker* kickoff limits remain unchanged.
- API returns explicit 400/413 errors for empty/oversized teaching messages, retaining the request ID rather than treating creator-input validation as a 500.
- Builder UI now uses a multiline textarea with character count, contextual warning and no silent truncation. Oversized text is not submitted or deleted.
- Failed teach/edit model turns can be retried without recreating AEGIS; the underlying draft is preserved. Retries may use additional model credits.
- A generated mission remains at most 2,000 characters while its responsibility summary remains at most 1,000 characters, as the canonical validator requires.
- Bad model-proposed draft shapes receive a bounded 422 response rather than an unexplained 500. Financial authority remains unchanged.
- Prompt steers structured teaching toward concise, distinct method rules, preserving thresholds and exceptions, and avoiding unnecessary mission replacement.

## Required rollout order

1. `pnpm check` must pass on the user's machine before deployment.
2. Commit/push only after success.
3. Railway API **pre-deploy `pnpm migrate` must apply migration 0026** before the new API accepts >4,000-character teaching turns. Verify migration success in deployment logs. Do not execute production migrations from the local workstation.
4. Verify Railway API and Vercel frontend successfully deploy. Worker/Scheduler behavior and Mainnet execution/autonomy gates are not changed.

## Production acceptance — use the existing AEGIS draft

1. Open the existing AEGIS Builder session; do **not** create another Worker.
2. Select **Teach unique expertise** or **Continue teaching**.
3. Teach the scoring and missing-data rules in a first bounded message; verify those rules appear in the **Method / Expertise** draft panel, not only as a chat acknowledgement.
4. Teach critical overrides and exception cases in a second bounded message; inspect the saved rules again.
5. Refresh, reopen the draft, and verify the actual saved methodology survives.
6. Attempt a deliberately >8,000-character paste without sending it; the UI must show an explicit warning and keep the text intact.
7. Verify no test, install, publish or financial authorization happened without explicit action.

A model may still be unable to structure an unusually complex, single 8,000-character turn within its output budget. Prefer several smaller, verifiable teaching turns. If the same error recurs, find `req_deb571df46bc4a6cb2f8f65d61c6dc34` or the new request ID in **Railway API** logs and inspect the sanitized `HTTP request failed` `fields.error` entry.
