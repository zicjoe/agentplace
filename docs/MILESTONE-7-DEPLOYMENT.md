# Milestone 7 deployment notes

M7 is an additive production migration and does not require manual SQL in the normal AgentPlace deployment flow.

## Local verification

From the repository root in Windows PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

The install step is required for this replacement because the API gains a new workspace dependency on `@agent-place/authority`. No new external paid service or secret is introduced.

## Production deployment

Use the existing Git deployment flow. Railway already runs the repository migration command before API deployment; migration `0011_mandates_authority.sql` is therefore applied through the normal pre-deploy path.

Do not paste private keys, seed phrases, wallet recovery secrets or production credentials into chat or source control.

## Environment contract

M7 reuses the existing Mainnet/Testnet execution/autonomy environment contract. No new M7 environment variables are required. In particular, storing an ACT_WITHIN_MANDATE policy does not override the runtime Mainnet autonomy safety gate.
