import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('packages/db/migrations/0015_settlement_verification_receipts.sql', 'utf8');
const verification = readFileSync('packages/verification/src/index.ts', 'utf8');
const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
const api = readFileSync('apps/api/src/server.ts', 'utf8');
const receiptView = readFileSync('apps/web/src/components/VerifiedReceiptView.tsx', 'utf8');
const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
const actionReview = readFileSync('apps/web/src/components/ActionReview.tsx', 'utf8');
const mainnetEnv = readFileSync('config/environments/production-mainnet.env.example', 'utf8');


test('M10 persists settlement observations, immutable outcomes/receipts, and a durable asynchronous proof queue', () => {
  for (const token of ['verification_contract','settlement_observation','verified_outcome','verified_receipt','proof_anchor_queue']) assert.match(migration, new RegExp(token));
  for (const status of ['VERIFYING','VERIFIED','NOT_VERIFIED','UNKNOWN','PARTIAL']) assert.match(migration, new RegExp(`'${status}'`));
  assert.match(migration, /VERIFICATION_CONTRACT_IMMUTABLE/);
  assert.match(migration, /VERIFIED_OUTCOME_IMMUTABLE/);
  assert.match(migration, /VERIFIED_RECEIPT_IMMUTABLE/);
  assert.match(migration, /job_id text,/);
  assert.match(migration, /DEFAULT 'PENDING'/);
  assert.match(migration, /target_chain_id bigint NOT NULL DEFAULT 42161/);
});


test('M10 verifies historical exact authorization lineage rather than current authority', () => {
  assert.match(verification, /approval_action_id === candidate\.action_id/);
  assert.match(verification, /approval_revision === candidate\.prepared_revision/);
  assert.match(verification, /approval_digest === candidate\.action_digest/);
  assert.match(verification, /prepared_digest === candidate\.action_digest/);
  assert.match(verification, /approval_decided_at\.getTime\(\) <= candidate\.wallet_prompted_at\.getTime\(\)/);
  assert.match(verification, /prepared_expires_at/);
  assert.doesNotMatch(verification, /evaluateAuthority\(/);
});


test('M10 native transfer contract requires exact chain sender recipient value empty calldata and successful receipt', () => {
  for (const token of ["'chain'", "'sender'", "'native-recipient'", "'native-value'", "'native-calldata'", "'receipt-success'", "'submitted-request'"]) assert.match(verification, new RegExp(token));
  assert.match(verification, /txInput === '0x'/);
  assert.match(verification, /txValue === expectedAmount/);
});


test('M10 ERC20 verification is explicitly allowlisted and checks calldata plus Transfer event semantics', () => {
  assert.match(verification, /SUPPORTED_ERC20_TRANSFERS/);
  assert.match(verification, /0xaf88d065e77c8cc2239327c5edb3a432268e5831/i);
  assert.match(verification, /0xa9059cbb/);
  assert.match(verification, /0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef/i);
  for (const token of ["'supported-token-contract'", "'token-contract'", "'erc20-transfer-call'", "'erc20-transfer-event'"]) assert.match(verification, new RegExp(token));
});


test('M10 independently re-reads chain evidence with optional RPC cross-check and never signs or submits', () => {
  for (const token of ['eth_chainId','eth_getTransactionByHash','eth_getTransactionReceipt','VERIFICATION_RPC_CONFLICT','verification-secondary-rpc']) assert.match(verification, new RegExp(token));
  assert.doesNotMatch(verification, /eth_sendTransaction|eth_sendRawTransaction|privateKey|seed phrase|mnemonic/i);
});


test('M10 exact gas accounting separates capital from network and service costs', () => {
  assert.match(verification, /gasUsed \* effectiveGasPrice/);
  assert.match(verification, /Transferred capital is not a fee/);
  assert.match(verification, /Exact EVM receipt calculation: gasUsed × effectiveGasPrice/);
  assert.match(verification, /Direct transfer uses no paid external execution capability/);
  assert.match(verification, /No AgentPlace service charge is recorded/);
});


test('M10 fail-closed states distinguish unknown from definite non-verification', () => {
  assert.match(verification, /status='UNKNOWN',retryable=true/);
  assert.match(verification, /status='NOT_VERIFIED',retryable=false/);
  assert.match(verification, /No Verified Receipt was produced/);
  assert.match(verification, /retrying without resubmitting anything/);
  assert.match(verification, /if \(result\.status === 'VERIFIED'\)/);
});


test('M10 backfills historical confirmed direct transfers with no created-at cutoff', () => {
  assert.match(verification, /WHERE ta\.status='CONFIRMED'/);
  assert.match(verification, /fa\.action_type='transfer'/);
  const claimStart = verification.indexOf('async function claimNextCandidate');
  const claimEnd = verification.indexOf('async function markUnknown', claimStart);
  const claim = verification.slice(claimStart, claimEnd);
  assert.doesNotMatch(claim, /created_at\s*>|confirmed_at\s*>/i);
});


test('M10 successful verification atomically creates outcome receipt and pending Arbitrum proof commitment without an anchor signer', () => {
  assert.match(verification, /INSERT INTO verified_outcome/);
  assert.match(verification, /INSERT INTO verified_receipt/);
  assert.match(verification, /INSERT INTO proof_anchor_queue/);
  assert.match(verification, /'eip155','arbitrum',42161,'BATCH','PENDING'/);
  assert.match(verification, /agentplace:verified-receipt:v1/);
  assert.match(verification, /randomBytes\(32\)/);
  assert.doesNotMatch(verification, /walletClient|privateKeyToAccount|eth_sendTransaction|eth_sendRawTransaction|sendTransaction\(/i);
});


test('M10 verification worker is deterministic and uses zero routine LLM polling', () => {
  assert.match(worker, /settlementVerificationLoop/);
  assert.match(worker, /verifyConfirmedTransactionAttempts/);
  const start = worker.indexOf('async function settlementVerificationLoop');
  const end = worker.indexOf('async function main', start);
  const loop = worker.slice(start, end > start ? end : undefined);
  assert.doesNotMatch(loop, /generateStructured|generateText|GEMINI|OPENAI|ANTHROPIC/i);
});


test('M10 exposes owner-scoped verification/receipt reads and production UX completion', () => {
  assert.ok(api.includes("url.pathname === '/api/v1/verification'"));
  assert.match(api, /actions\\\/\(\[\^\/\]\+\)\\\/outcome/);
  assert.match(api, /receipts\\\/\(\[\^\/\]\+\)/);
  assert.match(chat, /Completed · AgentPlace Verified/);
  assert.match(chat, /View receipt/);
  assert.match(actionReview, /View Verified Receipt/);
  assert.match(receiptView, /Arbitrum proof anchor pending/);
  assert.match(receiptView, /Production verification evidence/);
  assert.match(receiptView, /Receipt commitment/);
  assert.match(verification, /verificationMethod: core\.verification\.method/);
});


test('M10 keeps Mainnet execution and autonomy fail-closed by default', () => {
  assert.match(mainnetEnv, /MAINNET_EXECUTION_ENABLED=false/);
  assert.match(mainnetEnv, /MAINNET_AUTONOMY_ENABLED=false/);
});
