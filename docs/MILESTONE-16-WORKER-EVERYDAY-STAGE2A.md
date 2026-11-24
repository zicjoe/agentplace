# M16 Stage 2A — My Workers & Continue Work

**Status:** engineering review candidate on the latest accepted v0.17.0 M16 Stage 1 + conversation-parity correction. Production acceptance is pending. This is an everyday-use workstream, **not** a claim that the original Mainnet-hardening milestone in the master roadmap has been completed.

## Scope implemented

- **My Workers hub:** Replaces the plain installed-Worker list with compact cards, clear state badges, recent activity context, and an Add Worker route to existing Discover.
- **At-a-glance triage:** All / Working / Needs you / Paused views, with summary counts derived from existing Worker and Job state. Monitoring and standing-by Workers remain in All.
- **Continue Work:** The primary action opens the **existing worker-scoped conversation** when messages exist. Empty or missing worker conversations show Give work. Paused Workers show Open Worker instead of a misleading Give Work promise. No background tasks or financial actions are started by clicking any hub action.
- **Recent work & history:** Where persisted Jobs exist, show the newest associated work, status and last update. Users can open the existing Job workspace for progress or evidence, and expand up to five recent associated Jobs within a Worker card. A supporting Worker contribution can appear in history, but does not imply that Worker owns the Job's approvals.
- **Created and third-party Workers:** Hub is based on the installed Workers returned by the existing per-user API, not a hard-coded first-party Worker registry. A Worker is labeled **Created by you** only if its installed ID matches an owner-scoped creator Worker asset; AgentPlace Originals are labeled accordingly, and unrelated community Workers receive neither label. Available updates are surfaced as review cues, not auto-applied.
- **Consistency:** Uses `state.workers`, `state.jobs`, and `state.conversations` that the production state facade already hydrates and refreshes (including when messages and Jobs change). No extra polling endpoints or duplicate conversation tables are introduced.

## Deliberate Stage 2A boundaries

- **No new database migrations or backend APIs.** All changes are frontend presentation, derived-state logic, tests and documentation.
- **No new Worker pause/resume/remove backend logic.** The established Worker workspace controls remain available. These controls and more nuanced cross-surface attention indicators are Stage 2B.
- **No Mainnet execution/autonomy changes, no wallet permission grants, no implicit paid Worker tasks, and no changes to the Scheduler.** Pausing is not represented as reversing transactions or revoking independently granted permissions.
- **No fabrication of outcomes:** Completed Jobs are described as Jobs, not verified financial outcomes. UI statuses are based on Worker state and existing Job statuses; no `Outcome` is fabricated from a completed Job.
- **No new research run needed to validate continuity.** The already persisted Smart Money Scout conversation and SOL research Job are sufficient.
- **Deferred:** M15 Stage 2 provider telemetry panel visibility and Railway Scheduler cost optimization remain open and untouched.

## Engineering gate

Run `pnpm check` on the owner's dependency-installed Windows repository. Do not deploy on failure. Additional targeted tests: `node --test tests/m16-worker-everyday-work.test.mjs`.

## Production gate

See `docs/MILESTONE-16-WORKER-EVERYDAY-STAGE2A-TESTING.md`. Accept only after existing Worker conversation continuity, Job references, filters, account boundaries and mobile layout are verified in production.
