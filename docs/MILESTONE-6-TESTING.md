# Milestone 6 testing

Run the repository gate first:

```powershell
pnpm check
```

Then test **Wallets & Accounts** while signed in.

1. Add an EVM watch-only address. Choose a network such as Ethereum or Arbitrum. Reload and confirm the wallet and selected network remain.
2. Rename that watch-only wallet. Reload and confirm the new name persists.
3. Remove the watch-only wallet. Confirm it disappears from the durable list and understand this does not affect the onchain address.
4. Add a Solana watch-only public address. Reload and confirm it remains with Solana context.
5. Connect an EIP-1193 EVM browser wallet. Confirm AgentPlace shows the real public address, selected chain and current native balance instead of fixture values.
6. Change the selected network in the browser wallet and press **Refresh**. Confirm a new/updated network observation appears.
7. Press **Disconnect from AgentPlace registry**. Confirm durable AgentPlace state becomes disconnected. This does not claim to revoke the browser extension's own site permission.
8. Create an Agent Account setup from an active connected EVM wallet. Choose one or more preferred EVM networks. Confirm AgentPlace rechecks the currently selected browser account and then shows **Ready for deployment**, **No onchain address yet**, **Not deployed** and **Worker authority: None**.
9. Sign out and sign back in. Confirm wallet/account resources rehydrate from the API.

Do not test with a seed phrase or private key. AgentPlace never needs either for M6.

## Viewport and zoom regression

At 100% browser zoom, test Guest Home and the authenticated route surfaces at common laptop viewport heights (including approximately 768px and 900px):

- Guest Home title, composer, starter cards and the bottom research/wallet note are reachable without zooming out.
- When the whole Guest Home does not fit, only the route workspace scrolls; the document and desktop sidebar remain fixed.
- Home, Discover, Workers, Wallets, Activity, Routines, Security/Billing, creator surfaces, conversations, Worker workspaces and Job workspaces retain reachable content with no header/footer trapped outside the viewport.
- Wallet setup, Create, sign-in and other bounded dialogs scroll internally/on their overlay when the viewport is too short.
- Mobile retains its top bar/bottom navigation while the active workspace owns scrolling.

Regression coverage lives in `tests/viewport-layout.test.mjs`.
