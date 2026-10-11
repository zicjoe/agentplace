# Milestone 6 — Wallet Foundation

Status: v0.9.1 candidate. M6 replaces prototype-only wallet state with durable, owner-scoped Wallet and Agent Account foundations while preserving the hard separation between identity, connection, authority, transactions and autonomy.

## Product principle

> A wallet being visible or connected to AgentPlace never means AgentPlace or a Worker can spend from it.

M6 deliberately separates four concepts:

1. **Wallet** — where account identity/assets exist.
2. **Authority** — what AgentPlace may do.
3. **Transaction** — a specific financial action.
4. **Autonomy** — whether a Worker may perform an authorized action without asking again.

M6 implements the first concept only. Mandates, transaction approval and autonomous execution remain later milestones.

## Scope

M6 introduces three durable wallet modes:

- **Watch-only** — stores a public EVM or Solana address plus explicit network context for research/monitoring. No signing capability exists. EVM chain context is selected by the user because an EVM address does not identify a chain by itself.
- **Connected Wallet** — stores the public account and browser-observed EVM network state. The user remains the signer for every future protected financial action.
- **Agent Account setup** — stores the owner relationship, preferred EVM networks and lifecycle metadata without fabricating an onchain smart-account address. The setup becomes `ready-for-deployment`, but actual deployment and Worker authority are separate gated milestones.

The wallet registry is owner-scoped in PostgreSQL through `wallet_resource`, `wallet_network_state` and `agent_account`.

## Locked safety boundaries

1. **No raw private keys, seed phrases or wallet recovery material are accepted, persisted or logged.**
2. **Connected Wallet is not authority.** M6 records only that a browser wallet provider exposed a public account to the current browser session. It does not create a mandate, transaction approval or autonomous signer grant.
3. **Agent Account setup is not deployment.** M6 records a durable setup with `deploymentStatus = not-deployed`; it does not invent a smart-account address, balance or Worker execution capability.
4. Watch-only resources contain public addresses and explicit observation-network context only.
5. Wallet state is owner-scoped and cannot be read or changed through another AgentPlace identity.
6. External intelligence, LLM output and Workers cannot mutate wallet authority.
7. Financial action preparation, Mandates, Authority Grants, session keys and execution remain later milestones.
8. Mainnet autonomous execution remains disabled.

## Durable model

### `wallet_resource`

Stores the user-owned wallet/account registry entry: mode, namespace (`eip155` or `solana`), public address where one exists, connection source, registry status and owner-scoped timestamps.

### `wallet_network_state`

Stores bounded network observations. Watch-only resources store user-selected context. Connected EVM wallets store browser-observed chain ID, public account, native balance in atomic units and observation time. This state is informational and cannot authorize a transaction.

### `agent_account`

Stores the durable Agent Account foundation: designated owner-wallet record, preferred EVM networks, lifecycle status, account standard (`unassigned` initially), deployment status (`not-deployed` initially), and an onchain account address only after a later deployment milestone actually creates one.

The lifecycle can represent `setup`, `ready-for-deployment`, `deployed`, `limited`, `paused` and `failed`. M6 creates `ready-for-deployment` metadata only; this is not financial authority.

## UX

The Wallets & Accounts surface explains all three modes in plain language. A signed-in user can:

- add an EVM or Solana watch-only wallet;
- explicitly choose the EVM network to observe instead of AgentPlace guessing;
- rename or remove a saved watch-only wallet;
- connect an existing EIP-1193 EVM browser wallet;
- refresh/disconnect the durable browser observation;
- create an Agent Account setup from an active connected EVM owner wallet;
- choose preferred EVM networks including Ethereum, Arbitrum, Base, BNB Chain, Polygon and Robinhood Chain.

The Agent Account setup UI explains why the account exists: it is the future execution home for Workers that may later operate under user-defined rules. M6 grants no such rules or authority.

## Browser connection path

The web application uses the already-installed EIP-1193 browser provider directly for M6:

1. request the selected account with `eth_requestAccounts`;
2. read `eth_chainId`;
3. read the native balance with `eth_getBalance`;
4. persist only public account/network observations;
5. never request a transaction signature as part of wallet connection.

WalletConnect is not claimed as implemented in M6.

## Acceptance gate

M6 is ready to freeze after:

- `pnpm check` passes;
- migration `0010_wallet_foundation.sql` applies cleanly;
- EVM and Solana watch-only addresses validate, persist, reload, rename and remove;
- EVM watch-only setup records an explicit observation network;
- a real browser EVM wallet connects and its address/chain/native balance rehydrate;
- disconnect changes only AgentPlace durable state and grants/revokes no browser permission;
- Agent Account setup requires an active connected EVM owner wallet, reaches `ready-for-deployment`, remains visibly `not-deployed`, has no fabricated address and has Worker authority `None`;
- no wallet secret appears in browser state, API payloads, database rows or logs.

## Viewport/layout hardening

M6 also closes a long-standing shell-layout regression: route content must remain reachable at 100% browser zoom without requiring the user to zoom out. Guest Home owns vertical scrolling, uses overflow-safe auto-margin centering, and primary route/workspace shells use constrained flex children (`min-h-0`) with explicit scroll owners. Short-viewport dialogs are bounded and scroll rather than clipping above/below the viewport. This is UX hardening only; it does not expand Wallet or Agent Account authority.
