# AgentPlace Launch Readiness Contract

AgentPlace is launch-ready only when product truth, financial truth, security truth and operational truth agree.

## Product truth

- Goal-first UX remains chain-neutral.
- Guest/read-only value works without forcing a wallet.
- Workers are persistent; Jobs are bounded.
- Discover purchase is separate from authority.
- Historical objects remain inspectable after cancellation, quarantine, failure or emergency stop.

## Financial truth

- AgentPlace service balance is separate from wallet/Agent Account capital.
- External service spend, AgentPlace service cost and onchain fees remain distinguishable.
- Service Cost Review cannot authorize capital movement.
- Job Workspace/Billing/Verified Receipt use the same cost evidence where available.

## Security truth

- No raw user signing secret enters LLM/browser-server application context.
- State-changing actions require deterministic authority and exact current review.
- Unknown/submitted blockchain attempts are never treated as safely reversible.
- Emergency stop invalidates safely cancellable future execution only.
- Quarantine removes supply from new routing/acquisition without deleting evidence/history.

## Operational truth

- API liveness and readiness are different signals.
- Background Worker/Scheduler health is observable through durable heartbeats.
- Logs are structured, correlated and secret-redacted.
- CI reproduces the local `pnpm check` release contract.
- A deployment can be validated without hidden database repair.

## Mainnet readiness

M14 does not enable Mainnet execution or autonomy. A later controlled review must approve each write path independently, including provider trust, simulations, deterministic limits, signer boundary, incident response and recovery behavior.
