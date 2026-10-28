# M14 Production Acceptance Testing

Run all acceptance tests against the deployed production candidate after `pnpm check` and migration `0023` pass.

## Gate 1 — Deployment/readiness

1. `GET /health` returns HTTP 200 and `status: ok` without depending on PostgreSQL.
2. `GET /ready` returns dependency truth: database, auth, Worker heartbeat, Scheduler heartbeat and execution gates.
3. With API + DB + Worker + Scheduler healthy, readiness is `ready`.
4. Stop a non-critical background runtime in a controlled test: API remains reachable while readiness becomes `degraded` and identifies stale/unknown runtime state.
5. Restore runtime and verify readiness returns to `ready` without database edits.

## Gate 2 — Trace/log safety

1. Make an API request and confirm `x-agent-place-request-id` and `x-agent-place-trace-id` are returned.
2. Railway API logs contain method/path/status/duration and the same request/trace IDs.
3. Worker task logs include task/job correlation.
4. Scheduler pass logs include bounded operational counters.
5. Confirm logs do not contain session cookies, Authorization headers, private keys, seed phrases or raw signatures.

## Gate 3 — Service Cost Review

1. Set Billing `Single-Job service-cost confirmation threshold` below a real controlled Telegraph testnet x402 charge.
2. Run an eligible Job that routes to paid Telegraph service supply.
3. No x402 payment authorization may be sent before review.
4. Job Workspace shows **Service Cost Review**, amount/provider/threshold and the explicit statement that this is not crypto transaction authority.
5. Reject: retry remains blocked for that reviewed cost and no service payment occurs.
6. On a new controlled Job/review, approve: approval persists; retry may use the reviewed paid service path.
7. Financial Action Review/mandates/wallet authority must remain unchanged.

## Gate 4 — Responsive/accessibility

Test Home/Manager, conversation history, Discover, Worker, Job, Action Review, Activity, Wallets, Routines, Security, Billing and Create at desktop and mobile widths.

- No unreachable primary action or clipped critical financial text.
- Tables/code/research evidence remain horizontally reachable on mobile.
- Keyboard can reach navigation, dialogs and primary actions with visible focus.
- Skip-to-content works.
- Touch targets are usable on coarse-pointer/mobile devices.
- Reduced-motion preference does not leave essential state hidden.

## Gate 5 — Cross-surface reconciliation

Re-run representative frozen flows:

- Guest/read-only research.
- Watch-only wallet research with no signing path.
- Connected Wallet Action preparation and exact Action Review.
- Wallet interruption/reconnect returns to the originating task; stale quote requires fresh review.
- Job -> Make recurring -> prefilled Routine -> activate -> background run -> notification/activity.
- Testnet service balance -> paid Discover acquisition -> entitlement -> Worker Job -> Billing -> Creator Earnings.
- Emergency stop of a fresh unsubmitted Action.
- Creator supply quarantine -> route/acquisition blocked -> history preserved -> release.

## Gate 6 — Failure/degraded truth

Exercise at least: provider timeout/unavailable, stale quote, no optional intelligence provider, delayed proof anchor, and background runtime restart. AgentPlace must expose partial/degraded state truth and must not invent success.

## Gate 7 — Repository/security

- GitHub CI passes `pnpm check`.
- Secret guard passes.
- CodeQL workflow is enabled.
- Dependency Review blocks new High-or-higher dependency changes unless deliberately resolved/risk-accepted.
- Dependabot is enabled.

Mainnet execution/autonomy remain disabled throughout M14 acceptance unless a separate controlled readiness decision is approved.
