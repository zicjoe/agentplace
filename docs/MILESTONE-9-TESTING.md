# M9 manual acceptance — Connected Wallet Execution + Observation

M9 can move real funds when Mainnet execution is deliberately enabled. Use a **tiny amount** and an address you control. Never share a private key, seed phrase, or wallet secret with AgentPlace or in chat.

## A. Repository and deployment gate

1. Run `pnpm check` and require `verify:milestone-9` to pass.
2. Deploy migration `0013_connected_wallet_execution.sql` through the normal `pnpm migrate` Railway API release step.
3. Keep `MAINNET_AUTONOMY_ENABLED=false`.
4. First deploy with `MAINNET_EXECUTION_ENABLED=false` and verify an approved Mainnet action cannot launch the wallet-signing path.
5. Configure at least one server-side RPC for the chain you intend to test. Prefer a primary and optional secondary RPC. Do not put RPC credentials in `VITE_*` variables.
6. Deliberately set `MAINNET_EXECUTION_ENABLED=true` on the API and Worker only when ready for the real-wallet acceptance test.
7. Verify Vercel, Railway API and Railway Worker are on the same newest commit.

## B. Recommended first real execution — tiny direct native transfer

A direct transfer is the cleanest first execution because it does not depend on a bridge allowance or DEX route.

1. Use a Connected Wallet with a tiny native balance on a supported Mainnet network.
2. Give Execution Operator a narrow **PREPARE** mandate for that exact Connected Wallet, network and `asset.transfer`, with `Always ask me` approval policy.
3. In Manager, use a destination address you control, for example:

   `Send 0.000001 ETH on Arbitrum to 0xYOUR_OTHER_ADDRESS`

4. Open Action Review. Confirm exact account, network, destination, amount, revision, digest, risk/preflight and deterministic authority.
5. Click **Approve once**. The action must say it is ready for the exact Connected Wallet to sign. No future authority is created.

## C. Wallet-signing safety

Run these as separate preparations/attempts where necessary.

1. **Mainnet gate disabled** — signing button is disabled/blocked with a clear production-gate explanation.
2. **User rejection** — reject the wallet popup. Expected: `USER_REJECTED`; nothing submitted; a deliberate retry may be requested later.
3. **Wrong browser account** — switch to a different account before signing. Expected: pre-submission failure; no `eth_sendTransaction` call for the wrong account.
4. **Wrong browser network** — switch to a different chain. Expected: pre-submission failure with a switch-network explanation.
5. **Exact preparation changed/expired** — refresh/reprepare after approval. Old approval must not be usable for signing.
6. **Watch-only** — never exposes a sign/submit path.
7. **Agent Account setup** — undeployed Agent Account remains fail-closed; AgentPlace must not substitute a Connected Wallet.

## D. Successful real transaction

For the tiny approved transfer:

1. Click **Sign and submit in wallet**.
2. Verify the browser wallet shows the exact network, destination and amount.
3. Sign in the wallet.
4. AgentPlace must persist one `TransactionAttempt` and the wallet-returned transaction hash.
5. Refresh/close/reopen the browser while the transaction is pending. The durable attempt must restore; it must not request a second signature.
6. The Worker observer must progress to `CONFIRMING` and then `CONFIRMED` when the exact transaction succeeds.
7. The final M9 message must be:

   `Transaction confirmed · Verifying outcome`

   It must **not** say `Completed · AgentPlace Verified`.
8. Activity/Audit must contain meaningful signature/submission/confirmation events.

## E. Duplicate-execution and unknown-state safety

1. Double-click/sign-start retry/API replay must not create a second transaction attempt for the same exact action revision.
2. Once a signature is already requested, AgentPlace must not issue another automatic request.
3. Once a hash is submitted, a repeated execution call must refuse resubmission.
4. If wallet submission result is ambiguous, state becomes `UNKNOWN` and UI explicitly says **Do not resubmit**.
5. If RPC observation temporarily fails after a known hash, state may become `UNKNOWN`; the Worker can later recover by observation, but it must never broadcast another transaction.
6. Primary-to-secondary RPC fallback may read/observe the same transaction only.

## F. Independent payload integrity

After a hash is known, AgentPlace independently reads the onchain transaction and compares it with the exact approved request:

- from account;
- destination/contract;
- calldata;
- value.

A definite mismatch becomes `MISMATCH`. AgentPlace must not call it authorized completion even if the transaction itself confirms.

## G. Responsive execution progress

At desktop and ~390px mobile width:

- transaction status and hash wrap safely;
- no horizontal page scroll;
- `UNKNOWN` / `Do not resubmit` is visible;
- the sign button remains deliberate and reachable;
- environment/account context remains visible;
- browser refresh restores the same durable attempt.

## Exit criterion

Freeze M9 only after the repository check passes and at least one tiny user-signed Mainnet transaction has been observed end-to-end without duplicate submission, while confirmation remains explicitly separate from M10 economic verification.
