-- M13 payment integrity hardening.
-- A confirmed onchain payment may fund AgentPlace service balance at most once globally.
CREATE UNIQUE INDEX IF NOT EXISTS billing_service_payment_transaction_hash_unique_idx
  ON billing_service_payment(transaction_hash)
  WHERE transaction_hash IS NOT NULL;
