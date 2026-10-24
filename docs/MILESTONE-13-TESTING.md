# Milestone 13 — Production Acceptance

1. Set Creator Worker to a monthly price and publish it.
2. Discover displays the exact price and empirical evidence without changing Router priority.
3. Fund service balance through the explicitly configured Arbitrum Sepolia USDC test rail. The treasury must differ from the funding Connected Wallet, and one transaction hash must never be reusable for a second service-balance credit.
4. Acquire the paid Worker: quote, balance debit, entitlement and optional subscription persist; no wallet authority is created.
5. Verify an unentitled user cannot install, Try, or create a Job with the paid Worker.
6. Run an entitled Job and inspect Job cost details; transferred capital must not be presented as a service fee.
7. Billing shows the same durable spend; Creator Earnings shows gross attributable revenue with allocation still unallocated.
8. Verify an active monthly subscription renews from service balance only when balance/monthly limit allow it; insufficient balance becomes past due without charging a wallet. Cancel renewal and verify access ends at the paid-period boundary.
9. Use Security emergency stop: DRAFT/PREPARED/pending-wallet future work stops; submitted/confirming/unknown transactions are reported untouched.
10. Quarantine a Creator Worker/Capability: Discover/acquisition/new Job use is blocked while historical evidence remains. Release quarantine and re-check eligibility.
11. Hard-refresh Billing, Creator Earnings and Security history; durable state must survive.
12. Verify Billing persists the monthly service limit and single-Job service-cost confirmation threshold. The threshold must not fabricate a charge for isolated Creator capabilities that have no trusted runtime invocation route.
13. Confirm MAINNET_EXECUTION_ENABLED=false and MAINNET_AUTONOMY_ENABLED=false.
