# Production Milestone 1 — User Test Checklist

This checklist validates the approved AgentPlace UX inside the production monorepo. Milestone 1 still uses isolated fixture data for product-state demonstrations; do not treat displayed balances, quotes, authority decisions or execution as live financial state.

## 1. Install and repository validation

From the repository root in Windows PowerShell:

```powershell
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm check
```

Expected result: `pnpm check` completes without errors and the final repository/Milestone 1 verification scripts print `PASS`.

## 2. Start AgentPlace

```powershell
pnpm dev
```

Expected local services:

- Web: `http://localhost:5173`
- API health: `http://127.0.0.1:8787/health`
- Public runtime config: `http://127.0.0.1:8787/api/v1/config`

The API config should report Milestone 1 and show Mainnet execution/autonomy disabled with the default `.env`.

## 3. Approved shell and Guest Home

Open `http://localhost:5173` in a fresh/private browser window.

Confirm:

- AgentPlace opens on the approved dark Guest Home rather than the old Milestone 0 stub.
- The primary prompt is `What do you want your crypto to do?`.
- Home is goal-first and does not force a wallet connection.
- Desktop navigation contains Home, Discover, Workers, Routines, Activity and Wallets, with Create separated and Security & Authority/Billing & Usage in the secondary area.
- Mainnet/Testnet remains visible as environment context.
- Hidden prototype Demo Controls are not visible with the default environment configuration.

## 4. Navigation and real browser routes

Open each route directly, then use normal navigation:

```text
http://localhost:5173/discover
http://localhost:5173/workers
http://localhost:5173/routines
http://localhost:5173/activity
http://localhost:5173/wallets
http://localhost:5173/security
http://localhost:5173/billing
http://localhost:5173/create/worker
```

Confirm:

- each URL opens the matching approved surface;
- browser Back/Forward follows AgentPlace navigation;
- refreshing a valid route keeps the user on that route;
- an unknown route such as `/does-not-exist` shows the AgentPlace not-found surface and `Go to Home` works.

When you open an object such as a Worker, Job, Routine, wallet or conversation through the UI, note the URL, refresh the page, and confirm AgentPlace returns to the same object when the fixture state contains it.

## 5. Fixture-state continuity

With `VITE_AGENT_PLACE_PERSIST_FIXTURES=true`:

- create/rename or otherwise change a prototype object through an approved flow;
- refresh the browser;
- confirm the Milestone 1 fixture state survives the refresh;
- confirm transient overlays such as Action Review, notification inbox and identity checkpoint do not get incorrectly restored as permanent state.

This local persistence is only a test adapter. Durable production conversations and records arrive in later milestones.

## 6. Representative approved experiences

Spot-check the preserved Figma experiences rather than trying to prove real financial execution:

- start a research/Manager conversation from Home;
- browse Discover and open a Worker/detail;
- open Workers and a Worker Workspace;
- open Activity and a Job Workspace when available from fixture flows;
- open Wallets and inspect Watch-only / Connected Wallet / Agent Account UX;
- inspect Routines;
- inspect Security & Authority;
- inspect Billing & Usage;
- open Create -> Worker and confirm Agent Builder retains the approved conversation + Live Worker Draft experience;
- where a fixture flow exposes Action Review, confirm economic effect, authority and risk remain visually primary.

Expected result: these surfaces should look and behave like the approved AgentPlace UX Baseline rather than newly redesigned replacements.

## 7. Responsive check

Use browser responsive/device mode around 390px width and confirm:

- the mobile top bar and bottom navigation appear;
- conversation history remains reachable through the drawer;
- Home, Discover, Workers, Activity and More remain usable;
- consequential overlays/surfaces do not become desktop cards simply stacked without adaptation;
- there is no horizontal layout break on the main approved surfaces.

Also resize back to desktop and confirm the persistent left rail returns cleanly.

## 8. API boundary check

Open the two API endpoints in the browser or PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:8787/api/v1/config
```

Expected result: health is `ok`; version is `0.2.0`; milestone is `1`; deployment environment is `development`; Mainnet execution and autonomy are `false` with the default `.env`.

## 9. Report back

If anything fails, provide:

- the exact command and terminal output;
- the URL/screen involved;
- a screenshot when visual;
- what you clicked immediately before the issue;
- whether it reproduces after refresh.

Do not advance to Production Milestone 2 until this milestone is accepted or the same Milestone 1 ZIP has been fixed and retested.
