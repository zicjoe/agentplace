# AgentPlace Receipt Registry

`AgentPlaceReceiptRegistry` is the first AgentPlace onchain submission component for Robinhood Chain Testnet.

It anchors privacy-safe cryptographic commitments for selected AgentPlace Job receipts. The complete Job,
conversation, user data, provider evidence and secrets remain offchain inside AgentPlace. The contract stores
only hashes plus minimal immutable anchoring metadata.

## Security properties

- No custody and no token/ETH transfer logic.
- No user private keys, prompts, provider keys, wallet addresses or raw Job content are stored.
- Only the owner or explicitly authorized anchorers may create anchors.
- Receipt hashes are append-only and cannot be overwritten or deleted.
- Duplicate receipt hashes revert.
- Zero hashes revert.
- Ownership transfer is two-step.
- There is no proxy, upgrade path, delegatecall, selfdestruct or arbitrary external call.

## Robinhood Chain Testnet

- Chain ID: `46630`
- Native gas asset: `ETH`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`
- Deployed contract: `0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd`
- Contract explorer: `https://explorer.testnet.chain.robinhood.com/address/0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd`
- Source verification: `verified (partial match)`

## Foundry validation

If Foundry is installed:

```bash
cd contracts/agentplace-receipt-registry
forge test
```

Deploy from the contract directory with a dedicated testnet deployer wallet:

```bash
forge create src/AgentPlaceReceiptRegistry.sol:AgentPlaceReceiptRegistry \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Never commit or paste the private key into AgentPlace source files, chat, logs or screenshots.

The public deployment address and verification status are recorded in `deployments/robinhood-chain-testnet.json`. Never add private signing material to the deployment record.

See `../../docs/ROBINHOOD-CHAIN-RECEIPT-REGISTRY.md` for the submission/deployment runbook.
