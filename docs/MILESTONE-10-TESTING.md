# Milestone 10 Testing — v0.13.0

## Automated gate

Run from the repository root:

```powershell
pnpm check
```

The M10-specific verifier can also be run directly:

```powershell
pnpm verify:milestone-10
```

Expected M10 result:

```text
PASS: M10 Settlement Verification + Verified Outcomes + Verified Receipts ...
```

## Production manual acceptance

Keep these production safety flags disabled during M10 acceptance:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

### A. Historical M9 transfer backfill

Use the already accepted M9 Mainnet transaction:

`0x902159458732c540d24b1b5fdacd2ffb6f4421bb92fe2eb2f038af671ec67898`

After migration and Worker deployment, the M10 verifier should automatically discover its durable `CONFIRMED` `transaction_attempt` if that row remains in production PostgreSQL.

Expected:

```text
CONFIRMED → VERIFYING → VERIFIED
```

There must be:

- no wallet popup;
- no signing request;
- no new transaction;
- no requirement to enable Mainnet execution;
- no new user gas spend.

### B. User-facing completion

The original action/conversation should advance from:

```text
Transaction confirmed · Verifying outcome
```

to:

```text
Completed · AgentPlace Verified
```

and expose **View receipt**.

### C. Receipt truth

Verify the receipt shows the actual:

- environment/network;
- sender;
- recipient;
- asset and exact amount;
- transaction hash;
- confirmed block when available;
- deterministic Verification Contract checks;
- `gasUsed × effectiveGasPrice` network gas;
- transferred capital separately from gas/service cost;
- receipt commitment/evidence root in technical detail;
- `Arbitrum proof anchor pending`.

The receipt must not claim that anchoring has happened.

### D. Refresh and Worker restart

Refresh the browser and restart the Railway Worker.

Expected:

- the same VerifiedOutcome and VerifiedReceipt are restored from PostgreSQL;
- no duplicate outcome, receipt or proof queue row is created;
- no wallet action occurs.

### E. Verification RPC degradation

For a controlled test/fixture, make all verification RPC sources unavailable after a transaction is already confirmed.

Expected:

```text
UNKNOWN / Verification delayed
```

not:

```text
AgentPlace Verified
```

Restore RPC access. The verifier should safely retry the read-only check and advance when sufficient evidence becomes available.

### F. Fail-closed evidence mismatch

Automated M10 tests cover exact mismatch cases. A recipient, amount, sender, action digest, Approval lineage, token event or supported-token-contract mismatch must end as `NOT_VERIFIED` and must create **no Verified Receipt**.

### G. Responsive receipt

Check desktop and approximately 390px mobile width:

- hashes/addresses wrap and do not force horizontal scrolling;
- actual outcome remains the visual lead;
- cost categories remain distinct;
- verification checks are readable;
- proof-pending state is clear;
- technical commitments remain secondary/expandable.

## Acceptance rule

Do not freeze M10 merely because the transaction is confirmed. Freeze only after a real durable successful verification produces the Verified Receipt and the user explicitly accepts the milestone.
