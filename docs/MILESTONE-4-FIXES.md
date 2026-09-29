# AgentPlace v0.5.0 — Milestone 4 production correction handoff

**Scope:** M4 defect remediation only. Milestones 1–3 remain frozen. Milestone 4 remains **not frozen** until the owner completes live acceptance.

## Repository-grounded root causes and correction

1. The Worker already writes an owner-scoped PostgreSQL Job, its Job conversation, origin-conversation `message.jobId`, stages and Activity events. The Manager's message renderer discarded the `jobId` as display information. The new `JobReference` projects the *existing* hydrated Job (never creates a second one) into the message with current status, goal, lead/team, stage and `Open job`. It also appears in reopened history; clicking uses the current deep-linked Job route `/activity/jobs/:id`.
2. Conversation components used `scrollIntoView` on the last message. That API can scroll ancestor containers including the document. Combined with 100%-height root sizing and unconstrained flex children, it can shift the shell and clip page headers. The shell now uses a visible-viewport height (`100dvh` with fallback), forbids document scrolling, supplies `min-h-0/min-w-0`, scopes chat autoscroll to the owning panel, remounts route content on navigation, and allows dense Job headers to scroll at small viewport/zoom sizes. Mobile safe-area spacing is retained.
3. A handwritten text renderer understood only `##` and `**`, so models' pipe tables and source URLs appeared as raw text. The new restricted Markdown parser/render layer supports headings, paragraphs, unordered/ordered lists, blockquotes, code, inline emphasis, links, and GFM-style pipe tables with horizontal scrolling on small screens. Output is plain React text/elements, with HTTP(S)-only URLs and `noopener noreferrer`; no model HTML is executed. The same safe renderer replaces unsafe HTML-string formatting in the two prototype creator chat panels.
4. The Job Result tab now shows the original saved research answer from the Job conversation and owner-scoped preserved source URLs, not a fixture result. The Job Workspace includes source-conversation and Activity links and a Job-scoped Activity tab. Research completion is not called `AgentPlace Verified` in Activity. Production Activity no longer substitutes illustrative financial amounts for recorded event summaries. Late work-state poll responses are discarded after an account switch.

**Data impact:** no new PostgreSQL migrations. Keep existing applied migrations 0004/0005. No new environment variables, providers, paid services, npm dependencies, wallet permissions, auth changes, or AI secrets. M4 stays read-only.

## Developer validation (on your PC)

