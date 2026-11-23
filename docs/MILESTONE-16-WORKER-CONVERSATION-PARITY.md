# AgentPlace M16 Stage 1 follow-up — Worker conversation parity

**Status:** Engineering correction candidate; `pnpm check` and live owner acceptance pending. Based on the latest deployed M16 Stage 1 replacement archive, retaining all prior work.

## Production finding

The first Smart Money Scout direct-Worker conversation successfully created and completed a durable research Job, but **the Worker workspace still used the old research UI**. It displayed a large "I created [long Job title]" message and Job card, then rendered the full report followed by another large Job card. In contrast, the Manager conversation already presented one direct answer with collapsible analysis, coverage and sources. This was a frontend parity omission: the M16 Stage 1 handoff solved navigation and persistence but did not migrate `WorkerWorkspace.tsx` to the accepted M14 conversation-first research presentation.

## Correction

1. **One answer, not a report plus two Job cards.** The Worker thread now recognizes trusted, persisted `msg_origin_result_...` messages attached to the hydrated owner-scoped research Job. It reuses the exact `ConversationResearchAnswer` component already accepted in Manager conversations, including a clear conclusion, "Read full analysis", verification checks, source references and "View work and evidence".
2. **Hide old setup chatter once research is finished.** The persisted `msg_job_created_...` message becomes a small "Investigation started · View setup details" disclosure when the report is available. While work is still running, it shows one compact Job reference so the user can inspect progress without clutter. No runtime or Job state is invented.
3. **Remove only the duplicated Job title.** The backend's `**[Job title]**` prefix is omitted from the Worker chat display only when it matches the saved Job's title. The immutable original report, sources, coverage, Job workspace and database records remain unchanged.
4. **Handle long single-heading reports.** When a specialist places all findings under "Bottom line", the first factual paragraph remains inline and the original supporting detail moves into the "Read full analysis" disclosure. This is a lossless layout change; no re-summarization or additional AI call.
5. **Bring Worker chat ergonomics in line with Manager.** Long user requests can be expanded, and the composer starts with one row, grows for longer text, supports Enter/Shift+Enter, and uses compact send controls. The real Worker conversation, model selector, routine actions, and background task statuses are preserved.
6. **Honor safety and scope.** Only frontend display helpers, one shared layout helper and regression tests are modified. No model prompts, AI invocation, API routes, database migrations, billing, wallet/financial authority, Scheduler, or Mainnet safety gates change.

## Engineering gate

The focused Worker parity tests cover persisted-message provenance, matching Job title removal, lossless long report disclosures, and Worker/Manager component reuse. Prior M14/M16 regression checks must also pass. The owner must run `pnpm check` with the fully installed repo before deploying; do not deploy on failure.

## Live verification — no second AI request necessary

After Vercel deploys, **open the already-completed SOL / Smart Money Scout conversation**. It should present the research conclusion directly, with "Read full analysis", "Verification coverage" and "Sources and references" collapsed and a single "View work and evidence" link. It should not show the full "I created..." paragraph or duplicate Job cards. Expand the setup/details and full report to confirm nothing was deleted. Refresh to confirm the display remains unchanged. A fresh paid research task is not needed to verify presentation-only changes.

**Note:** M15 Stage 2 provider-request telemetry UI remains deferred/unverified. M16 Stage 1 is not a claim of complete autonomous Worker economy or Mainnet readiness.

## TypeScript compatibility correction (November 23, 2026)

The state-layer `Job` type has an optional `kind` discriminator, but the original Worker research presentation helper required `kind: string`. With `exactOptionalPropertyTypes`, passing the actual saved `Job` caused TS2345 during `pnpm typecheck`. The helper now accepts an optional discriminator while retaining its runtime check for `kind === 'research'`: legacy or untyped Jobs keep their existing ordinary presentation. Added a regression case for a Job without `kind`. No execution or authority behavior changes.
