# Milestone 7 manual acceptance checklist

Run `pnpm check` first. Then test at **100% browser zoom** on desktop; also spot-check mobile/compact width for the mandate dialog and Security/Wallet/Worker authority surfaces.

## Persistence and default-none

1. Add/open a Worker with no mandate. Confirm Worker Workspace says no mandate/no Worker financial authority.
2. Connect a wallet or create an Agent Account. Confirm that neither action creates a mandate.
3. Reload the browser after creating a mandate. Confirm the mandate, status and revision persist.

## Authority levels

1. Create OBSERVE and choose read capabilities. Confirm the UI describes no financial action authority.
2. Create PREPARE. Confirm it describes preparation with human approval required for execution.
3. Create ACT_WITHIN_MANDATE on an Agent Account with explicit asset/network/capabilities, per-action limit, period budget and expiry.
4. Attempt to create ACT_WITHIN_MANDATE against a Connected or Watch-only wallet. It must fail.

## Limits and restrictions

Use the Authority evaluation API/test harness through the M7 automated tests to prove:

- missing mandate → DENIED;
- wrong network → DENIED;
- wrong asset → DENIED;
- unrelated capability → DENIED;
- disallowed protocol/destination → DENIED when restricted;
- value above per-action hard limit → DENIED;
- cumulative period spend exceeding budget → DENIED;
- expired/paused/revoked mandate → DENIED;
- PREPARE execution → APPROVAL_REQUIRED;
- Connected Wallet execution → APPROVAL_REQUIRED;
- Mainnet autonomy gate off → APPROVAL_REQUIRED;
- valid bounded testnet ACT proposal → ALLOWED.

No M7 test should submit a blockchain transaction.

## Revision and revocation

1. Edit an existing mandate. Confirm revision increments and history endpoint retains prior revision.
2. Pause from Worker Workspace. Confirm it becomes unusable immediately and the account/Security views agree.
3. Resume a paused mandate.
4. Revoke from Wallet/Agent Account detail. Confirm it becomes permanently revoked.
5. Attempt to resume/revise the revoked mandate through the API. It must not resurrect.
6. Use Security & Authority global revoke and confirm standing mandates are revoked while wallets, Workers and history remain.

## Natural-language draft

Enter: `Let my Stablecoin Worker optimize my USDC on Base, but never move more than $50 without asking me.`

Confirm AgentPlace produces a structured **draft** and does not activate it. The approval threshold may be drafted as $50, but ACT activation must still require a separate hard per-action ceiling, period budget, Agent Account, explicit asset allow-list and expiry.

## Audit / Activity

Evaluate at least one allowed, one approval-required and one denied proposal. Confirm each decision has durable reason codes/evidence and authority/mandate events appear in Activity after refresh.

## Viewport regression

Open Mandate Editor with enough capability rows/content to exceed a short viewport. Confirm the modal itself scrolls, header/footer stay reachable, and the page does not require zooming out.
