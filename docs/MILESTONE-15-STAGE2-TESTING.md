# M15 Stage 2 — Production acceptance checklist

## Preflight

- [ ] `pnpm check` PASS on the developer's machine. Stage 2 is not a release yet.
- [ ] Railway API and Worker deployed successfully; Railway Scheduler stays as-is.
- [ ] No DB migration required. Mainnet execution/autonomy flags still disabled.
- [ ] Use one *new* read-only Job, so Stage 2 telemetry is present. Old M15 Jobs will not be retroactively instrumented.

## Single production research prompt

> Research BONK on Solana. Verify its token mint, review smart-money and whale flows, pool liquidity, recent trading and holder concentration. Use appropriate Workers autonomously; provide a clear conclusion and dated provider evidence. Clearly separate verified observations, incomplete evidence and provider errors. Research only—no financial execution.

## Evidence inspector (open View work and evidence)

- [ ] `token.identity.resolve`: correct Solana BONK mint; no false claim that persisted identity evidence was absent.
- [ ] Job request activity panel appears, includes **outbound attempts / shared reads / scheduled retries / failed attempts** and explicit cost-measurement caveat.
- [ ] `token.market.read` and `token.liquidity.analyze`: on one successful shared DexScreener request, one row counts the attempt(s), the other records **shared read** and no additional attempt.
- [ ] `token.smartmoney.read` and `smartmoney.flow.read`: on the shared Nansen 1-day request, one row records outbound attempt(s), the other records a shared read; the normalized accumulation detector does not spend an extra Nansen call.
- [ ] Nansen `requestParameters.timeframe` is `1d`, and reported outcomes do not treat a shared fingerprint as two independent observations.
- [ ] Alchemy holder evidence includes the correct mint, snapshot slot, ranked account basis, and limitations; raw accounts are not equated to distinct owners.
- [ ] GoPlus no-security-fields response remains **Partial** rather than falsely **Verified safe**.
- [ ] No wallets executed or financial authority expanded, and lead + supporting Worker execution status is recorded.

## If something fails

Share the **capability status, per-row telemetry counts, Job-level totals, sanitized error category and trace ID**. Do **not** share Railway secrets, full private payloads, API keys, auth headers or bearer tokens. Full request URLs are intentionally absent from the telemetry.

## Decision

- **PASS** if actual telemetry is consistent with source-sharing, research remains evidence-grounded, and the existing Worker collaboration and safety controls remain intact.
- **PARTIAL** for provider outages while failure handling and accounting remain correct; never treat provider availability as permanently solved.
- **FAIL** for repeated paid calls when identical within-Job responses should be reused, misleading telemetry, changed financial authority, or fabricated provider findings.
