# AgentPlace Product Workstream 16 — Worker Activation & First-Task Continuity

**Status:** Stage 1 engineering review candidate; owner acceptance and production verification pending. Based on latest deployed v0.17.0/M15 Stage 2 source. This product workstream is not a grant of Mainnet readiness: the original master specification's M16 Mainnet-hardening scope is **not** claimed complete by this work.

## Why this stage

M14–M15 proved conversation-first research and real lead/supporting Worker execution, but those tests only covered a narrow research vertical. The next useful product step is to close the daily user journey **Discover a Worker -> Add a Worker -> Give work -> Inspect the real Job**. Existing Discover ended installation with only a *Back to Discover* control and defaulted many unrelated Workers to BONK suggestions. A second latent failure could occur if the just-created Worker conversation had not yet been reloaded in the current UI session: production send could fall through to prototype simulation instead of the durable API.

## Implemented

1. **Direct use after install.** A successfully added Discover Worker now offers a **Give [Worker] work** action; already-installed Worker listings offer **Give work**. This opens the existing Worker workspace. Nothing is submitted automatically. Discover's existing Try sandbox Job remains available separately. When marketplace access has been paid for but installation fails, the UI no longer falsely announces a successfully added Worker or instructs a second purchase.
2. **Durable first-task continuation.** After the actual `POST /api/v1/workers` succeeds, the client loads the backend-created owner-scoped Worker conversation and adds it to current state without forcing navigation or overwriting other messages. If a conversation is missing when the Worker workspace opens (including old sessions and transient API failures), it retries loading. The composer fails closed until the real conversation exists: **no production request may degrade silently to a simulated fixture reply**.
3. **No duplicate install side effect.** `ADD_WORKER` now distinguishes a Worker that was **already persisted** by a successful installation API response; such an add no longer launches a second installation request. The prior state-sync behavior remains for legacy local-first original Worker adds.
4. **Contextual, conservative starters.** The first-task prompt suggestions are specific to each of the nine first-party Worker definitions. Unknown/custom Workers receive generic questions about their supported read-only tasks and capability limits; arbitrary creator descriptions are not converted directly into instructions. Clicking a suggestion only fills the composer for user review, it does **not** incur AI costs or create Jobs.
5. **Created Worker handoff.** After **Use privately** in Agent Builder, a saved and installed Worker offers **Give work** directly, without returning to the Workers list or submitting a task. This preserves the existing builder conversation and revision history.
6. **Navigation consistency.** Opening a Worker dismisses a previously open Discover detail, routine, or creator overlay so that the real Worker workspace is shown immediately. Existing approved visual components are retained.

## Explicit scope and safety boundaries

- **No Mainnet execution** or enabling Mainnet autonomy.
- **No automated first task submission.** The user must explicitly press Send.
- **No additional financial authority** from installing, opening, or speaking to a Worker.
- **No new migration**, external protocol, payment rail, or provider credential.
- **Scheduler unchanged**; no deployment topology, financial model or risk-engine changes.
- A Worker can still be paused, unavailable, lack tools or be ineligible. The backend remains the authority for Job routing and eligibility; starter prompts are not promises of capability.
- This stage does not implement agent-to-agent hiring, new creator payouts, permissions, or unapproved production Mainnet operations. Those are separate product decisions.
- The deferred M15 Stage 2 telemetry panel remains unverified. Do not present its missing display as fixed by this Worker UX stage.

## Engineering and production gate

- On the owner's dependency-installed Windows workspace run `pnpm check` (includes `verify:milestone-16` and focused tests). Do not deploy on failure.
- No database migration, API, Worker or Scheduler changes are required. Vercel's web build is the primary changed deployment artifact; normal connected-service status checks still apply.
- Test on production **without paying for repeated research just to check the UI**. Use an eligible free read-only Worker for the first path, or an already installed Worker for a no-cost navigation check.
- Do not claim complete M16/launch readiness until the owner accepts this Stage 1 scope and the live path passes.

## Engineering caveat

This update is deliberately narrow: it makes an already-built Worker runnable from its Discover detail, and ensures that the first real message is eligible for the durable API. It does not substitute for the broader later Worker economy, capability marketplace, agent-to-agent procurement or actual creator-supply acceptance tests.
