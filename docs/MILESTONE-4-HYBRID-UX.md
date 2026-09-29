# AgentPlace v0.5.0 — M4 Hybrid Research UX refinement

**Status:** Implementation delivered for local/deployed acceptance; M4 is **not frozen**. This is a focused refinement of the approved UX baseline, not a new product surface or a new research backend.

## What changed and why

The real Worker already saves the complete research answer in its Job conversation, mirrors it to the origin Manager conversation, and saves evidence URLs behind the owner-scoped Job API. Previously each surface rendered the complete answer as a long chat message; the Result tab repeated it again, stages had 10px labels, and the Job conversation auto-scrolled to the bottom when opened.

The hybrid presentation now uses those **existing saved messages and evidence**:

- **Manager conversation:** completed `msg_origin_result_*` shows an at-a-glance excerpt taken from the actual saved answer, available section names, **Read inline**, and **Open full report**. This latter action opens the *existing Job* directly in its Result tab. The original Job-created reference remains visible; it is not duplicated under the completed report. Historical message content is not rewritten.
- **Job conversation:** completed `msg_job_result_*` displays the same compact/expandable report, alongside normal follow-up messages, with a direct action for the full Result tab.
- **Job Result:** shows the complete saved report, the saved Job's update time, clickable section navigation, and structured source titles/provider/retrieval timestamps from the existing `GET /api/v1/jobs/:id/evidence` endpoint. The appended Markdown source list is hidden *only when* structured evidence exists and matches the expected terminal list format; otherwise original source links remain visible. Research is never labeled AgentPlace Verified.
- **Header/stages:** larger title and goal text, readable horizontal stage progress with independent scrolling at narrow widths, plus expandable original full stage labels. No replacement statuses or mock progress.
- **Scroll:** entering a Job conversation starts at the beginning rather than the old report's last source. Subsequent chat updates scroll only when the user was already near the end; the full report has its own scroll area.
- **Malformed emphasis:** a lone unmatched `**` is removed in *display only*. Stored research text stays unchanged; safe HTTP(S)-only links, React text nodes, and no model HTML execution remain in force.

There are **no new migrations, routes, providers, paid APIs, npm packages, authentication changes, server credentials, capability implementations or financial permissions**. Milestones 1–3 are unchanged. This does **not** claim to add new specialist research or independently verify every cited assertion. M5 Router, future specialist capabilities and M14 launch polishing remain separate.

## Installation — follow in order on Windows

You already have the current production Git checkout at `C:\dev\agentplace`. **Preserve its `.git`, any local `.env` files and existing `node_modules`.** Do not paste API keys into chat, PowerShell history or repository files.

1. Download the complete `AgentPlace-v0.5.0-M4-hybrid-research-ux.zip` attachment and extract it to a *separate* folder. Example: `C:\dev\AgentPlace-M4-hybrid-staged`. Make sure this folder itself contains `apps`, `packages`, `docs`, `tests`, and `package.json`.
2. In PowerShell, use these commands after checking that the two folder paths match your laptop:

```powershell
$staging = 'C:\dev\AgentPlace-M4-hybrid-staged'
$repo = 'C:\dev\agentplace'
robocopy $staging $repo /E /XD .git node_modules dist /XF .env .env.local
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy exit code $LASTEXITCODE)" }
Set-Location $repo
git status
```

`robocopy` exit codes 0–7 indicate non-fatal copy outcomes. **Do not use `/MIR`**: it could delete your existing checkout files. Verify that the changes are focused on the hybrid UI/docs/tests, without unexpected deletions, before proceeding.

3. Run the full local gate:

```powershell
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

Use Node 22.12+ and the repository's `pnpm@10.15.1`. If any command fails, stop and share the first error; do not push. The preparation environment did not have the pnpm distribution or installed web dependencies, so full typecheck/Vite build must be verified on your PC.

4. Only after `pnpm check` passes:

```powershell
git add -A
git commit -m "feat(m4): present durable research as hybrid conversation and job report"
git push origin main
```

5. Wait for the GitHub Actions checks and Vercel deployment. The API and Railway Worker may also redeploy because of monorepo GitHub triggers. Keep their **existing** settings and API keys. This change requires **no new database migration**; migrations 0004 and 0005 remain applied. Avoid restarting queued services unnecessarily. Visit `https://www.agentplace.tech` and hard-refresh with `Ctrl + Shift + R` at browser zoom **100%**.

## Focused live UI acceptance

- [ ] Start/open the existing Aave research conversation. The original saved Job card remains; the completed research is summarized rather than showing an unbounded wall of text.
- [ ] Click **Read inline**, inspect the full original text, tables and links; click **Collapse report**. No Job or AI task is created by viewing/expanding.
- [ ] Click **Open full report**: it navigates directly to the **same Job ID's Result tab**. It displays an excerpt, the complete research, section navigation and actual evidence source titles.
- [ ] Click a report-section button; it scrolls only the report panel. Click Sources & evidence; source links open in a new tab with HTTP(S) URLs and readable titles.
- [ ] Open the Job **Conversation** tab: the compact completed result is there, plus follow-up messages and **Open full report**. Open a long Job from Activity: its conversation starts at the beginning, not the last source.
- [ ] Header and stages remain legible on desktop at 100%, 125% and 150% zoom and on a narrow/mobile viewport. Expand **View all stage details** to inspect the original persisted stage names.
- [ ] Check old research with malformed `**DAI` emphasis: displayed text no longer contains the stranded marker; copied/stored original text has not been rewritten.
- [ ] Refresh, sign out/in, reopen via Manager/Activity/Worker. Same Job/result/evidence, no duplicate output or new Job from navigation.
- [ ] With a second test account, direct Job/result/evidence access remains denied; changing accounts never displays previous user's evidence.
- [ ] Model selection, first-message creation, source freshness, provider failure/retries, browser-close durability and read-only capability honesty continue to pass the existing `docs/MILESTONE-4-TESTING.md` and `docs/MILESTONE-4-FIXES.md` checks before freeze.

## Known limitations and boundaries

- The summary is an excerpt of a saved paragraph, **not a separate AI-authored executive summary**. It may be terse or imperfect if the model wrote poorly structured Markdown; the full answer is always available.
- Section links require ordinary Markdown headings in the saved answer. Structured evidence depends on provider-returned saved URLs. A missing structured evidence response leaves the original appended source links visible.
- Research is snapshot-based; source existence alone does not establish real-time market truth, independent claim verification or financial execution permission.
- The restricted Markdown renderer is deliberately not full GFM/CommonMark; complex nesting/HTML/LaTeX remain plain text. Normal `|` tables and HTTP(S) source links remain supported.
- Full browser/production visual verification, authenticated account isolation, PostgreSQL durability, provider behavior and complete `pnpm check` cannot be established from a ZIP alone. **Do not freeze M4** until the real-user acceptance checklist passes.
