# M12 Production Acceptance — Discover + Creator System

Do not freeze v0.15.0 until `pnpm check` passes and these production flows are manually accepted.

1. Open Discover as a signed-out user. Verify supply comes from production and each Worker displays truthful readiness rather than assuming every published Worker is operational.
2. Sign in and create a completely new Worker in Agent Builder from natural language. Teach one unique rule. Reuse an eligible existing specialist where helpful.
3. Start the creator test. Confirm a real Job is created, routing/evidence are inspectable, and the UI never says the Worker self-certified safety.
4. Save the Worker privately. Confirm it appears in My creations and My Workers after refresh/restart. Confirm adding it grants no wallet authority.
5. Run a real read-only Job through the creator Worker. Confirm the Job records and executes the pinned Worker version.
6. Reopen the Worker, edit it, save a new version and test the new version. Confirm existing installed/old Jobs do not silently change versions.
7. Publish the Worker. Confirm it appears in Discover with creator/version/readiness/authority posture. Publication must not imply AgentPlace Verified.
8. Customize a copy of a public Worker. Confirm the draft is preloaded and lineage identifies source Worker/creator/version.
9. Create and save a Workflow, refresh, reopen, edit, and save a new version. Confirm no Routine or financial authority is created.
10. Import a safe public OpenAPI document by upload or HTTPS URL. Confirm real operations are discovered/classified. For a parameter-free GET endpoint, run the read-only sandbox test. Confirm mutating operations are blocked.
11. Attempt an import from localhost/private/link-local or an HTTPS URL containing credentials. Confirm it fails closed.
12. Discover an MCP endpoint. Confirm tools are discoverable but remain execution-sensitive/discovery-only in M12.
13. Confirm paid Worker purchasing and creator earnings/payouts are not simulated.
14. Confirm `MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false` remain unchanged.
