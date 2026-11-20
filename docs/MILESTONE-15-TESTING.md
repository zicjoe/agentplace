# M15 Stage 1 — Production acceptance

## Preflight

- Verify `pnpm check` passes locally.
- Confirm API and Worker healthy, Scheduler unchanged, and database readiness.
- Start a new **read-only** AgentPlace Manager conversation; never reuse a previous report as a substitute for a fresh provider request.

## One bounded test request

> Research BONK on Solana. Verify the mint, investigate smart-money/whale flows, market activity, liquidity, concentration and risk using available Workers. Lead with a conclusion, date the provider observations and identify any unavailable evidence. Research only; do not execute transactions.

## Inspect persisted Job evidence

- `token.identity.resolve` verified, correct original BONK mint; no contradictory statement about the resolver being unavailable.
- `token.market.read` and `token.liquidity.analyze`: if DexScreener succeeds, both cite token-matched pools; if it fails, errors remain explicit with no invented market values. Compare Worker log error codes and retry timing to expected bounded behavior.
- Nansen flow and smart-money read: explicit `requestParameters.timeframe = '1d'`, same `snapshotFingerprint` when read for the same token in the same Job, and do not count repeated evidence as independent confirmation.
- Derived `smartmoney.accumulation.detect`: only a uniquely recognized smart-money USD cohort field can produce a verified *net-inflow/net-outflow* signal. Missing/ambiguous units or schema produce partial/unavailable evidence, not a false verdict.
- Final lead synthesis: answer first, key numbers tied to provider records (including timestamps and mint), honest limits, no fabricated outside market facts, no omitted participating/failed Worker.
- All tracked Worker execution steps persisted, financial actions absent.

## Outcome

Record pass/fail with screenshots, relevant source evidence IDs, timestamp, and sanitized error statuses. Redact secrets; avoid pasting whole provider payloads containing private API keys or other identifying data.
