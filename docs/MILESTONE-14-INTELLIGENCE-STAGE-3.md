# M14 Stage 3 — Bounded Goal Planning and Real Multi-Worker Collaboration

**Status:** v0.17.0 implementation candidate. Requires `pnpm check` and real production acceptance before M14 freezes. Build on the last M14 prior-report-continuity candidate, not the old foundation. Telegraph/x402 remains parked.

## What is real

The trusted Router still determines the eligible read-only Worker team. For Jobs with supporting Workers, the new deterministic collaboration planner builds a dependency graph: **structured provider evidence → independent supporting-Worker investigations → lead synthesis and research-coverage verification**. Each invoked specialist now makes its own read-only model/web-research call using its pinned Worker contract; a lead model call synthesizes the preserved specialist report(s) and fresh provider evidence. The Job stores status, purpose, dependencies, source references, and truncated report evidence for each plan step in the owner-scoped `job_orchestration_step` table. Model runs and Job Activity attribute real participation to specific Worker IDs. Job Workspace → Team displays completed, unavailable, and budget-skipped work instead of misrepresenting assignment as execution.

A supporting-Worker report is untrusted analysis, not verified proof and never authority. The lead is instructed to reconcile conflicting claims and label missing evidence. Already-completed specialist steps and saved Manager proposals can be reused after interrupted processing; a periodic, attempt-fenced lease renewal reduces duplicate claiming during long research. A persisted lead synthesis is reused if the Worker restarts before publishing the final Job report. Provider invocation that fails before recording its result may still incur a provider-side charge; exactly-once LLM billing cannot be guaranteed without provider-level idempotency. The lead's final saved report remains in the Job conversation for Manager follow-ups.

## Budget and scope

`AI_MAX_CALLS_PER_TASK` still defaults to **3 completed model invocations per intelligence task**. A normal Manager Job consumes one planning call and reserves one for lead synthesis; therefore by default **at most one independent supporting Worker actually runs**. Extra assigned Workers are shown **Not run — budget limit** and are **never credited with findings**. Explicitly increasing this existing operator limit after a cost review can allow additional specialists (hard cap three independent specialists per Job); no new env variables are required. If remaining capacity is insufficient for a specialist, the run is skipped. A failed specialist does not fabricate findings: the lead proceeds with disclosed evidence gaps where possible.

This milestone does **not** implement fully general task-graph computation, arbitrary agent-to-agent payments, automatic external tool installs, financial delegation, automatic Routine activation, concurrent supporting-Worker execution, dynamic three-asset fanout from unverified holdings, or unrestricted Workflow/MCP execution. The stage graph is deliberately bounded and serial, with explicit dependency relationships. It does not override deterministic routing, entitlement, quarantine, provider eligibility, or daily/model-call ceilings.

## Database / deployment

- Additive migration: `packages/db/migrations/0024_manager_collaboration_steps.sql`.
- Deploy current commit in order: **Railway API with `pnpm migrate` predeploy → Worker → Scheduler → Vercel**. Do not run migration from a laptop if Railway API already runs the predeploy migration.
- Keep `MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false`.
- No new secret keys, signer, payout, or x402 configuration. Worker now links the existing Billing package so entitlement is rechecked before every specialist/lead model invocation; run `pnpm install --frozen-lockfile` with the supplied replacement.

## Production acceptance gate

1. Under an authenticated account with eligible installed **Crypto Researcher** and **Meme Scout**, ask the Manager to use both for an evidence-grounded BONK investigation. Inspect **Job Workspace → Team → Executed collaboration plan**. A specialist is a participant **only** if its step says Completed; verify a matching `job.specialist.completed` Activity event, specialist message in Job conversation, source references and a Worker-attributed model run. The lead synthesis must mention relevant findings without inventing provenance.
2. Reopen and hard-refresh the Job. The orchestration step statuses, Job Worker team, specialist messages and final report must persist. Reopen the Manager conversation and ask a follow-up referencing the saved report; it must work without pasting it back.
3. With more than one supporting Worker and the default call cap, check that additional support appears as **Not run · budget limit**. Do not accept a report claiming all assigned Workers independently researched.
4. Simulate an unavailable specialist/provider (not a wallet operation): the step should be marked unavailable, and the lead should still present a truthful partial report when its own provider works. No fake verified data, no retry as a transaction.
5. Confirm a second account cannot read the first account's Job/orchestration steps. Confirm paused/quarantined Workers remain ineligible. No wallet action, approval, mandate, or transaction should be produced.
6. Verify actual model charges in Billing/Job costs reflect Worker model runs. Confirm configured per-task and daily caps are respected. Neither a paid subscription nor a Worker installation grants authority.

## Unresolved Stage 3 follow-up

After this bounded collaboration gate passes, evaluate whether **dynamic subject fanout** (e.g., verify top-three wallet exposures, then assign each to an eligible specialist) is justified. That needs explicit budget approval, an authoritative asset-selection contract and more durable recovery controls before implementation. Do not claim it already exists.
