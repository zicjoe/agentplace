# M16 Stage 2B — Production Acceptance

Run against an already installed Worker after a passing `pnpm check` and deployment. Prefer existing activity; do not create a paid research Job to test navigation or controls.

1. **My Workers → Manage:** Open a Worker card, expand Manage, then cancel a pause confirmation. Confirm nothing changes. Pause the Worker with confirmation; verify its status updates in My Workers without refresh, and the Worker workspace reflects the same status. Resume and confirm parity.
2. **Cross-surface consistency:** From Home open the same Worker. Confirm its status, most recent Job and Continue work behavior match My Workers. Discover should label the installed Worker and reflect paused state; selecting it should open the existing Worker, not reinstall.
3. **Needs you:** If a current owner-scoped Job requires approval or review, Home's attention card should open that Job, not an unrelated Worker. A supporting specialist must not own the lead's approval. A paused Worker with a separate owned pending Job must remain visible under Needs you and Paused.
4. **Removal safety:** Open Remove Worker and **cancel**. Read the confirmation carefully: it must say that independent grants, linked routines, submitted transactions and historical Jobs are not automatically revoked/cancelled. Optional destructive test only with a disposable Worker: confirm removal, verify installed list/Discover update and that historic Job records remain accessible where the backend policy permits.
5. **Regression:** Reopen Smart Money Scout's previously completed SOL conversation; it should still use the accepted conversation-first UI. Existing Job evidence remains accessible. Repeat from narrow/mobile viewport and check that controls remain usable.
6. **Deployment health:** Railway API and Worker healthy; Scheduler unchanged. No migration. Mainnet autonomy and execution flags unchanged.

**Acceptance:** Clear statuses and safe lifecycle controls across three surfaces; server-confirmed updates; no implicit financial permission mutation; no duplicate installation or paid research. Any failed control must present an error and must not pretend success.
