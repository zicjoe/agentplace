# M16 Stage 2B — Worker Controls & Cross-Surface Consistency

**Status:** engineering review candidate; production acceptance pending. Based on the accepted M16 Stage 2A `v0.17.0` working tree. The original mainnet-hardening roadmap remains a separate, gated workstream.

## What this changes

- **One durable control path:** `WorkerLifecycleControls` is shared by the Worker workspace and **My Workers**. Both use the established `PATCH /api/v1/workers/:id` operation for pause, resume, and removal; the API-backed state is refetched on success. No client-only fake mutation in production, no new endpoint. In the separate fixtures mode, existing local reducer operations are retained.
- **Visible, deliberate management:** My Workers exposes an unobtrusive **Manage** disclosure per installed Worker. Pause/resume and removal require explicit confirmation; errors remain visible. Busy state prevents repeat clicks. A completed removal removes the installed Worker from the hub and preserves separately persisted history subject to existing backend policy.
- **Control safety:** Confirmation text identifies associated unfinished lead/origin Jobs, live routines, and independently granted wallet authority. Pausing a Worker does not reverse submitted transactions; removing it does not cancel separately managed routines or revoke independent authority grants. Linked routines and grants are **not modified** by this workstream. Users must manage them in their existing Routines and Security surfaces.
- **Account isolation:** After an in-flight API update, refreshed Worker/Job state is applied only if the active user remains the same account. Existing per-user server authorization remains authoritative.
- **Consistent everyday status:** Home, My Workers and Discover derive displayed Worker state from the same installed Worker + Job + conversation records and the `summarizeWorker` function. Home alerts now include owned Job-based attention (not only `worker.status === 'needs-you'`), and link to the Job when there is one. Supporting Worker participation does not imply the supporting Worker owns approval rights.
- **Paused with attention:** A paused Worker can still be found in both the **Paused** and **Needs you** views when a separately persisted owned Job needs review. Paused remains the installed status; no fake Working state is invented.
- **Discover handoff:** An installed Worker is marked with its derived status. A paused Worker offers **Review paused Worker** instead of promising immediate work.

## Deliberate boundaries

- Frontend-only lifecycle UI and derived state. **No database migration or new backend API**; no mainnet authorization changes, financial grants, Job submission, or new background polling.
- Controls do **not** claim a pause is a hard cancellation of an already-running Job or that removal revokes other persisted authorities. Existing Routines, Security, and Job actions remain the only authorities for their own resources.
- **No Railway Scheduler changes.** The deferred M15 provider telemetry visibility issue remains open.
- No extra AI model calls are needed for acceptance. Use previously installed Workers and existing Jobs/conversations.

## Engineering gate

Run `pnpm check` on the dependency-installed repository. Stop on any failure. To test this feature independently: `node --test tests/m16-worker-management-cross-surface.test.mjs`.
