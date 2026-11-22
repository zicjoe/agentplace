# M16 Stage 1 — Production Acceptance Checklist

**Test once per relevant path. No automatic AI calls are started by the UI changes.** Use an eligible first-party free Worker and a non-financial, read-only task. If a suitable Worker is already installed, start with that path; no need to install it again.

## Test A — Existing Worker

1. Sign in. Open Discover and choose an already-installed Worker (e.g., Crypto Researcher or Meme Scout).
2. Verify **Give work** is available, alongside the existing **Try** option.
3. Click **Give work**. Expect the real Worker conversation, not the Discover detail.
4. Check that the proposed tasks match the Worker's domain. Clicking a suggestion should only fill the text input. It must **not** create a Job until explicitly submitted.
5. Refresh the Worker workspace and confirm prior durable conversation messages, if any, remain present.

## Test B — New installation

1. Choose an eligible free Worker not yet installed. If there are none, use a suitable test account rather than deleting a production Worker for this test.
2. Click **Add Worker**. Verify server-side success and a confirmation with **Give [Worker] work**.
3. Click the new action. Expect the Worker conversation with a working composer or a clearly visible loading/retry state if the conversation fetch fails.
4. Submit one read-only research task. Expect a real durable conversation and Job/Task outcome, not a scripted fixture response. Check the Job workspace and source evidence as appropriate.
5. Refresh and return. Confirm the same Worker and conversation remain installed and visible. No new authority grant should have appeared.

## Test C — Creator Worker handoff

1. For an already-created private Worker, reopen Agent Builder from My creations; or save a test Worker privately using the existing Builder flow.
2. Verify **Give work** appears only when that Worker is installed. Click it.
3. Expect the Worker workspace and durable conversation, not a reset Builder draft or automatic AI request.

## Test D — Unavailable conversation and paused Worker

1. If the API cannot fetch the backend Worker conversation, expect the UI to block Send and provide an explicit Retry control, not simulate a reply. Do not intentionally break production credentials for this test.
2. A paused or ineligible Worker must not silently be reactivated or acquire new wallet permissions. Existing backend eligibility rules remain authoritative.

## Regression and safety

- Manager conversations and existing Job views must still navigate correctly; saved Worker history must not be overwritten by opening Discover.
- Financial execution / Mainnet autonomy remain disabled under production safety gates.
- No unprompted AI request, marketplace purchase, signed operation, or new Routine should occur merely from clicking **Give work**.
- The deferred provider-telemetry panel from M15 Stage 2 is explicitly out of scope.

**Acceptance:** Owner reports successful navigation + durable first task; no fake production replies, duplicate install calls or new financial authority. If any gate fails, repair this same review candidate before advancing.
