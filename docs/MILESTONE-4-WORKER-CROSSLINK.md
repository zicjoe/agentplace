# Milestone 4 — Job-to-Worker Cross-Link Correction

## Product decision

A Job may use a first-party specialist without automatically installing that Worker into the user’s persistent workforce. Job Workspace must still make Lead and Supporting Workers inspectable.

The accepted behavior is:

- Lead and Supporting Worker references in Job Workspace are explicit navigation targets.
- If the Worker is already in the user’s workforce, the normal persistent Worker Workspace opens.
- If the Worker was only assembled for a Job, AgentPlace opens a contextual Worker Workspace backed by the published Worker catalog and the user’s real Job state.
- The contextual view does not create a `user_worker`, does not create a Worker conversation and does not grant financial authority.
- The same Job is visible from the contextual Worker view and can be reopened directly.
- Adding the specialist to the persistent workforce remains a separate deliberate action through Discover.

## Implementation

- `JobWorkspace.tsx` makes the Lead Worker and Team-tab Worker references clickable even when they are not installed.
- `workApi.ts` reads the existing owner-authenticated `/api/v1/worker-catalog` endpoint; no new backend route or database state is introduced.
- `WorkerWorkspace.tsx` falls back to a contextual catalog-backed presentation when the active Worker is not present in the user’s installed-worker collection.
- The contextual view shows responsibility, default authority posture, anti-jobs and Jobs in which the Worker was lead/supporting.
- No installation or authority mutation is performed by opening the view.

## Local validation

Run:

```powershell
pnpm check
```

Do not deploy if the command fails.

## Production acceptance

Using a completed research Job whose Lead Worker is not already in **Workers**:

1. Open the Job Workspace.
2. Click the Lead Worker in the Job header.
3. Confirm the contextual Worker Workspace opens instead of `Worker not found`.
4. Confirm it clearly says the Worker is not in the persistent workforce and that no financial authority is granted.
5. Confirm the same Job appears under the Worker’s related work and **Open job** returns to the same Job Workspace.
6. Return to the Job and open **Team**. Confirm Lead and Supporting Worker links behave the same way.
7. Confirm merely opening the contextual Worker does not make it appear under **Workers**.
8. If the Worker was already installed before the test, confirm the normal persistent Worker Workspace opens instead of the contextual state.

## Security and state boundaries

- The catalog endpoint remains authenticated.
- Job data remains owner-scoped through the existing Job state APIs.
- Contextual inspection does not install a Worker, create a mandate, create an Authority Grant or enable execution.
- No API key, model credential or signing secret is exposed.
