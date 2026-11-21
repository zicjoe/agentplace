# Milestone 15 — Stage 2: Provider Call Observability & Evidence Provenance

**Status: engineering review candidate; production acceptance pending.** Built on accepted M15 Stage 1 / v0.17.0. This stage does not change the release version or claim a completed M15 release.

## Production motivation

The 21 November 2026 read-only BONK production investigation completed all three persisted collaboration steps (Meme Scout lead synthesis, structured provider evidence, Smart Money Scout specialist). Six of nine intelligence records were verified, three partial, zero provider errors. The market and liquidity evidence cards repeated the same DexScreener snapshot and the smart-money cards referred to the same Nansen response. However, **a repeated snapshot is not proof of the number of outbound provider requests**. Stage 2 makes actual request attempts visible in the existing owner-scoped Job evidence inspector.

## Implemented

1. **Real outbound request attempt accounting:** An isolated asynchronous ledger records calls made by the intelligence `fetchJson` adapter, including provider family, fixed operation category, outcome, numeric HTTP status (when available), and elapsed milliseconds. Each attempt is recorded in `finally`, including 429s, 5xx responses, parse failures and timeouts. Retries are separate outbound attempts.
2. **Retry and cache transparency:** Bounded DexScreener retry logic now signals the ledger when a retry is scheduled, including wait duration. Reusing a DexScreener or Nansen response via Stage 1's per-collection single-flight cache increments a reuse counter **without** counting an additional outbound call.
3. **Persisted, owner-scoped audit trail:** A `requestTelemetry` object is attached to the same owner-scoped `intelligence_evidence.data` JSONB record already used by each provider capability. There is no new database table or migration. A fresh ledger is created per collection; no global counters or cross-owner caches are introduced. The token-identity evidence card also records any resolver HTTP attempts.
4. **Private, safe metadata:** Request telemetry has a fixed provider/operation vocabulary. **Never** persist full URLs, request bodies, raw headers, secret-bearing error messages, API keys or arbitrary provider response text as request telemetry. Provider failures are classified into rate-limit/access/upstream/timeout/parse/network categories instead of copying raw exception strings into the new failure record. The underlying provider evidence continues to be owner-scoped.
5. **Evidence inspector:** The expandable **Structured crypto intelligence** section shows an overall Job request-activity summary and a per-capability row: actual outbound attempts, cached shared reads, scheduled retries and failed attempts. No telemetry is shown for older records that predate the instrumented schema. The UI explicitly says attempts are not billable charges or verified savings.
6. **Better provenance:** Alchemy holder concentration records now explicitly preserve the Solana holder RPC method, mint, slot, ranking and limit. DexScreener and Nansen fingerprints now hash their actual response representation and request identity, rather than just an inferred call identity. Shared fingerprints indicate common observations, **not independent corroboration**.

## Important limitations

- The ledger covers HTTP requests through the first-party intelligence `fetchJson` adapter; it does not claim to measure every external API/SDK request made elsewhere in AgentPlace. In particular, external Telegraph SDK calls are **not** assigned misleading zero-call telemetry.
- A successful *single run* does not establish long-term provider uptime or cost savings. Actual charges depend on provider billing models, quotas, cached results and contract terms. This stage records attempts and durations, **not monetary cost**. No provider billing credentials or invoices were accessed.
- Retries scheduled are not necessarily equivalent to a successful second request. A provider's long `Retry-After` still aborts Stage 1's bounded retry and preserves an error.
- Smart-money accumulation remains conservative. A flow record without an explicit supported Smart Money cohort USD net-flow metric is **inconclusive**, not automatically negative. Exchange/whale/fresh-wallet segments are not substituted. No unverified Nansen schema mappings were introduced.
- GoPlus snapshots with empty security fields remain partial rather than a security clearance. Broader provider coverage and provider-specific billing APIs are follow-up work, not asserted as implemented in this stage.
- Research Job evidence may contain sensitive owner-scoped observations; never expose this inspector or underlying JSONB through public endpoints or unredacted logs. No user addresses, provider API keys or raw provider payloads should be copied to public logs for testing.

## Unchanged boundaries

- Read-only intelligence does not grant token signing, wallet execution, job redelegation, or additional financial authority.
- Mainnet execution and autonomy are still disabled (`MAINNET_EXECUTION_ENABLED=false`, `MAINNET_AUTONOMY_ENABLED=false`).
- Existing scheduler, approvals, payments, Worker leases, provider routing/fallback and conversation-first UX remain unchanged.

## Acceptance gate

1. Run `pnpm check` on the developer's complete dependency-installed repository. No deployment if it fails.
2. Deploy existing services without changing the Scheduler or migrations.
3. Run **one** read-only BONK investigation. Verify mint identity, completed Worker collaboration, and no financial execution.
4. Open the persisted Job's Structured crypto intelligence and record the Job summary and DexScreener/Nansen rows. On a successful shared call, the first capability should show outbound attempts and a later one should show **zero outbound attempts with one shared read**. The exact first/second order depends on capability routing. Do not count telemetry as independent provider verification.
5. If a provider fails, verify an explicit provider error and sanitized status instead of fabricated market values. The overall report should stay grounded in the actual evidence.
6. Compare the numbers from the Job inspector to redacted deployment trace logs only if needed; do not run multiple paid research Jobs solely to prove counting.

**Rollback:** Revert the Stage 2 commit and redeploy. No schema rollback is necessary; earlier code ignores the extra JSONB fields. Existing prior evidence is not rewritten.
