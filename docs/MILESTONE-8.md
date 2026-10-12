# M8 — Action Preparation + Action Review

AgentPlace v0.11.0 makes the missing middle between intent/authority and future execution durable.

## What is real
- Durable `financial_action` for transfer, swap and bridge.
- Immutable prepared-action revisions with SHA-256 action digests.
- Canonical provider-neutral capabilities (`asset.transfer.execute`, `swap.execute`, `bridge.execute`).
- LI.FI quote adapter for eligible EVM swap/bridge requests. LI.FI is optional; lack of a live route is represented truthfully and never replaced by a fabricated quote.
- RPC preflight via `eth_estimateGas` only when an unsigned provider payload and configured chain RPC are both available.
- Structured risk assessment separate from M7 deterministic authority.
- Every prepared action is evaluated against the M7 Authority Engine.
- Exact-action approvals bind to action ID + immutable revision + action digest and become invalid when preparation changes.
- Separate Service Cost Review persistence for external API/data spend. It never grants wallet authority.
- Production bridge flow opens the durable Action Review when API mode is active.

## Hard boundary
M8 does **not** sign, broadcast, submit, settle or verify blockchain transactions. `READY_FOR_EXECUTION` means only that the exact preparation has passed the current preparation/authority gates and can be handed to future signing/execution infrastructure.

No smart-account deployment, session keys, private-key custody, arbitrary contract calls, autonomous mainnet transaction submission, or paid Telegraph acceptance was added.
