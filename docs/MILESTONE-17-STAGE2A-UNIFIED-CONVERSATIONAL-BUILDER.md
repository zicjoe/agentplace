# Milestone 17 — Stage 2A: Unified Conversational Builder

**Status:** review candidate; requires `pnpm check` and live production acceptance.

## Why this stage exists

The earlier Builder forced a three-way kickoff form and separated "Teach" and "Edit" after creation. Real creators alternate between short chat, long briefs, templates, and changing their methodology **inside one Worker**. This stage brings the previously accepted Manager/Worker conversation-first pattern into Creator without creating a second Worker data model.

## Implemented

- The default **Create → Worker** workspace is a chat with a plain-language opening question and a compact composer. A detailed creation form remains accessible as an optional power-user path.
- Six safe starter templates can be inserted **at any point** in the **same** persisted Builder conversation. Selecting a template stages editable text for creator review, not an automatic AI call or installation. On an existing Worker, its text says to preserve current mission, expertise, and safety unless deliberately changed.
- "Teach a rule" and "Edit or combine" are light-touch shortcuts. The existing backend interprets `build`, `teach`, or `edit` turns, but the creation-entry route no longer locks later instructions into one category.
- Explicit input length errors: no silent truncation, no automatic splitting, no automatic partial application. At the current 8,000-character boundary, keep text in the editor, optionally copy it, or edit before submitting. The browser warns when closing with an unsent composer entry or refreshing the page while unsent text remains. Browser-level warnings are not a substitute for encrypted private-source persistence, which is deferred.
- On a submitted turn, AgentPlace creates/uses the existing private creator asset and saves the user message **before** requesting the language model. The UI distinguishes "saving" from "saved" and offers retry on session-saving failures. AI-provider errors preserve the draft and support retry.
- A model-generated `TEST`, `SAVE_PRIVATE`, or `PUBLISH` intent cannot autonomously trigger these actions: the user must activate existing explicit test/private/public controls. Model-inferred Undo requires an explicit creator utterance.
- Existing private Worker authority, owner scoping, Creator validators, conversation and Job history, installed version pinning, test pathways and Mainnet restrictions are unchanged.

## Not yet implemented; don't claim these are live

- PDF/DOCX/XLSX or URL knowledge ingestion, source staging or a 100,000-character private paste endpoint.
- Cross-tab optimistic concurrency, rule-by-rule change-set approvals, deterministic scoring-rule enforcement, large-file quotas, or 100+ turn stress testing.
- The proposed **16,000-character chat** and **100,000-character source** product targets. Stage 2A deliberately retains the known 8,000-character API/storage limit until the complete long-source processing pipeline is ready.
- Full model-provider outage remediation. Existing transparent error and retry behavior is retained; repeated upstream 503s still need request-ID diagnosis.

These are separate Stage 2B–2E release gates. The standard is described in `docs/AGENTPLACE-M17-BUILDER-INPUT-RECOVERY-STANDARD-v0.1.md` and is not fully satisfied by this candidate.

## Data and trust boundaries

The authoritative draft is the existing owner-scoped Creator asset/session, **not** the list of AI messages. Starter suggestions are untrusted reference text. Selecting one cannot install a Worker, grant financial permissions, invoke providers, or change Mainnet gates. Saving a transcript is not the same as claiming deterministic runtime enforcement of creator rules. Explicitly trigger test/private-use/publication only through the established creator controls.

## Rollout

1. Extract the **full replacement ZIP** into the existing `C:\dev\AgentPlace` repository after preserving unrelated local edits.
2. Run `pnpm check`. Do not deploy if any step fails.
3. Commit/push to the deployment branch. There is **no new migration** for this stage; the existing M17 migration 0026 remains required.
4. Confirm Vercel frontend and Railway API are healthy. Scheduler is unchanged.
5. Test both an existing AEGIS draft and a brand-new private draft using `docs/MILESTONE-17-STAGE2A-PRODUCTION-TESTING.md`.

The provided CI environment can run standalone Node tests and syntax validation, but not dependency-backed TypeScript builds; the user's full `pnpm check` remains the required engineering gate.
