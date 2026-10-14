# Security Policy

AgentPlace will handle financial actions, so security defects should not be disclosed in public issues when exploitation could put users or funds at risk.

## Supported versions

The latest `main` branch and current tagged release receive security fixes during active development.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when enabled for the repository. Do not include private keys, seed phrases, real production credentials, or unnecessary personal/financial data in a report.

If private reporting is temporarily unavailable, contact the repository owner through a private channel before publishing technical exploit details.

## Repository rules

- Never commit `.env`, private keys, seed phrases, signing files or production credentials.
- Example configuration must contain placeholders/safe defaults only.
- Mainnet execution/autonomy remain disabled unless an explicit production gate enables them.
- Dependencies with unresolved High/Critical findings block production-readiness gates unless formally risk-accepted and documented.
- Changes to authority, signing, billing, execution or verification require focused security review.

## Telegraph service-payment boundary

- `TELEGRAPH_EVM_PRIVATE_KEY` is a dedicated low-funded AgentPlace service-payment secret for Telegraph testnet calls only. It must exist only in the Railway Worker service and must never be exposed to Vercel/browser variables, model context, logs, database records, user wallets or Agent Accounts.
- Telegraph x402 payments are hard-pinned to Base Sepolia test USDC and bounded by per-call, per-Job and call-count limits. Environment settings may tighten but cannot raise the code-level caps.
- A Telegraph payment authorizes only the exact external intelligence request. It grants no capability, policy, wallet or financial execution authority.
- Paid requests are not automatically replayed when settlement/outcome is unknown.

## M9 Connected Wallet execution boundary

- AgentPlace API/Worker never accepts or stores the user's private key or seed phrase. Connected Wallet signing occurs only inside the user's EIP-1193 wallet.
- A signing request must be bound to the exact current prepared revision, action digest, one-time approval, account, network and current deterministic authority decision.
- `MAINNET_EXECUTION_ENABLED` gates user-signed Mainnet execution and remains `false` by default. `MAINNET_AUTONOMY_ENABLED` is separate and remains disabled in M9.
- A wallet-returned transaction hash is independently read from configured RPCs and compared with the exact approved `from`, `to`, calldata and value before confirmation is trusted.
- An ambiguous submission/observation state never triggers automatic resubmission. `UNKNOWN` means resolve the original transaction state first.
- Transaction confirmation is not an independently verified economic outcome and must not be labeled `Completed · AgentPlace Verified` in M9.
