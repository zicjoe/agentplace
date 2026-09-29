# AgentPlace v0.5.0 — M4 conversation-history grouping correction

**Status:** Focused correction awaiting local and production acceptance. M4 remains **open**.

## Production finding and root cause

One read-only research request created two *different, expected records*: a Manager conversation (user request, creation confirmation and mirrored report) and an internal `scope='job'` conversation (specialist's durable Job discussion). The API correctly returned both, but the sidebar displayed both as independent primary history entries. Additionally, the first Home request persisted `New conversation` rather than a useful title. This was observed for GMX and Aave. The screenshots do not prove two research Jobs were created, and the existing Worker creates its research Job with a deterministic task-derived ID.

## Correction

- Ordinary sidebar history (recent/pinned/archived) projects Manager and Worker conversations. It excludes Job-scoped discussions *from that one projection*, **not from PostgreSQL, the API, or Search**. A Job conversation belongs in its Job Workspace.
- Search may still return a Job conversation for research-specific text. It is visibly labeled `Job · Opens Job Workspace`; selecting it opens the authoritative Job ID, not a second full-screen conversation.
- Existing direct `/conversations/<job-conversation-id>` bookmarks resolve to the owning `/activity/jobs/<job-id>` route once the current account's durable conversation is available. The old history entry is not deleted or archived.
- New Home Manager conversations receive a bounded, deterministic first-prompt title. Old `New conversation` records get a useful **display-only** title from their linked Job or original user prompt. User-renamed titles always win. Opening/renaming the same thread uses this displayed title, but no historical title or message is silently rewritten.
- Opening a Job from the origin thread preserves back navigation to that origin. Search and legacy Job-conversation redirects clear only their obsolete conversation selection. Manager and Job remain connected by `originConversationId`, `jobConversationId`, message `jobId`, and the existing Activity projection.

No database migration, new paid provider, npm dependency, API-key change, signing change or financial write is introduced. Existing Milestone 1–3 state and M4 research behavior are preserved.

## Windows installation — current production checkout

1. Download the complete `AgentPlace-v0.5.0-M4-conversation-history-fix.zip` and extract it to `C:\dev\AgentPlace-M4-conversation-staged` (or note the folder you actually use). Confirm the extracted folder contains `apps`, `packages`, `docs`, `tests`, `package.json`.
2. Keep the existing checkout at `C:\dev\agentplace`, including `.git`, local `.env` files and installed `node_modules`. Copy only the changed files from the staged ZIP, or use the safe whole-tree copy below. **Do not use `/MIR`** and do not delete previous local files.

```powershell
$staging = 'C:\dev\AgentPlace-M4-conversation-staged'
$repo = 'C:\dev\agentplace'
robocopy $staging $repo /E /XD .git node_modules dist /XF .env .env.local
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy exit code $LASTEXITCODE)" }
Set-Location $repo
git status
```

3. Check that the staged file changes match this patch before committing. Then run:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

If `pnpm check` fails, stop and share its **first** error. Do not deploy. This package was tested with source-level checks but full local dependency-backed typecheck/build must pass on your machine.

4. After the complete check passes and the file list is reviewed:

```powershell
git add CHANGELOG.md apps/web/src/components/ChatView.tsx apps/web/src/components/GuestHome.tsx apps/web/src/components/Sidebar.tsx apps/web/src/fixtures/FixtureAppContext.tsx apps/web/src/platform/conversationNavigation.ts docs/MILESTONE-4-CONVERSATION-GROUPING.md docs/MILESTONE-4-TESTING.md tests/m4-conversation-ui.test.mjs
git commit -m "fix(m4): group job conversations under their originating thread"
git push origin main
```

5. Wait for Vercel to deploy; Railway may also rebuild under existing monorepo triggers. No database migration is needed. Keep all server-side AI keys and Worker settings unchanged. Hard-refresh `https://www.agentplace.tech` at 100% zoom.

## Production acceptance

- [ ] Reopen the existing GMX research: **one** ordinary GMX thread is shown in sidebar history; the existing Job remains reachable from its `Open job` button and Activity.
- [ ] The older Manager `New conversation` thread displays `Research GMX on Arbitrum` (or its original request) without changing the stored user messages. Existing manual titles remain unchanged.
- [ ] Click Open job, inspect the Job Conversation and Result tabs, and return to Origin conversation. Both contain their expected context and preserve the **same Job ID**.
- [ ] Search for a phrase that appears only in the specialist report. A `Job`-labeled result opens the Job Workspace. Search for the Manager prompt; it opens the originating thread.
- [ ] Reopen an old `/conversations/jobconv_...` bookmark while signed into its owning account. It navigates to `/activity/jobs/...`. Cross-account Job URLs remain inaccessible.
- [ ] New Home research begins with a meaningful conversation title on its **first** request. No duplicate sidebar entry appears when the Job is created or completed, including after refresh and sign out/in.
- [ ] Confirm that one requested research task produces one Job ID in Activity, without rerunning or charging a new AI task from simply viewing the existing Job or its results.
- [ ] Repeat on mobile conversation drawer and normal desktop zoom.
- [ ] Complete the remaining M4 process/browser interruption, model persistence, capability truthfulness, provider-failure and account-isolation checks from `docs/MILESTONE-4-TESTING.md` before freezing M4.

## Boundaries and limitations

Job conversations remain distinct records by design; this is **a navigation/UX correction**, not a destructive data merge. Searching can legitimately show both a Manager **conversation** and a **Job** result as different object types when both match. The fallback title for old generic conversations is presentation-only; manual renaming persists as normal. A saved Job deep link requires normal authentication and owner-scoped hydration. Browser/rendering and live database reconciliation are not established by source-only tests.
