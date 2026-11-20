# AgentPlace — Conversation-First UX Phase 2 review candidate

**Base:** v0.17.0 · M14 Stage 3 · Phase 1 conversation-first UX ZIP already reported deployed by user.
**Date:** 20 November 2026. **Status:** Engineering candidate, **not production accepted**.

## Why

A real BONK-on-Solana response was now delivered in the Manager conversation, but opened with repeated headings and a 7-row engineering Coverage table. It ended on an unfinished phrase and showed preserved mint-scoped provider evidence collected for `BonkUg9t46HnxF4erZzmnB4Ae6oEcDS4V66zqUoUhwWY`, while the established Solana BONK original mint is `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`.

## Changes

1. **Answer first:** Lead research synthesis is now prompted to begin with `## Bottom line` and concise evidence-qualified findings. The R1/R2/etc. Coverage table remains required but comes *after* the actual answer; the deterministic coverage fallback is appended rather than prepended.
2. **Cleaner conversation:** A saved `## Bottom line`, conclusion or assessment is displayed verbatim at the top of the conversation. Long remaining analysis is under an accessible **Read full analysis** disclosure; Coverage and Sources have their own disclosures. If no explicit summary exists, the actual full analysis stays inline rather than fabricating a new one. Job Workspace and source provenance remain available.
3. **Historical results preserved:** This display is a reversible, client-only projection. It does not reissue a model call, rewrite saved research, alter historical data, or grant authority. Old incorrect findings remain historical and should be retested with a **new** Job.
4. **Known token protection:** For `BONK` on Solana, the original mint is explicitly bound in the structured provider layer using a documented Phantom token reference. If the planner/supplied named-token address conflicts, token-specific provider requests are blocked with an explanatory unavailable evidence record; the wrong address is not silently substituted. Ambiguous ticker/name searches are not resolved by choosing the highest-liquidity imitation. Other assets still require explicit addresses or genuinely unambiguous searches.
5. **Provider consistency:** Structured providers share the resolved identity. DEX Screener pools must contain the selected mint; GoPlus no longer falls back to an arbitrary first returned token; CoinGecko must match its platform contract metadata to the resolved token before returning a price. Additional CoinGecko metadata lookup may use an extra API request.
6. **Evidence integrity:** A token identity reference is recorded for provenance but does **not** count as a verified smart-money/market metric. Supporting and lead research prompts forbid substituting data from similarly named mints.
7. **Output completeness:** Web-research responses explicitly marked `incomplete` / `max_tokens` by supported providers raise a recoverable provider error rather than being presented as completed. The chat also provides a cautious warning if saved prose appears to end mid-sentence (heuristic, not a definitive truncation diagnosis). Concise answer-first guidance helps avoid oversized generations.

## Unchanged

- AgentPlace remains multichain; no BONK-only product routing or broad coin identity claims.
- No financial action, new wallet authority, signer access, Mainnet autonomy, schema/migration, billing ledger, scheduler or new dependency.
- User approval is still required where existing deterministic authority demands it.
- Manager/Worker/Job, collaboration, evidence, Job receipts and original immutable messages remain separate and inspectable.
- No decorative Monitor/Compare controls were added. Such actions need real, tested Routine/Job flows before surfacing as buttons.

## Local verification

- `node scripts/format-check.mjs` — PASS.
- `node scripts/lint.mjs` — PASS.
- `node scripts/verify-milestone-14.mjs` — PASS.
- Focused Phase 1 + Phase 2 UX/research regression tests — 18/18 PASS.
- M14 Stage 3 team-selection and evidence-truth regression — 10/10 PASS after updating the assertion to exclude identity-only records from usable provider evidence.
- Raw broad `node --test tests/*.test.mjs` — 227 PASS, 1 SKIPPED, 4 blocked by missing compiled `dist` packages (router, telegraph, authority, shared), not verified code failures. Full `pnpm check` is still required.
- **Full `pnpm check` has not been run here** because the packaged source requires the user's normal pnpm dependency install and build. It is the deployment gate.

## Acceptance after `pnpm check` and usual deployment

1. Open a **new** read-only Manager request: `Research BONK on Solana. Is established BONK seeing smart-money accumulation? Use verified mint and flag missing evidence. No transactions.` The first displayed answer should be a bottom line and key source-supported findings, not an R1–R7 table.
2. Inspect **View work and evidence** and **Verification coverage**. All requested dimensions remain covered and source links survive. Team attribution is truthful, with skipped Workers not credited.
3. Confirm **all mint-scoped structured provider observations** show the original Solana mint (`DezXAZ…pPB263`), not `BonkUg…`. If the planner supplies a mismatching mint, the provider call should be blocked and the mismatch explained; evidence must not be silently rewritten.
4. Revisit the **previously saved** BONK Job. Its recorded facts remain unchanged, while the Manager view may lead with its existing conclusion and make the full detail accessible.
5. Confirm a new report ends properly, and no incomplete provider output is shown as a completed report; inspect failure/recovery if provider token budget is reached.
6. Repeat one-Worker and multi-Worker research, conversation continuity, long prompts, mobile Job/Manager view, and one financial Action Review without signing; ensure no regression.
7. Check budget/usage attribution and provider availability. A metadata identity check must not be counted as observed wallet accumulation.

## Known limitations

- This improves deterministic *structured* asset resolution, not the correctness of every statement an external web-search model may produce; source grounding and user acceptance testing remain required.
- Generic names/symbols with multiple mint identities may now return unavailable until the user supplies an exact mint. This is intentional safety friction rather than picking a possibly wrong token.
- User-visible mid-sentence detection is heuristic. Where provider finish metadata is missing, some clipped prose may not be detectable with certainty.
- `AGENT_PLACE_ENV` production setting, controlled provider-outage staging tests and Railway Scheduler cost optimization remain separate, deferred operating issues.

## Rollback

Revert this Phase 2 commit to previously deployed Phase 1. No migrations or schema changes are involved.

## TypeScript typecheck repair (20 November 2026)

The initial candidate failed `pnpm check` on `packages/intelligence/src/index.ts` because repeated `string(...)` calls inside conditional object spreads inferred optional values as `string | undefined` under `exactOptionalPropertyTypes`. This correction stores the parsed symbol/name/source URL in narrowed local constants and only spreads properties when defined/nonempty. No token-selection, provider, wallet, or financial-authority logic was altered.

**User verification still required:** rerun the full `pnpm check` on the replacement ZIP before deployment. Do not treat formatting/lint or a focused type demonstration as proof that the full repository check passed.
