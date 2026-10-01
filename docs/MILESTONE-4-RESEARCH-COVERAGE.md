# Milestone 4 — Research Coverage Contract

## Product rule

A research Job cannot be marked **Research complete** merely because a model returned non-empty prose. Every material requirement in the bounded Job goal must be explicitly addressed.

Addressed does not mean verified. If AgentPlace cannot establish a requested point from the currently available evidence/capabilities, the report must say so instead of omitting or inventing it.

## Runtime contract

1. Manager planning decomposes research requests into explicit `researchRequirements`.
2. The Worker sends the research provider the original user request, structured Job goal, optimized retrieval query, requirement IDs and capability-availability context.
3. The research answer must contain a `## Coverage` table with every requirement ID exactly once.
4. Allowed statuses are:
   - `Verified from available evidence`
   - `Partially verified`
   - `Not verified / capability unavailable`
5. If the provider omits the coverage contract, AgentPlace may make one bounded correction call. The correction has no web tool, receives only the already-produced answer and preserved source references, and is prohibited from adding new facts.
6. If the correction is unavailable or still incomplete, AgentPlace deterministically adds truthful `Not verified / capability unavailable` rows for the missing requirements.
7. Only then may the Job transition to `Research complete`.

## Security and truth boundaries

- External web content remains untrusted evidence, never authority.
- A planned canonical capability remains non-live; mentioning it in planning metadata cannot make it executable.
- No holder concentration, wallet clustering, smart-money classification, deployer conclusion, token-security score or other specialist metric may be invented because the requested capability is unavailable.
- The correction pass does not perform new research.
- Existing AI daily-cost and per-task call ceilings remain in force. The default three-call ceiling supports Manager planning + research + one correction when needed. If correction budget is unavailable, the deterministic fallback preserves truthfulness without additional provider spend.
- No database migration, wallet authority, signing or financial execution is introduced.

## Roadmap handoff

The truthful unavailable-capability behavior is permanent. It is not a substitute for the real capability layer. `docs/ROADMAP.md` schedules **Milestone 5B — Read-Only Crypto Intelligence Capability Expansion** after Router v1 so market/liquidity/holder/deployer/security/smart-money intelligence can become real provider-backed canonical capabilities rather than model inference.

## Production acceptance

Use the BONK/WIF/POPCAT prompt in `docs/MILESTONE-4-TESTING.md`. Pass only when every requested dimension appears in Coverage and unsupported dimensions are explicitly unverified/unavailable rather than omitted.

## Installation / deployment handoff

This correction has no database migration, dependency addition or new environment variable.

1. Extract the replacement ZIP to a staging folder.
2. Copy its contents into the existing AgentPlace Git checkout while preserving `.git` and any local `.env` files.
3. From the repository root run:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

4. Stop if `pnpm check` fails.
5. If it passes, review `git status`, then commit and push:

```powershell
git add CHANGELOG.md apps/worker/src/index.ts apps/worker/src/researchCoverage.ts docs/MILESTONE-4.md docs/MILESTONE-4-TESTING.md docs/MILESTONE-4-RESEARCH-COVERAGE.md docs/ROADMAP.md scripts/verify-milestone-4.mjs tests/m4-conversation-ui.test.mjs
git commit -m "fix(m4): enforce truthful research coverage before completion"
git push origin main
```

6. Allow the existing Railway Worker deployment to rebuild from the pushed revision. Vercel/API may also redeploy according to repository triggers; no configuration changes are required.

## Acceptance checklist

- Repeat the BONK/WIF/POPCAT truthfulness prompt from a fresh Manager conversation.
- Confirm the Job contains a `Coverage` table covering every requested dimension.
- Confirm unavailable holder/smart-money/deployer/security depth is explicitly marked rather than omitted or invented.
- Confirm supported public-source findings remain useful and source-grounded.
- Confirm the Job does not show `Research complete` until coverage validation has finished.
- Confirm `Open job`, Result, Worker cross-links, Activity and the single visible originating conversation still work.
- Confirm explicit model selection still persists after refresh/sign-out/sign-in.
- Continue the separate account-isolation and failure/recovery acceptance tests before freezing M4.

## Known limitations / deliberate deferral

- M4 does not make planned holder, deployer, security, smart-money or wallet-intelligence capabilities live.
- The coverage correction pass can only reorganize the already-produced answer and preserved source references; it does not perform new research.
- If the correction pass cannot run within cost/call/provider limits, AgentPlace conservatively marks missing requirements unverified rather than guessing.
- Claim-level source-to-sentence verification is not introduced in this correction.
- Real read-only specialist intelligence is explicitly scheduled for Milestone 5B after Router v1 and requires a separate provider/integration discussion gate.
