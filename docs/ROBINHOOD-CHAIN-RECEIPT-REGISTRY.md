# Robinhood Chain Testnet — AgentPlace Receipt Registry

## Purpose

AgentPlace's submission contract is `AgentPlaceReceiptRegistry`, a non-custodial append-only registry for
cryptographic commitments to selected AgentPlace Job receipts.

The full AgentPlace receipt remains offchain and can include the user goal, Worker, routed capabilities,
provider evidence and normalized outcome. Before anchoring, AgentPlace hashes the canonical receipt and
privacy-safe Job/evidence commitments. Only those hashes are written onchain.

This preserves the AgentPlace architecture: blockchain anchoring is proof infrastructure, not a second Job
runtime, data store, Router or financial-authority system.

## Contract boundary

The contract intentionally cannot:

- move user funds;
- sign transactions for a user;
- receive Worker authority;
- change AgentPlace policies or Router decisions;
- read provider secrets;
- store raw prompts, conversations, evidence payloads or account data;
- overwrite or delete an anchored receipt.

It can only record one immutable receipt commitment and its minimal anchor metadata.

## Network

Deployment target for the Singapore submission:

- Network: Robinhood Chain Testnet
- Chain ID: `46630`
- Gas asset: `ETH`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`
- Explorer verification API: `https://explorer.testnet.chain.robinhood.com/api/`

Robinhood Chain is EVM-compatible, so the contract uses Solidity and standard Ethereum deployment tooling.

## Deployment record

Current public deployment:

- Contract: `AgentPlaceReceiptRegistry`
- Address: `0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd`
- Explorer: `https://explorer.testnet.chain.robinhood.com/address/0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd`
- Source-verification status: `verified (partial match)`
- Compiler shown by explorer: `v0.8.24+commit.e11b9ed9`
- Optimization shown by explorer: disabled

The public deployment metadata is also recorded in:

`contracts/agentplace-receipt-registry/deployments/robinhood-chain-testnet.json`

No private key or seed phrase belongs in that file.

## Receipt commitment semantics

`receiptHash`
: `keccak256` of the canonical offchain AgentPlace receipt bytes.

`jobHash`
: privacy-safe hash of the canonical Job identifier/context. Do not anchor a raw internal database ID when
  the identifier itself should remain private.

`evidenceRoot`
: hash or Merkle root committing to the evidence set represented by the receipt.

The contract records block/timestamp/anchorer metadata and emits `ReceiptAnchored`.

## Production posture

This submission deployment is testnet proof infrastructure. It does not enable financial execution or
Mainnet autonomy. A later proof service may batch/hash receipts asynchronously so user-facing Job completion
never waits for blockchain anchoring.
