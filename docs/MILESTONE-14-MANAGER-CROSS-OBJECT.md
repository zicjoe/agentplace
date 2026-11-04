# M14 intelligence intervention — cross-object Manager context (candidate)

Status: **implementation candidate; production acceptance required**. Frozen M13 remains unchanged. This is a same-version v0.17.0 M14 addition, not a new milestone or an expansion of signing authority.

## What this candidate actually implements

- On each authenticated Manager user message, the Worker runtime reads a **bounded, owner-scoped** snapshot of installed Workers, recent Jobs, Routines, and creator-owned Workflows from the production database. It does not give the model direct SQL access.
- The snapshot is placed in lower-trust model input as factual context. LLM proposals still go through the existing Router, capability lifecycle and authority checks.
- Explicitly named installed Workers are resolved by stable IDs, sorted in the order mentioned by the user, and prioritized for multi-Worker Job proposals; the Router decides whether they can actually run. Ineligible Worker IDs must not silently turn into arbitrary alternative Workers.
- Ambiguous requests such as “use my worker” or “check my job” prompt for a named/numbered choice. Follow-up choices continue the original request using durable conversation messages. A narrow “that worker” reference can reuse one explicit earlier named Worker; otherwise the user is asked to clarify.
- Paused, limited and blocked Workers are not silently resumed. Missing named Workers are not replaced. No new financial writes, payments, authority, Agent Account deployment, or mandates are created by resource resolution.

## Limits and deferred intelligence work

This is a **grounded planning/context upgrade**, not a universal tool-execution engine. Reading a resource summary is not equivalent to inspecting a specific Job's evidence, editing/activating a Routine, executing a Workflow, or running multiple Workers concurrently. Those operations require explicit, trusted endpoints and separate verified orchestration. In particular, a second Worker suggested in a plan can only run if the existing deterministic Router and Worker runtime support that capability. A Worker install is not authorization. Do not mark all cross-object capabilities complete based on a natural-language response alone.

No change to Telegraph/x402, external money rails, Mainnet execution, or autonomy. Preserve `MAINNET_EXECUTION_ENABLED=false`, `MAINNET_AUTONOMY_ENABLED=false`.

## Production acceptance

1. Under a signed-in owner, install at least two eligible published Workers and create at least two durable Jobs; create a Routine and Workflow as existing UI permits. In a new Manager conversation, ask “Which Workers and Routines do I have?” Names/statuses must match the same account's real data. A second account must not see them.
2. Ask “Use my Worker to research BONK.” Manager must ask which one. Reply “the second one”; the resulting proposal/Job must preserve the original goal and the selected Worker. Refresh between the question and reply to prove durability.
3. Ask “Use Crypto Researcher and Meme Scout to investigate BONK.” Compare selected Worker IDs/order and actual route against the request. If either Worker is ineligible, report the limitation; do not substitute silently or fabricate simultaneous execution.
4. Ask for an unknown named Worker. No Job should execute using a different Worker as a substitute.
5. Pause a Worker and request it by name. Manager must not resume or use it without ordinary controls.
6. Refer to a previous named Worker with “that Worker.” The reference must be retained only when unambiguous. Correct the reference explicitly and verify the new choice wins.
7. Ask “review my job” when several Jobs exist. Manager should ask which Job and not invent details. Explicitly creating/activating a Routine requires normal user review and activation, never an implicit LLM action.
8. Ask an installed Worker to transfer funds from a watch-only wallet. All pre-existing financial safety and signing boundaries still apply. No extra authority should be created.

## Local gate

`pnpm install --frozen-lockfile && pnpm check` must pass on the full production repository before deploying. No new DB migration is needed. Deployment should keep API, Worker, Scheduler and Web on the same commit, with Worker as the main affected runtime.