Use the latest **complete replacement ZIP**. The ZIP does not contain `.git` or production environment files. Extract it to a staging folder, then copy its contents into your **existing Git checkout** (preserving the checkout's `.git` folder, any local `.env`, and `node_modules`). Do not overwrite real Railway/Vercel variables.

For example, in PowerShell (replace the existing checkout path with the actual location on your laptop):

```powershell
$zip = Join-Path $HOME 'Downloads\AgentPlace-v0.5.0-M4-sidebar-viewport-fix.zip'
$staging = Join-Path $HOME 'Downloads\AgentPlace-M4-sidebar-staged'
$repo = 'C:\dev\AgentPlace'  # Change this to your EXISTING Git checkout folder
Expand-Archive -LiteralPath $zip -DestinationPath $staging -Force
robocopy $staging $repo /E /XD .git node_modules /XF .env .env.local
Set-Location $repo
```

`robocopy` may return code 1 after successfully copying files; that is not a failure. Because this correction does not remove any original source files, the copy operation need not delete anything in your checkout. Confirm `git status` lists the intended changed/additional files before continuing.

Then run PowerShell **from the project root**:

```powershell
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

Requires Node 22.12+ and pnpm 10.15.1 (as declared in `package.json`). Run the normal repository check *before* pushing or deploying. If `pnpm check` fails, stop and share the **first** error; do not deploy. The isolated preparation environment did not have pnpm or installed dependencies, so this complete typecheck/build step must be run on your PC before any production deployment.

For the targeted M4 UI regression test:

```powershell
node --test tests/m4-conversation-ui.test.mjs
```

`node --test` uses an experimental built-in TypeScript stripping feature for the parser test under Node 22; it does not add dependencies.

## Production deployment (only after local check passes)

1. Commit and push the complete tested replacement to GitHub `main` (commands below). Verify GitHub Actions is green. Do not put `.env`, keys or tokens into Git.
2. Railway API: let the existing GitHub deployment use build `pnpm build:api`, start `pnpm --filter @agent-place/api start`, pre-deploy `pnpm migrate` if already configured. The migration command is idempotent; this patch adds **no migration**.
3. Railway Worker: let the existing service use build `pnpm build:worker`, start `pnpm --filter @agent-place/worker start`. Keep current working provider selection and server-side credentials unchanged.
4. Vercel: deploy the updated `apps/web` from the same GitHub `main` revision; keep the existing `/api` routing and canonical domain settings. No provider keys are required in Vercel. If auto-deployment is configured, observe it rather than creating another project.
5. Visit `https://www.agentplace.tech`, sign in and run the acceptance steps below. If API/Worker is unhealthy, inspect their Railway logs without exposing secrets; don't change settings speculatively.

Recommended commit message:

```text
fix(m4): keep conversation history visible at normal browser zoom
```

Commands (after `pnpm check` passes):

```powershell
git status
git add -A
git commit -m "fix(m4): keep conversation history visible at normal browser zoom"
git push origin main
```

## Owner acceptance — do in order

- [ ] At normal browser zoom, open Home, Discover, Workers, Activity and a conversation; all headings/start positions visible. Repeat after navigating back/forward, opening an existing long conversation, and after refresh.
- [ ] Test desktop widths around 1440/1024px and mobile around 390px; at 100% and 125% zoom (also 150% if usable). Check top and bottom navigation, content scroll, Job header and wide research tables.
- [ ] Start a fresh signed-in Home conversation: `Research Aave on Arbitrum and compare the main risks, using current sources.` Confirm Manager creates real read-only Job and renders an **Open job** card.
- [ ] Open card while Working. Confirm goal, lead/supporting Workers, stages and live status; open Job Conversation and Activity tab. Open Origin conversation, return to Job via the card; confirm route address includes the same Job ID.
- [ ] After completion, compare Manager answer and Job Result. Source links must be clickable HTTP(S), independently inspectable; table headers/rows must render cleanly. Research must say Research complete, not AgentPlace Verified.
- [ ] Refresh and sign out/in; the same Job, answer, card, source evidence, Job conversation, and Activity persist, with no duplicate Job.
- [ ] Close the browser while a second Job works, reopen later; verify it resumes from PostgreSQL, not from a browser-only timer. If a provider fails, status must report failure/retry rather than fabricate results.
- [ ] Ask the follow-up in Job/Worker conversation; original research output remains preserved in Result even after follow-ups.
- [ ] With another test account, confirm Account B cannot see Account A's Job/card/evidence through the UI or owner-scoped API. This includes signing out while a work refresh is in flight.
- [ ] Repeat existing M4 provider/model selector persistence, source freshness, unavailability honesty, and bounded retry/cost behavior described in `docs/MILESTONE-4-TESTING.md`.

## Known limitations / deliberate deferrals

- Local live PostgreSQL, Railway, model-provider and browser-viewport acceptance cannot be verified merely from a repository ZIP. The owner must perform the above acceptance against their own deployment.
- The restricted Markdown grammar does not implement the entire CommonMark/GFM standard (e.g., nested lists, images, raw HTML, complex tables, LaTeX). Unsupported syntax stays text rather than being interpreted as executable HTML.
- An unhydrated Job reference indicates it is syncing; it does not forge a Job or bypass authorization. Check Activity/Worker service if it persists.
- Existing source URLs are provider evidence, not independent validation of every research claim. Research alone does not grant financial authority or an onchain Verified receipt.
- Any remaining approval/security/financial execution milestones remain deferred as defined in the Operating Guide. Do not freeze M4 until all live acceptance cases pass.

## M4 sidebar follow-up — normal-zoom conversation-history visibility

The initial shell fix corrected page-header scroll displacement but did not reserve vertical
space for the desktop/sidebar conversation list. The Sidebar's `flex-1 min-h-0`
history was permitted to collapse to zero after the fixed navigation, controls and
account footer consumed the viewport at ordinary browser zoom. A smaller zoom made
history visible only by increasing the available CSS viewport height.

The correction retains the approved visual/navigation order, reserves a 7.5rem
minimum history region with its own scrolling, allows primary/secondary navigation
to scroll rather than consume that reserve, and keeps the account footer reachable.
When the viewport height is at most 470px, the entire sidebar scrolls as a fallback.
Mobile's overlay no longer adds an unnecessary outer scrollbar. No conversations,
links, stored objects or server behavior are modified.

Acceptance on the **deployed frontend**:

- [ ] At Chrome 100%, the existing conversation titles are visible underneath Search history without changing zoom.
- [ ] Scroll in history: pinned/recent/archived conversations remain accessible and reopen correctly.
- [ ] At the same zoom, Home through Create are reachable by scrolling the navigation section where necessary; secondary Security/Billing/Settings also remain reachable.
- [ ] User/account controls remain visible at the bottom at normal desktop height.
- [ ] Repeat at 125% and 150% zoom, at a 1024px-wide window, and in a short-height window. Very short windows should scroll the sidebar as one region.
- [ ] Open and close the mobile conversation drawer; history and navigation remain accessible without dual overlay scrolling.

This is a frontend-only fix layered on the prior complete M4 correction. It adds no
database migration, environment variable, provider configuration or dependency.
Wait for the previous queued Railway deployment to finish before pushing a new
GitHub revision, so the deployments do not race. The Vercel frontend must be on
the new commit before accepting this visual change. M4 remains unfrozen.
