# M14 intelligence acceptance — prior Job-report continuity correction

**Status:** same-M14 implementation candidate, awaiting local full `pnpm check` and production acceptance. No release tag. No migration or configuration change.

## Defect confirmed

In M14 Stage 2 Test D, the Manager knew the earlier BONK Job existed but asked the user to paste the most significant risk from its report. The account-wide resource snapshot included Job title, status and goal only. The Manager prompt also truncated recent conversation messages. Neither reliably gave the planner access to the actual persisted report despite the Job having a durable Job conversation and evidence.

## Correction

- Detect explicit references to prior Job reports and related conversational findings in the existing authenticated Manager/Job conversation.
- Read the **owner-scoped saved Job metadata**, select the related Job (prioritizing the current Manager conversation or current Job Workspace), and only then load that Job's final specialist report from the durable Job conversation.
- For a specifically named older report in another conversation, allow cross-conversation lookup **only within the authenticated account**. Ambiguous matches require clarification rather than guessing.
- Pass a bounded report excerpt to the Manager planner and to the read-only research Worker as **untrusted historical data**, not executable instructions, authority, or a substitute for fresh evidence. If the report is too long, disclose truncation and refuse unsupported rankings.
- Complete and publish the Job's final report before marking the Job `COMPLETED`, preventing a race where a subsequent message sees a completed Job with no report.
- Retain the prior Job ID as trace metadata, without duplicating the full report into observability logs.
- If the saved report is unavailable, accurately describe its state; do not invent the biggest risk or ask the user to paste data the platform should own.

## Production acceptance (Stage 2 Test D retry)

1. From the original **Manager** conversation that produced the BONK multi-Worker Job, confirm the earlier Job is completed and its full saved report is accessible through Job Workspace. Do not paste the report into chat.
2. Ask: **“Now investigate the biggest risk you identified. Focus on why it matters and what evidence supports it.”**
3. Expected: Manager uses the **actual earlier report** to identify the prior finding (or says that no single top risk was ranked), carries the specific subject into a new read-only investigation, and distinguishes historical claims from fresh evidence.
4. Inspect the new Job goal, Router, Worker assignments and evidence. Do not accept a convincing answer without an actual linked previous-Job context and a new Job.
5. Hard refresh and continue in the same Manager conversation, referring to **“that risk”**; confirm consistent subject selection and durable conversation state.
6. Reopen the **Job discussion** and ask a report follow-up there. The same owner-scoped saved report should be available in that scope.
7. Check that a different signed-in user cannot access the prior account's report, and that there are no new mandates, payments, signatures or financial Actions.

## Boundaries

A report may contain multiple unranked risks. Do not fabricate an ordering. A historical URL does not establish current market conditions. A report over the context cap is explicitly marked as partial. This does not introduce arbitrary tool invocation, live Telegraph/x402 payments, Mainnet execution, or autonomy.
