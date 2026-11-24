# M17 Stage 1 — No-Code Worker Creation Quick Start

**Status:** Engineering review candidate. Starts from the production-accepted v0.17.0 M16 Stage 2B codebase. Production acceptance is pending.

## Intent

AgentPlace users should be able to create a useful Worker without writing code or understanding the Creator data model. This release improves the **entry into the existing Creator system**, not the underlying capability catalog or financial authority model.

## Delivered

1. **Three honest creation paths:** Describe a job, start from an editable template, or turn expertise into a Worker through Agent Builder and Teach Mode.
2. **Six editable briefs:** Crypto Researcher, Wallet Intelligence, Stablecoin Watcher, Perps Risk Watch, Prediction Market Analyst and cross-domain Research & Briefing. They are **starter texts**, not active/live integrations or deployed Workers.
3. **Real draft persistence:** A user explicitly clicks **Build my draft**; the existing authenticated `createCreatorWorker` and `interpretCreatorBuilderTurn` operations produce a durable draft through the deterministic Creator validator. The already-implemented versioning, Builder session persistence, sandbox testing, private installation and publishing flow remain authoritative.
4. **Direct entry:** Create → Worker, Home → Create a Worker, and My Workers → Create Worker all lead to the actual Builder rather than another Manager research request. Adding an existing Worker remains a separate Discover action.
5. **Conversation clarity:** Long starter briefs collapse in the Builder conversation. The live structured draft remains visible and editable via conversational turns, including on mobile.
6. **Private by default:** Creator is told that the first step is a private draft and that model processing occurs. A first-turn model intent cannot auto-test, auto-install, or auto-publish. Do not paste secrets. No Worker installation, test Job, publication, subscription or wallet authority is automatically triggered by choosing a starter.

## Boundaries and limitations

- **No automatic financial permission.** Creation does not create a mandate, grant wallet authority, sign a transaction, or enable Mainnet autonomous execution.
- **No automatic Worker execution.** Choosing a path or template does not call the AI or start a Job. Submitting a brief invokes existing Builder interpretation; sandbox tests, installation, and Worker tasks are separate explicit actions.
- **No new migration.** All persistence uses existing Creator tables and endpoints.
- **No Scheduler changes.** Railway Worker/Scheduler process topology and service costs are untouched.
- Templates do not guarantee runtime implementation for a particular external provider. The trusted Creator validation and the user must check the returned draft's actual eligible capabilities before testing or installation.
- Draft contents and private methods may be processed by the configured AI provider; "private" means *not published publicly by this workflow*, not an end-to-end secrecy guarantee.
- M15 provider telemetry visibility remains deferred. No new mainnet-risk or billing workflows are introduced.

## Acceptance gate

`pnpm check` must pass on the fully installed repository before any deployment. In production, test one new draft from each path (the description and expertise routes may use brief, cheap examples); verify that creation only occurs when submitted, existing drafts and conversations reopen, sandbox tests require explicit invocation, saving privately installs a Worker without financial authority, and no publish action occurs without an explicit choice. A template may be inspected and dismissed without making any AI call.
