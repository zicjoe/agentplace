# M8 manual testing

Use production/testnet accounts carefully. M8 must move **zero funds**.

1. Run `pnpm check`.
2. At 100% browser zoom, open a Manager conversation and ask: `Bridge 500 USDC from Arbitrum to Base using the best route.`
3. If no Connected Wallet exists, AgentPlace should ask you to connect one and should not fabricate a quote.
4. With a Connected Wallet and no mandate, preparation should fail closed at deterministic authority. Action Review must say nothing was submitted/no funds moved.
5. Give Execution Operator a PREPARE mandate for that account/environment/network/capability, then retry. The prepared action should require exact human approval rather than claim execution.
6. Inspect Action Review technical details: preparation revision, digest, quote provider/status, simulation status, risk status, capability and account must be present.
7. If LI.FI has a route, quote evidence must be live. If not, show unavailable/failed truthfully. Never show the old prototype Across quote in API mode.
8. Approve once only when the action is `APPROVAL_REQUIRED`. Expected result: `READY_FOR_EXECUTION`; UI explicitly says M8 does not sign or submit.
9. Reject another action. Expected: durable rejection; no funds moved.
10. Let a quote expire (or wait for its expiry), refresh it, and confirm a new preparation revision/digest is created. Prior approval must not authorize the new revision.
11. Test a deliberately wrong network/asset/protocol against a mandate. Expected: DENIED; no Approve button.
12. Check Activity for action created/prepared/approved/rejected events.
13. Resize browser at 100% zoom and ensure Action Review stays bounded and internally scrollable.

Optional RPC preflight: configure `AGENTPLACE_EVM_RPC_<CHAIN_ID>` for the source chain. Without it, preflight must show `NOT_AVAILABLE`, not `PASSED`.
