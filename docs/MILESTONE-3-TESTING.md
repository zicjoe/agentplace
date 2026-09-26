# Milestone 3 production acceptance

Run locally first:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

After deployment and migration, test with a signed-in wallet identity.

1. Add an AgentPlace Original such as Meme Scout.
   - Worker appears in Workers.
   - status is truthful (`Standing by`) unless a real persisted Job exists.
   - authority text does not imply financial permission.
2. Refresh and sign out/sign in.
   - Worker persists.
3. Open the Worker Workspace.
   - the Worker Conversation remains durable.
4. Create a supported read-only/research Job from the existing UX flow.
   - Job persists after refresh.
   - Lead/Supporting Workers are retained.
   - Job has its own durable Conversation.
5. Open Activity.
   - Worker addition and Job creation are projected from factual domain events.
6. Cross-account isolation.
   - a different signed-in wallet cannot enumerate or fetch the first account's installed Workers or Jobs.
7. Production safety.
   - `/api/v1/config` still reports Mainnet execution/autonomy disabled according to the environment contract.
   - no Worker installation creates wallet authority.

Do not use prototype financial flows as evidence of real execution. Those become production-backed in later milestones.
