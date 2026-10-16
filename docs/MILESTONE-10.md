# Milestone 10 — Settlement Verification + Verified Outcomes + Verified Receipts

Version: **AgentPlace v0.13.0**

## Goal

M9 proves that an exact approved Connected Wallet transaction reached the blockchain and confirmed. M10 proves the requested economic result independently before AgentPlace calls the work complete.

The production lifecycle is now:

```text
Intent → Prepare → Quote/Preflight → Risk → Authority → Approve once
→ Pre-sign verification → Connected Wallet signature → Submit → Observe → Confirmed
→ Verify economic outcome → Completed · AgentPlace Verified → Verified Receipt
→ Arbitrum proof anchor pending
```

Transaction confirmation remains distinct from outcome verification.

## Production verification contract

M10 activates one production Verification Contract: `vc_asset_transfer_evm_v1` for `asset.transfer` on supported EVM networks.

### Native transfer

Verification requires all of the following:

- exact historical Action, Prepared Action revision, Action Digest and one-time Approval correspondence;
- approval was still valid when the wallet signing request was created;
- exact EVM chain;
- exact transaction hash;
- exact Connected Wallet sender;
- exact recipient;
- exact atomic native value;
- empty calldata for a direct native transfer;
- successful transaction receipt;
- consistent block evidence;
- exact wallet-request correspondence;
- receipt gas fields required for deterministic cost accounting.

### ERC-20 transfer

M10 additionally requires:

- token contract is in the M10 production transfer-verification allowlist;
- transaction target is the approved token contract;
- zero native value;
- exact standard `transfer(address,uint256)` calldata;
- exact recipient and amount;
- matching `Transfer(address,address,uint256)` receipt event from the approved token contract.

M10's production token allowlist matches the direct M9 USDC path on Ethereum, Arbitrum and Base. Arbitrary token contracts are not silently certified.

## Durable data model

Migration `0015_settlement_verification_receipts.sql` adds:

- `verification_contract`
- `settlement_observation`
- `verified_outcome`
- `verified_receipt`
- `proof_anchor_queue`

`VerifiedOutcome` and `VerifiedReceipt` are immutable after insertion. A direct Manager financial action may legitimately have no Job; M10 therefore keeps `job_id` optional rather than manufacturing historical Jobs.

## Verification states

- `VERIFYING` — confirmed transaction is being checked.
- `VERIFIED` — every required contract check passed.
- `NOT_VERIFIED` — sufficient evidence exists and at least one required check definitively failed.
- `UNKNOWN` — current evidence is insufficient/unavailable/conflicting; retry is safe because no transaction is resubmitted.
- `PARTIAL` — schema state reserved for future multi-step capabilities. The M10 direct-transfer verifier never emits it.

Only durable `VERIFIED` outcomes create a Verified Receipt and may display **Completed · AgentPlace Verified**.

## Historical M9 backfill

The verification Worker intentionally scans historical `CONFIRMED` `asset.transfer` transaction attempts without a creation-time cutoff. If the accepted M9 transaction remains in the production database, v0.13.0 can verify it without another wallet signature or blockchain transaction.

Accepted M9 transaction:

`0x902159458732c540d24b1b5fdacd2ffb6f4421bb92fe2eb2f038af671ec67898`

A public transaction hash alone is not sufficient to manufacture AgentPlace verification. The durable M9 Action, preparation, Approval and TransactionAttempt lineage must still exist.

## Gas and cost accounting

EVM network gas is calculated with integer arithmetic from receipt evidence:

```text
gasCostAtomic = gasUsed × effectiveGasPrice
```

The receipt separates:

1. transferred capital — not a fee;
2. network gas;
3. external service/provider cost;
4. AgentPlace service cost.

For direct M10 transfers, external execution service cost is `Not applicable` and AgentPlace service cost is `Not billed` unless a later billing milestone records a real charge.

## Independent evidence

The verifier re-reads transaction and receipt evidence from server-side RPC configuration after M9 confirmation. `AGENTPLACE_EVM_RPC_<chainId>_SECONDARY` is preferred when configured; a second distinct configured provider is used to cross-check critical evidence. Conflicting provider evidence produces `UNKNOWN`, never a false Verified state.

RPC URLs are not persisted into receipt evidence.

## Verified Receipt

A production receipt includes:

- user goal;
- Worker attribution;
- exact authorized action and approval lineage;
- actual economic outcome;
- separated costs;
- transaction/block evidence;
- Verification Contract and deterministic checks;
- evidence commitment;
- privacy-safe receipt commitment;
- proof-anchor status.

For a historical direct Manager transfer with no explicit `worker_id`, the receipt uses Execution Operator as an `execution-path-default` attribution and explicitly records that attribution type. It does not rewrite historical ownership.

## Privacy-safe proof commitment

The full receipt stays offchain. M10 generates a random 256-bit receipt salt and computes a domain-separated commitment over canonical receipt data. The durable proof queue contains the receipt commitment, a subject commitment and evidence root rather than raw conversation/user data.

## Asynchronous Arbitrum proof boundary

M10 creates a durable `proof_anchor_queue` record with:

- target: Arbitrum / chain ID 42161;
- mode: batch;
- state: `PENDING`.

**M10 does not contain a production anchor signer or anchoring transaction path.** Verified user completion does not wait for proof anchoring.

The existing Robinhood Chain Testnet receipt registry remains historical/test infrastructure and is not promoted into the production proof system.

## Security / custody

M10 introduces no new custody or signing authority.

- browser wallet signing remains the M9 boundary;
- verification code only reads chain data and database lineage;
- no private key, seed phrase, mnemonic, service signing key or raw user signing secret is accepted;
- verification never calls `eth_sendTransaction` or `eth_sendRawTransaction`;
- routine verification uses zero LLM calls;
- Mainnet execution and Mainnet autonomy remain disabled by default.

## Explicitly deferred

M10 does not add:

- live Arbitrum anchoring;
- backend/KMS/HSM/MPC anchor signer;
- production anchoring smart contract or Merkle publisher;
- swap or bridge outcome verification;
- lending/perps verification;
- Solana verification;
- Agent Account signing/deployment;
- new Mainnet execution capabilities;
- autonomous Mainnet execution;
- arbitrary contract verification;
- automatic financial recovery;
- generalized fiat-price historical accounting.
