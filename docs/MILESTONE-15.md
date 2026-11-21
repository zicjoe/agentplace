# Milestone 15 — Intelligence Reliability & Evidence-Grounded Synthesis (candidate, Stage 1)

## Why this milestone

M14 live production acceptance on 20 November 2026 confirmed that the conversation-first interface, the Meme Scout lead, Smart Money Scout specialist and persisted token-identity evidence worked for a read-only BONK investigation. Four issues remained: two DexScreener failures; redundant Nansen flow evidence with an unknown request window; a partial local accumulation signal; and a misleading statement that the identity resolver was not live despite a verified `token.identity.resolve` record.

This Stage 1 candidate is intentionally based on **v0.17.0**; it does not claim a completed versioned M15 release or production acceptance. The version/milestone release number should change only when M15's broader quality gate is accepted, without breaking the frozen M14 contract.

## Implemented

1. **Bounded DexScreener transient retries.** Retry 429/502/503/504 a maximum of once, up to a 1-second wait budget, and respect `Retry-After` instead of ignoring long provider cooldowns. Do not retry 401/403. Failures continue to persist as provider errors and can trigger an already configured fallback provider.
2. **Per-collection request sharing.** Market and liquidity calls for the same resolved token use the same DexScreener response, including a shared failure; Nansen flow-intelligence and token-smart-money capabilities share one *identical* metered request. A new cache is created for each Job collection, with no cross-Job stale market cache or cross-user sharing.
3. **Nansen observation window and provenance.** Supply explicit `timeframe: '1d'` for flow intelligence; preserve non-secret endpoint, chain, address, timeframe, timestamps and a request-and-response fingerprint in persisted evidence. A shared fingerprint in this Job is one API observation, *not independent corroboration*. Wallet addresses may be identifying data; expose request metadata only through existing owner-scoped Job evidence surfaces, not public logs.
4. **Conservative flow normalization.** Recognize only explicit *smart-money cohort* USD net-flow fields. Never select the numerically largest flow from whales, exchanges or other populations; never infer market-wide accumulation or intent. Unknown schema/units, conflicting values or absent request windows remain partial/unavailable. Derived positive or negative values describe **cohort net inflow/outflow**, not a trading recommendation.
5. **Grounded synthesis correction.** Evidence prompts and coverage correction receive persisted identity/capability statuses. If the model still says the identity resolver was not live in a Job containing verified identity evidence, append a clear, deterministic runtime-evidence correction; keep the original text visible for audit. This is a narrowly scoped safeguard, not a universal hallucination detector.
6. **Audit trace.** Persisted research model-run metadata now carries evidence IDs, status, asset, provider, observed/fetched time, public request parameters and request fingerprint. No new database schema or secrets are needed.

## Unchanged safety boundaries

- Read-only intelligence remains read-only. No new onchain signer, wallet authority, Mainnet execution or Mainnet autonomy is introduced.
- Financial approvals, billing, Job leases, collaborator eligibility, owner isolation, and Railway Scheduler remain unchanged.
- `MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false` are still required.

## Limitations / next acceptance gate

- No production Nansen credential or provider data is available inside this candidate build. The field extraction is intentionally conservative and might remain partial if Nansen's deployed schema uses different names; inspect the real, redacted persisted payload shape before adding a mapping.
- A provider's explicit long `Retry-After` is not waited out: the provider error is recorded; configured fallback can proceed.
- The one-Job cache is not a distributed cross-replica rate limiter; concurrent Jobs might still encounter 429s. Do not claim provider availability is fixed until observed in production.
- Request/response fingerprint correlates identical calls **inside a Job**, not exchange-independent research and not a verification of the provider values.
- The deterministic grounding correction covers one concrete false-runtime-status failure; a broader factual-claim validator remains future work.

## Stage 1 exit

Pass full `pnpm check` on the developer machine. Deploy only after that; no DB migration for this candidate. Perform one new read-only BONK investigation in the live app, inspect the structured evidence rows, confirm DexScreener retry/error behavior, same-key Nansen flow evidence, exact `timeframe`, truthful accumulation outcome, and the final conversation answer. Stage 1 is *not* accepted based on unit tests alone.

## Stage 2 follow-on candidate

See [MILESTONE-15-STAGE2.md](MILESTONE-15-STAGE2.md) and [MILESTONE-15-STAGE2-TESTING.md](MILESTONE-15-STAGE2-TESTING.md) for outbound request observability, provenance, cost-accounting limitations and new production acceptance steps. Stage 1 acceptance and its existing constraints remain recorded above.
