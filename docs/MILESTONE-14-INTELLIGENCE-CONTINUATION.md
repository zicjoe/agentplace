# M14 — Manager intelligence and wallet-context reconciliation (acceptance candidate)

This same-M14 change addresses a production failure found during integrated Test 5: the Manager could not resolve an already saved watch-only wallet when asked to check the wallet's portfolio. The financial-action path previously resolved owner wallets, but the normal research path did not.

## Implemented contract

- Before normal Manager planning, query only the authenticated AgentPlace owner's current wallet metadata. Do not expose raw credentials or make a financial action.
- For wallet/portfolio research, resolve a unique saved wallet by mode, name or exact saved account reference. Never silently replace a watch-only wallet with a connected or agent account.
- When several eligible wallets match, ask which to inspect and list distinct wallet choices. Name or numbered follow-up continues the original goal. This clarification is persisted as an ordinary durable conversation message.
- Pin an owner-verified address as the wallet intelligence subject, require the live `wallet.profile` capability (instead of the still-planned `portfolio.read`), and make a real read-only research Job through the existing Router/Job system. If no trusted provider is configured, return the route's truthful unavailable state; do not hallucinate portfolio values.
- Carry a recent selected wallet research target across bounded follow-ups and re-check the wallet against current owner-scoped records before reuse.
- Provide recent conversation messages to model planning as untrusted user dialogue, not privileged system instructions.
- Prevent an Alchemy all-network wallet profile lookup from combining incompatible EVM/Solana address families. Reject unsupported explicit network/address combinations rather than silently changing networks.
- Financial Action Review, mandates, signer policy, emergency stop and Mainnet gates remain unchanged. This is a research-context improvement only.

## Required external configuration

A real portfolio read requires at least one eligible wallet-profile implementation and a configured provider, currently the Alchemy or Nansen wallet-profile adapter. The Manager must not claim to have fetched balances if all providers are unavailable. This change does not provision external API credentials or expand the provider registry.

## Production acceptance (M14 Test 5B continuation)

1. From a Manager conversation ask: "Check the portfolio of my watch-only wallet." If exactly one saved watch-only address exists, the Job should reference that exact address and attempt the `wallet.profile` provider read. If none exists, expect an actionable missing-wallet message.
2. With two saved watch-only addresses, ask the same question. Expect a named and numbered clarification, not a guessed selection. Reply "the second one". Confirm the resulting Job targets the second wallet and preserves the original portfolio request.
3. Ask for a wallet by saved name. An unknown name should list options, never silently select another wallet. Verify a refresh preserves the conversation and any clarification.
4. After a resolved wallet Job, ask "Focus on stablecoins" as a follow-up. Verify it retains the same wallet rather than inventing a new address.
5. Inspect `Job Workspace → evidence` for actual provider evidence and limitations, or truthful provider unavailability. The answer must not claim verified holdings without provider evidence.
6. Ask a financial instruction from the watch-only wallet. It must not sign or receive execution authority; existing financial policies remain in control.
7. Check testnet/mainnet separation, old Billing/Security and M14 readiness flows remain unchanged.

## Non-goals and follow-up

This is not a general-purpose function-calling agent framework, new portfolio-data vendor, automatic wallet authorization, x402 upgrade, or complete language-understanding benchmark. Broad multi-Worker, cross-object and multi-intent conversation evaluation remains part of the open M14 acceptance work. Telegraph remains parked by product decision.

## Freeze status

Candidate only. Do not tag v0.17.0 or declare M14 frozen until local `pnpm check`, production deployment and manual acceptance pass.
