# AgentPlace — Conversation-First UX candidate

**Based on:** `v0.17.0` M14 Stage 3 blocked-Worker continuation correction.
**Status:** Review candidate; **not deployed or accepted**.
**Date:** 20 November 2026.

## Decision

The Manager conversation is the principal user experience. A user states a goal and AgentPlace automatically chooses eligible Workers, capabilities and Jobs; the chat displays the actual response. Job, Worker, evidence, billing and execution structures remain authoritative and inspectable, but do not dominate routine read-only conversation.

This is a presentation refinement, **not** an authorization or runtime redesign.

## Changes in this candidate

1. **Answer in the thread:** A saved, completed Manager research reply (`msg_origin_result_*`) is rendered as the complete `ResearchMarkdown` answer, with a small truthful completion state and a View work and evidence action. The existing saved message is rendered; there is no second model call, duplicate report, or duplicate Job.
2. **Compact lifecycle:** Once the saved research result exists, the original Job-created system message is tucked behind an accessible "Investigation started · View setup details" disclosure. Original historical text remains available. While work is still pending, its normal message and current Job status stay visible.
3. **Compact Job reference:** Show authoritative status and a link, without repeating the user's entire goal. Blocked/failed/Needs you states still direct users to the exact Job decision.
4. **Readable conversation:** Slightly wider response column and typography. User messages keep whitespace, and very long prompts can be expanded or collapsed without rewriting their content.
5. **Compact composer:** One-row initial textarea grows with input, up to a readable maximum, and keeps Enter to send, Shift+Enter for a new line, selected model and existing submit path.
6. **Better auto titles:** New and older *auto-titled* specialist investigations may display a concise asset/network topic. Manually renamed conversation titles are never replaced. This is a navigation projection, not a database rewrite.
7. **Job conversation parity:** Saved research is also readable directly in the Job Conversation tab, while its Result and Team tabs remain available for detailed review.

## Locked boundaries

- **No Worker/Router/intelligence model changes.** Existing Worker auto-selection, routing, orchestration, cost limits and truth attribution are preserved.
- **No financial policy changes.** Action Review, deterministic authority, risk, wallet signing, Mainnet safety flags, settlement verification, billing ledger and emergency controls are unchanged.
- **No new routes, Jobs, database migrations, network integrations or dependencies.**
- **No fake verification badge.** "Research complete" means only that the persisted research Job status is completed. It does not mean all findings, data or sources have been independently verified.
- **No removal of Job Workspace.** It remains accessible for Team, Activity, Result, costs, provenance and operational troubleshooting.
- **No alteration of historical messages or evidence.** Collapsing existing content changes only its display.

## Local verification completed in this environment

- `node scripts/format-check.mjs` — PASS.
- `node scripts/lint.mjs` — PASS.
- `node scripts/verify-milestone-14.mjs` — PASS.
- `node --test tests/m14-conversation-first-ux.test.mjs tests/m4-conversation-ui.test.mjs` — 15/15 PASS.
- Broad raw `node --test tests/*.test.mjs` — 224 PASS, 4 blocked by missing compiled `dist` packages (`router`, `telegraph`, `authority`, `shared`), 1 skipped. This ZIP contains only source files; full `pnpm check` requires the normal dependency build. **The raw suite result is not full validation.**
- Cannot run `pnpm` or a full frontend build in the current environment; must run on the user's machine before deployment.

## Local installation / testing (Windows PowerShell)

1. Save the downloaded replacement ZIP to Downloads.
2. From `C:\\dev\\AgentPlace`, confirm no local uncommitted work needs preservation. Make a backup before merging.
3. Expand the ZIP over the repo root (`Expand-Archive -Force`). Do not remove `.git`, `.env` or production credentials.
4. Run `pnpm check`. If it fails, do **not** deploy. Send the exact terminal output for correction.
5. Run local frontend (`pnpm dev:web`) or use the existing preview workflow and test the following.

## Manual UX acceptance

- **Research with one Worker**: Assistant answer is fully readable in Manager chat without clicking Read inline; source links and unsupported metrics remain visible.
- **Research with multiple Workers**: Previous saved results still display, and View work opens the original Job with accurate Team execution evidence. Budget-skipped Workers are not falsely presented as having executed.
- **Long prompt**: User bubble can reveal and re-collapse the entire request; content remains unchanged in storage.
- **In-progress task**: Before the result arrives, Manager shows real progress and an accessible Job status; after completion, the finished answer appears without a duplicate large Job card.
- **Failure or Needs you**: Blocked/failed Jobs are not hidden as successful answers and remain inspectable.
- **Continue conversation**: A follow-up such as "What about the top holders?" uses the same conversation and normal durable intelligence path.
- **Composer**: Compact when empty, grows for long input, Enter sends, Shift+Enter adds a newline, keyboard focus visible and model selection intact.
- **History**: Auto-titled BONK investigation is shorter; manual rename is never overwritten; pinned/archived/search behavior remains intact.
- **Mobile**: 390px and 320px widths have no cropped answer, composer or View work action.
- **Financial safety**: Wallet, signing, Action Review, revocation and transaction verification remain unchanged.

## Unresolved items (not covered by this UX patch)

- Earlier BONK-on-Solana research mentioned an EVM-formatted watch-only address. This should be separately investigated in the intelligence planning/wallet-context layer, **not** concealed by UI copy.
- The deployed `/health` endpoint previously reported `environment: development`; environment configuration remains a separate M14 review gate.
- Actual controlled provider outage/failure recovery testing and remaining production acceptance were not completed by this UX candidate.
- Future in-chat contextual actions (Monitor, Compare, Save Routine) must be wired to real durable flows, not decorative buttons. No fake actions are added here.

## Rollback

Return to the previously accepted v0.17.0 blocked-Worker ZIP or revert the frontend-only patch in Git. Database/financial runtime schema is unchanged.
